import { Simulation, Faction, Channel, type SimCommands } from "../core";
import type { Platform } from "../platform/Platform";
import { GameAction } from "../platform/InputSource";
import { Camera } from "./Camera";
import { WorldView } from "./WorldView";
import { Hud } from "./Hud";
import { ObjectiveTracker, RunOutcome } from "./Objectives";

/** Fixed simulation timestep. The renderer runs as fast as the display; the
 * sim always advances in 1/60 s increments so behaviour is identical whether
 * the machine renders at 30, 60, or 144 Hz — essential for determinism and
 * for matching behaviour across PC and console frame rates. */
const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 6; // spiral-of-death guard

type Brush = "food" | "home";

/**
 * Top-level game controller. Owns the simulation and the view, translates
 * abstract input into simulation commands, runs the fixed-step accumulator,
 * and renders. This is the integration point between the portable core and a
 * concrete Platform — and the natural home for a future scene/state machine
 * (menus, campaign chapters, multiplayer lobby).
 */
export class Game {
  private readonly platform: Platform;
  private sim: Simulation;
  private cam: Camera;
  private readonly view = new WorldView();
  private readonly hud = new Hud();
  private readonly objectives = new ObjectiveTracker();

  private accumulator = 0;
  private paused = false;
  private brush: Brush = "food";
  private seed: number;
  private prevGathered = 0;
  private prevPop = 0;
  private endCuePlayed = false;
  private stop: (() => void) | null = null;

  constructor(platform: Platform, seed = Date.now() & 0xffffff) {
    this.platform = platform;
    this.seed = seed;
    this.sim = new Simulation(seed);
    const w = this.sim.cfg.world.width;
    const h = this.sim.cfg.world.height;
    this.cam = new Camera(w, h, this.sim.colonies[Faction.Player].nestX, this.sim.colonies[Faction.Player].nestY);
    this.cam.targetZoom = 1.4;
  }

  start(): void {
    this.stop = this.platform.onFrame((dt) => this.frame(dt));
  }

  dispose(): void {
    this.stop?.();
    this.stop = null;
  }

  /** Read-only snapshot for tooling / smoke tests. Not used by gameplay. */
  debugStats() {
    return this.sim.stats();
  }

  private restart(): void {
    this.seed = (this.seed * 1103515245 + 12345) & 0xffffff;
    this.sim = new Simulation(this.seed);
    this.cam = new Camera(
      this.sim.cfg.world.width,
      this.sim.cfg.world.height,
      this.sim.colonies[Faction.Player].nestX,
      this.sim.colonies[Faction.Player].nestY,
    );
    this.cam.targetZoom = 1.4;
    this.accumulator = 0;
    this.prevGathered = 0;
    this.prevPop = 0;
    this.endCuePlayed = false;
    this.paused = false;
  }

  private frame(dt: number): void {
    const input = this.platform.input;
    input.poll();
    this.cam.setViewport(this.platform.renderer.width, this.platform.renderer.height);

    const state = this.objectives.evaluate(this.sim);
    const finished = state.outcome !== RunOutcome.Playing;

    // Global controls.
    if (input.wasPressed(GameAction.Pause)) this.paused = !this.paused;
    if (input.wasPressed(GameAction.ToggleOverlay)) this.view.toggleOverlay();
    if (input.wasPressed(GameAction.Confirm) && finished) {
      this.platform.audio.play("tap");
      this.restart();
      return;
    }

    // Zoom (wheel + buttons).
    const zd = input.zoomDelta();
    if (zd !== 0) this.cam.zoomBy(zd);
    if (input.isDown(GameAction.ZoomIn)) this.cam.zoomBy(dt * 4);
    if (input.isDown(GameAction.ZoomOut)) this.cam.zoomBy(-dt * 4);

    // Brush select is implicit: F paints food-trail, H paints home-trail.
    const commands = this.buildCommands();

    // Advance the simulation with a fixed-step accumulator.
    if (!this.paused && !finished) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        // Commands apply on the first sub-step only; subsequent sub-steps in
        // the same frame use empty commands so a single key press isn't
        // multiplied by the number of catch-up steps.
        this.sim.step(FIXED_DT, steps === 0 ? commands : undefined);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0; // shed backlog
    }

    this.handleAudioEvents();

    // Camera: follow the possessed ant if any, else free-pan toward nest on
    // recenter.
    const poss = this.sim.possessedAnt();
    if (poss) this.cam.follow(poss.x, poss.y, Math.min(1, dt * 6));
    if (input.wasPressed(GameAction.Recenter)) {
      const target = poss ?? null;
      if (target) this.cam.moveTo(target.x, target.y);
      else this.cam.moveTo(this.sim.colonies[Faction.Player].nestX, this.sim.colonies[Faction.Player].nestY);
    }
    this.cam.update(dt);

    // Render.
    const r = this.platform.renderer;
    this.view.draw(r, this.sim, this.cam);
    this.hud.draw(r, this.sim.stats(), state, {
      paused: this.paused,
      overlay: this.view.overlayVisible,
      possessing: poss != null,
      brush: this.brush,
    });
  }

  private buildCommands(): SimCommands {
    const input = this.platform.input;
    const poss = this.sim.possessedAnt();

    // Possess / release toggle.
    let possessAt: SimCommands["possessAt"] = null;
    let release = false;
    if (input.wasPressed(GameAction.Possess)) {
      if (poss) {
        release = true;
        this.platform.audio.play("release");
      } else {
        const ptr = input.pointer();
        const world = ptr
          ? this.cam.screenToWorld(ptr.x, ptr.y)
          : { x: this.cam.x, y: this.cam.y };
        possessAt = world;
        this.platform.audio.play("possess");
      }
    }

    // Steering for a possessed ant comes from the move axis (WASD / stick).
    let steer: SimCommands["steer"] = null;
    if (poss) {
      const ax = input.moveAxis();
      if (ax.x !== 0 || ax.y !== 0) steer = ax;
    }

    // Pheromone painting at the pointer.
    let paint: SimCommands["paint"] = null;
    const wantFood = input.isDown(GameAction.PaintFood);
    const wantHome = input.isDown(GameAction.PaintHome);
    if (wantFood || wantHome) {
      this.brush = wantFood ? "food" : "home";
      const ptr = input.pointer();
      const world = ptr ? this.cam.screenToWorld(ptr.x, ptr.y) : { x: this.cam.x, y: this.cam.y };
      paint = {
        channel: wantFood ? Channel.ToFood : Channel.ToHome,
        x: world.x,
        y: world.y,
      };
      if (this.sim.tick % 4 === 0) this.platform.audio.play("paint", 0.5);
    }

    return { steer, possessAt, release, paint };
  }

  private handleAudioEvents(): void {
    const s = this.sim.stats();
    if (s.playerGathered > this.prevGathered && this.sim.tick % 8 === 0) {
      // Throttle food chimes so a busy colony doesn't buzz.
      this.platform.audio.play("food", 0.4);
    }
    if (s.playerPop > this.prevPop) this.platform.audio.play("hatch", 0.5);

    const outcome = this.objectives.evaluate(this.sim).outcome;
    if (!this.endCuePlayed && outcome !== RunOutcome.Playing) {
      this.platform.audio.play(outcome === RunOutcome.Won ? "win" : "lose");
      this.endCuePlayed = true;
    }

    this.prevPop = s.playerPop;
    this.prevGathered = s.playerGathered;
  }
}
