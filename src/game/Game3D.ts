import { Simulation, Faction, Channel, type SimCommands } from "../core";
import type { Host3D } from "../platform/Host3D";
import { GameAction } from "../platform/InputSource";
import { Terrain } from "./Terrain";
import { WorldView3D } from "./WorldView3D";
import { CameraRig } from "./CameraRig";
import { HudDom } from "./HudDom";
import { ObjectiveTracker, RunOutcome } from "./Objectives";

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 6;

/**
 * 3D game controller. Same responsibilities as the 2D `Game` — own the
 * deterministic simulation, run the fixed-step accumulator, translate abstract
 * input into `SimCommands` — but presents through the Three.js stack
 * (WorldView3D + CameraRig) and a DOM HUD. The simulation is byte-for-byte the
 * same code as the 2D edition; only the presentation layer differs, which is
 * exactly the seam that lets the game target multiple renderers/platforms.
 */
export class Game3D {
  private readonly host: Host3D;
  private sim: Simulation;
  private terrain: Terrain;
  private view: WorldView3D;
  private rig: CameraRig;
  private readonly hud: HudDom;
  private readonly objectives = new ObjectiveTracker();

  private accumulator = 0;
  private paused = false;
  private seed: number;
  private prevGathered = 0;
  private prevPop = 0;
  private endCuePlayed = false;
  private prevPointerDown = false;
  private stop: (() => void) | null = null;

  constructor(host: Host3D, seed = Date.now() & 0xffffff) {
    this.host = host;
    this.seed = seed;
    this.sim = new Simulation(seed);
    this.terrain = new Terrain(this.sim.cfg.world.width, this.sim.cfg.world.height);
    this.view = new WorldView3D(this.host.surface.canvas, this.sim, this.terrain);
    this.rig = new CameraRig(
      this.view.camera,
      this.terrain,
      this.sim.cfg.world.width,
      this.sim.cfg.world.height,
      { x: this.sim.colonies[Faction.Player].nestX, z: this.sim.colonies[Faction.Player].nestY },
    );
    this.hud = new HudDom(document.body);
    this.syncViewport();
  }

  start(): void {
    this.stop = this.host.onFrame((dt) => this.frame(dt));
  }

  dispose(): void {
    this.stop?.();
    this.stop = null;
  }

  debugStats() {
    return this.sim.stats();
  }

  private syncViewport(): void {
    this.view.resize(this.host.surface.width, this.host.surface.height);
  }

  private restart(): void {
    this.seed = (this.seed * 1103515245 + 12345) & 0xffffff;
    this.sim = new Simulation(this.seed);
    this.terrain = new Terrain(this.sim.cfg.world.width, this.sim.cfg.world.height);
    // Rebuild the 3D view against the fresh world. The old view's canvas is
    // reused; dispose its GL scene by dropping the reference (GC) — acceptable
    // for a restart which is rare and user-initiated.
    this.view = new WorldView3D(this.host.surface.canvas, this.sim, this.terrain);
    this.rig = new CameraRig(
      this.view.camera,
      this.terrain,
      this.sim.cfg.world.width,
      this.sim.cfg.world.height,
      { x: this.sim.colonies[Faction.Player].nestX, z: this.sim.colonies[Faction.Player].nestY },
    );
    this.syncViewport();
    this.accumulator = 0;
    this.prevGathered = 0;
    this.prevPop = 0;
    this.endCuePlayed = false;
    this.paused = false;
  }

  private frame(dt: number): void {
    const input = this.host.input;
    input.poll();
    this.syncViewport();

    const state = this.objectives.evaluate(this.sim);
    const finished = state.outcome !== RunOutcome.Playing;

    if (input.wasPressed(GameAction.Pause)) this.paused = !this.paused;
    if (input.wasPressed(GameAction.ToggleOverlay)) this.view.toggleOverlay();
    if (input.wasPressed(GameAction.Confirm) && finished) {
      this.host.audio.play("tap");
      this.restart();
      return;
    }

    // Build simulation commands from abstract input (possess/steer/paint).
    const commands = this.buildCommands();

    // Advance the fixed-step simulation.
    if (!this.paused && !finished) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        this.sim.step(FIXED_DT, steps === 0 ? commands : undefined);
        this.accumulator -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    }

    this.handleAudioEvents();

    // Camera update: orbit, zoom, presets, follow/pan.
    const poss = this.sim.possessedAnt();
    const groundSteer = this.rig.isGroundMode && poss != null;
    this.rig.update(dt, {
      // In ground+possess mode WASD steers the ant, so don't also pan.
      move: groundSteer ? { x: 0, y: 0 } : input.moveAxis(),
      orbit:
        (input.isDown(GameAction.OrbitLeft) ? -1 : 0) +
        (input.isDown(GameAction.OrbitRight) ? 1 : 0),
      zoom:
        input.zoomDelta() +
        (input.isDown(GameAction.ZoomIn) ? dt * 3 : 0) -
        (input.isDown(GameAction.ZoomOut) ? dt * 3 : 0),
      preset: input.wasPressed(GameAction.PerspGround)
        ? 0
        : input.wasPressed(GameAction.PerspColony)
          ? 1
          : input.wasPressed(GameAction.PerspEcosystem)
            ? 2
            : null,
      possessed: poss,
    });

    if (input.wasPressed(GameAction.Recenter)) {
      const anchor = poss ?? null;
      const nest = this.sim.colonies[Faction.Player];
      this.rig.recenter(anchor ? anchor.x : nest.nestX, anchor ? anchor.y : nest.nestY);
    }

    // Render.
    this.view.sync();
    this.view.render();
    this.hud.update(this.sim.stats(), state, {
      paused: this.paused,
      overlay: this.view.overlayVisible,
      possessing: poss != null,
      mode: this.rig.modeLabel,
    });
  }

  private buildCommands(): SimCommands {
    const input = this.host.input;
    const poss = this.sim.possessedAnt();
    const view = this.host.surface;

    let possessAt: SimCommands["possessAt"] = null;
    let release = false;

    // Release on R (or gamepad B).
    if (input.wasPressed(GameAction.Release) && poss) {
      release = true;
      this.host.audio.play("release");
    }

    // Possess: left-click (raycast to ground) or gamepad A (nearest to focus).
    const ptr = input.pointer();
    const clickEdge = !!ptr?.down && !this.prevPointerDown;
    this.prevPointerDown = !!ptr?.down;
    if (!poss && (clickEdge || input.wasPressed(GameAction.Possess))) {
      const world =
        ptr && clickEdge
          ? this.rig.screenToGround(ptr.x, ptr.y, view.width, view.height)
          : this.rig.focusSim();
      if (world) {
        possessAt = world;
        this.host.audio.play("possess");
      }
    }

    // Steer the possessed ant with WASD/stick when in ground mode.
    let steer: SimCommands["steer"] = null;
    if (poss && this.rig.isGroundMode) {
      const ax = input.moveAxis();
      if (ax.x !== 0 || ax.y !== 0) {
        // Convert screen-relative WASD into world steering aligned with the
        // camera so "W" always means "away from camera".
        steer = this.cameraRelativeSteer(ax);
      }
    }

    // Paint pheromone at the cursor (raycast) while F/H held.
    let paint: SimCommands["paint"] = null;
    const wantFood = input.isDown(GameAction.PaintFood);
    const wantHome = input.isDown(GameAction.PaintHome);
    if (wantFood || wantHome) {
      const world = ptr
        ? this.rig.screenToGround(ptr.x, ptr.y, view.width, view.height)
        : this.rig.focusSim();
      if (world) {
        paint = { channel: wantFood ? Channel.ToFood : Channel.ToHome, x: world.x, y: world.y };
        if (this.sim.tick % 4 === 0) this.host.audio.play("paint", 0.5);
      }
    }

    return { steer, possessAt, release, paint };
  }

  /** Map WASD (screen-relative) to a world-space steering vector using the
   * camera yaw, so controls feel natural regardless of orbit. */
  private cameraRelativeSteer(ax: { x: number; y: number }): { x: number; y: number } {
    const yaw = this.rig.yaw;
    const fx = Math.cos(yaw);
    const fz = Math.sin(yaw);
    // forward = -move.y along yaw; right = +move.x perpendicular.
    const x = fx * -ax.y + Math.cos(yaw + Math.PI / 2) * ax.x;
    const y = fz * -ax.y + Math.sin(yaw + Math.PI / 2) * ax.x;
    return { x, y };
  }

  private handleAudioEvents(): void {
    const s = this.sim.stats();
    if (s.playerGathered > this.prevGathered && this.sim.tick % 8 === 0) {
      this.host.audio.play("food", 0.4);
    }
    if (s.playerPop > this.prevPop) this.host.audio.play("hatch", 0.5);

    const outcome = this.objectives.evaluate(this.sim).outcome;
    if (!this.endCuePlayed && outcome !== RunOutcome.Playing) {
      this.host.audio.play(outcome === RunOutcome.Won ? "win" : "lose");
      this.endCuePlayed = true;
    }
    this.prevPop = s.playerPop;
    this.prevGathered = s.playerGathered;
  }
}
