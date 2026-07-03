import { Rng } from "../math/Rng";
import type { Vec2 } from "../math/Vec2";
import { Ant } from "./Ant";
import { Colony } from "./Colony";
import { PheromoneField, Channel } from "./Pheromone";
import { SpatialHash } from "./SpatialHash";
import { DEFAULT_CONFIG, SimConfig } from "./config";
import { AntState, BroodStage, Caste, Faction, FoodSource } from "./types";

/**
 * Abstract player intent for one simulation step. The platform layer maps
 * device input (keyboard, mouse, gamepad, touch) into these fields; the
 * simulation never reads a device directly. This is the seam that keeps the
 * core portable across PC and console.
 */
export interface SimCommands {
  /** Desired steering for the possessed ant, world-space, magnitude 0..1. */
  steer: Vec2 | null;
  /** Request to possess the player ant nearest this world point. */
  possessAt: Vec2 | null;
  /** Release the currently possessed ant back to the AI. */
  release: boolean;
  /** Manually paint a pheromone trail at a world point. */
  paint: { channel: Channel; x: number; y: number } | null;
}

export const EMPTY_COMMANDS: SimCommands = {
  steer: null,
  possessAt: null,
  release: false,
  paint: null,
};

export interface SimStats {
  tick: number;
  simTime: number;
  playerPop: number;
  playerSoldiers: number;
  playerBrood: number;
  playerFood: number;
  playerGathered: number;
  rivalPop: number;
  foodRemaining: number;
}

/**
 * The authoritative game world. Advances by a FIXED timestep only (see
 * `step`); the platform layer is responsible for accumulating real time and
 * calling `step` the right number of times. Fixed-step + seeded RNG =
 * deterministic, which underpins replays, saves, and future lockstep netplay.
 */
export class Simulation {
  readonly cfg: SimConfig;
  readonly rng: Rng;
  readonly pheromones: PheromoneField;
  readonly colonies: Record<Faction, Colony>;
  food: FoodSource[] = [];

  /** Dense pool of ant slots; iterate with `for..alive`. */
  private ants: Ant[] = [];
  private freeSlots: number[] = [];
  private hash: SpatialHash;
  private nextAntId = 1;
  private nextFoodId = 1;

  tick = 0;
  simTime = 0;
  possessedId: number | null = null;

  constructor(seed = 1, config: Partial<SimConfig> = {}) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };
    this.rng = new Rng(seed);
    this.pheromones = new PheromoneField(
      this.cfg.world.width,
      this.cfg.world.height,
      this.cfg.pheromone.cellSize,
    );
    this.hash = new SpatialHash(this.cfg.world.width, this.cfg.world.height, 24);

    const w = this.cfg.world.width;
    const h = this.cfg.world.height;
    this.colonies = {
      [Faction.Player]: new Colony(Faction.Player, w * 0.28, h * 0.5, this.cfg.colony.startFood),
      [Faction.Rival]: new Colony(Faction.Rival, w * 0.74, h * 0.52, this.cfg.colony.startFood),
    };

    this.seedWorld();
  }

  // ---- world setup ---------------------------------------------------------

  private seedWorld(): void {
    const { spawn } = this.cfg;

    // Queens.
    this.spawnAnt(Faction.Player, Caste.Queen, this.colonies[Faction.Player].nestX, this.colonies[Faction.Player].nestY);
    this.spawnAnt(Faction.Rival, Caste.Queen, this.colonies[Faction.Rival].nestX, this.colonies[Faction.Rival].nestY);

    // Starting workers.
    for (let i = 0; i < this.cfg.colony.startWorkers; i++) {
      this.spawnAntAtNest(Faction.Player, Caste.Worker);
    }
    for (let i = 0; i < spawn.rivalWorkers; i++) {
      this.spawnAntAtNest(Faction.Rival, i % 4 === 0 ? Caste.Soldier : Caste.Worker);
    }

    // Food sources scattered, biased away from either nest.
    for (let i = 0; i < spawn.foodSources; i++) {
      this.spawnFood();
    }
  }

  private spawnFood(): void {
    const { world, spawn } = this.cfg;
    const margin = 60;
    let x = 0;
    let y = 0;
    // Rejection-sample to keep food off the exact nest tiles.
    for (let attempt = 0; attempt < 8; attempt++) {
      x = this.rng.range(margin, world.width - margin);
      y = this.rng.range(margin, world.height - margin);
      const dp = Math.hypot(x - this.colonies[Faction.Player].nestX, y - this.colonies[Faction.Player].nestY);
      const dr = Math.hypot(x - this.colonies[Faction.Rival].nestX, y - this.colonies[Faction.Rival].nestY);
      if (dp > 120 && dr > 120) break;
    }
    const amount = this.rng.range(spawn.foodAmountMin, spawn.foodAmountMax);
    const kinds: FoodSource["kind"][] = ["seed", "sugar", "crumb", "aphid"];
    this.food.push({
      id: this.nextFoodId++,
      x,
      y,
      amount,
      capacity: amount,
      kind: this.rng.pick(kinds),
    });
  }

  // ---- ant pool ------------------------------------------------------------

  private spawnAnt(faction: Faction, caste: Caste, x: number, y: number): Ant {
    const maxHealth =
      caste === Caste.Queen
        ? this.cfg.ant.maxHealth * 6
        : caste === Caste.Soldier
          ? this.cfg.ant.maxHealth * 1.8
          : this.cfg.ant.maxHealth;

    let ant: Ant;
    if (this.freeSlots.length > 0) {
      const slot = this.freeSlots.pop()!;
      ant = this.ants[slot];
      ant.reset(this.nextAntId++, faction, caste, x, y, maxHealth);
    } else {
      ant = new Ant(this.nextAntId++);
      ant.reset(ant.id, faction, caste, x, y, maxHealth);
      this.ants.push(ant);
    }
    ant.heading = this.rng.range(-Math.PI, Math.PI);
    return ant;
  }

  private spawnAntAtNest(faction: Faction, caste: Caste): Ant {
    const c = this.colonies[faction];
    const a = this.rng.range(-Math.PI, Math.PI);
    const r = this.rng.range(6, 24);
    return this.spawnAnt(faction, caste, c.nestX + Math.cos(a) * r, c.nestY + Math.sin(a) * r);
  }

  private killAnt(ant: Ant, slot: number): void {
    ant.alive = false;
    ant.state = AntState.Dead;
    if (this.possessedId === ant.id) this.possessedId = null;
    this.freeSlots.push(slot);
  }

  // ---- public queries (for renderer / HUD / AI) ----------------------------

  get allAnts(): readonly Ant[] {
    return this.ants;
  }

  livingAnts(): Ant[] {
    return this.ants.filter((a) => a.alive);
  }

  getAnt(id: number): Ant | null {
    for (const a of this.ants) if (a.alive && a.id === id) return a;
    return null;
  }

  possessedAnt(): Ant | null {
    return this.possessedId != null ? this.getAnt(this.possessedId) : null;
  }

  stats(): SimStats {
    const p = this.colonies[Faction.Player];
    const r = this.colonies[Faction.Rival];
    let foodRemaining = 0;
    for (const f of this.food) foodRemaining += f.amount;
    return {
      tick: this.tick,
      simTime: this.simTime,
      playerPop: p.population,
      playerSoldiers: p.soldiers,
      playerBrood: p.broodCount,
      playerFood: Math.floor(p.food),
      playerGathered: Math.floor(p.totalGathered),
      rivalPop: r.population,
      foodRemaining: Math.floor(foodRemaining),
    };
  }

  // ---- main step -----------------------------------------------------------

  /**
   * Advance the world by exactly `dt` seconds (the caller's fixed timestep).
   * Order matters and is fixed for determinism: commands → brood → hash →
   * per-ant behaviour → combat → pheromone field → cleanup.
   */
  step(dt: number, cmd: SimCommands = EMPTY_COMMANDS): void {
    this.tick++;
    this.simTime += dt;

    this.applyCommands(cmd);
    this.updateColonies(dt);
    this.rebuildHash();
    this.updateAnts(dt);
    this.resolveCombat(dt);
    this.pheromones.update(dt, this.cfg.pheromone.evaporation, this.cfg.pheromone.diffusion);
  }

  private applyCommands(cmd: SimCommands): void {
    if (cmd.release) {
      const cur = this.possessedAnt();
      if (cur) {
        cur.possessed = false;
        cur.state = AntState.Forage;
      }
      this.possessedId = null;
    }

    if (cmd.possessAt) {
      const target = this.nearestPlayerAnt(cmd.possessAt.x, cmd.possessAt.y);
      if (target && target.caste !== Caste.Queen) {
        const prev = this.possessedAnt();
        if (prev) prev.possessed = false;
        target.possessed = true;
        target.state = AntState.Possessed;
        this.possessedId = target.id;
      }
    }

    if (cmd.paint) {
      // Manual trail painting reinforces a channel strongly at a point.
      this.pheromones.deposit(cmd.paint.channel, cmd.paint.x, cmd.paint.y, 180);
    }

    // Steering for the possessed ant is consumed in updateAnts via this field.
    this.pendingSteer = cmd.steer;
  }

  private pendingSteer: Vec2 | null = null;

  private nearestPlayerAnt(x: number, y: number): Ant | null {
    let best: Ant | null = null;
    let bestD = Infinity;
    for (const a of this.ants) {
      if (!a.alive || a.faction !== Faction.Player || a.caste === Caste.Queen) continue;
      const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  // ---- colony / brood / population ----------------------------------------

  private updateColonies(dt: number): void {
    // Recount population first (used for upkeep + AI + HUD).
    for (const f of [Faction.Player, Faction.Rival]) {
      const c = this.colonies[f];
      c.population = 0;
      c.soldiers = 0;
    }
    for (const a of this.ants) {
      if (!a.alive || a.caste === Caste.Queen) continue;
      const c = this.colonies[a.faction];
      c.population++;
      if (a.caste === Caste.Soldier) c.soldiers++;
    }

    for (const faction of [Faction.Player, Faction.Rival]) {
      const c = this.colonies[faction];

      // Upkeep: adults consume stored food. Starvation stalls new brood.
      c.food = Math.max(0, c.food - c.population * this.cfg.colony.upkeepPerAnt * dt);

      // Advance brood pipeline.
      for (let i = c.brood.length - 1; i >= 0; i--) {
        const b = c.brood[i];
        b.timer -= dt;
        if (b.timer > 0) continue;
        if (b.stage === BroodStage.Egg) {
          b.stage = BroodStage.Larva;
          b.timer = this.cfg.colony.larvaTime;
        } else if (b.stage === BroodStage.Larva) {
          b.stage = BroodStage.Pupa;
          b.timer = this.cfg.colony.pupaTime;
        } else {
          // Pupa → adult.
          c.brood.splice(i, 1);
          this.spawnAntAtNest(faction, b.caste);
        }
      }

      // Queen lays eggs when fed and cooldown elapsed.
      c.eggCooldown -= dt;
      if (c.eggCooldown <= 0 && c.food >= this.cfg.colony.eggFoodCost) {
        c.food -= this.cfg.colony.eggFoodCost;
        c.eggCooldown = this.cfg.colony.eggInterval;
        const caste = this.rng.chance(this.cfg.colony.soldierRatio) ? Caste.Soldier : Caste.Worker;
        c.layEgg(caste, this.cfg.colony.eggTime);
      }
    }
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      if (a.alive) this.hash.insert(i, a.x, a.y);
    }
  }

  // ---- ant behaviour -------------------------------------------------------

  private updateAnts(dt: number): void {
    const cfg = this.cfg.ant;
    for (let slot = 0; slot < this.ants.length; slot++) {
      const ant = this.ants[slot];
      if (!ant.alive) continue;

      ant.age += dt;
      if (ant.depositCooldown > 0) ant.depositCooldown -= dt;

      // Natural death from old age (workers/scouts only).
      if (ant.caste !== Caste.Queen && ant.caste !== Caste.Soldier && ant.age > cfg.lifespan) {
        this.killAnt(ant, slot);
        continue;
      }

      switch (ant.caste) {
        case Caste.Queen:
          // Queens stay put near the nest.
          break;
        case Caste.Soldier:
          this.updateSoldier(ant, dt);
          break;
        default:
          if (ant.possessed) this.updatePossessed(ant, dt);
          else this.updateForager(ant, dt);
          break;
      }
    }
  }

  private moveAnt(ant: Ant, desiredHeading: number, dt: number, speedScale = 1): void {
    const cfg = this.cfg.ant;
    // Rotate toward desired heading at a bounded turn rate.
    let diff = desiredHeading - ant.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = cfg.turnRate * dt;
    ant.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

    ant.speed = cfg.speed * speedScale;
    ant.x += Math.cos(ant.heading) * ant.speed * dt;
    ant.y += Math.sin(ant.heading) * ant.speed * dt;

    // Bounce off world bounds so ants never escape.
    const r = cfg.radius;
    const w = this.cfg.world.width;
    const h = this.cfg.world.height;
    if (ant.x < r) {
      ant.x = r;
      ant.heading = Math.PI - ant.heading;
    } else if (ant.x > w - r) {
      ant.x = w - r;
      ant.heading = Math.PI - ant.heading;
    }
    if (ant.y < r) {
      ant.y = r;
      ant.heading = -ant.heading;
    } else if (ant.y > h - r) {
      ant.y = h - r;
      ant.heading = -ant.heading;
    }
  }

  private wanderHeading(ant: Ant): number {
    return ant.heading + this.rng.range(-1, 1) * this.cfg.ant.wanderStrength * 0.1;
  }

  private updateForager(ant: Ant, dt: number): void {
    const cfg = this.cfg.ant;
    const ph = this.cfg.pheromone;
    const colony = this.colonies[ant.faction];

    if (ant.state === AntState.Forage) {
      // Deposit "to home" so returning ants (and this ant later) can backtrack.
      if (ant.depositCooldown <= 0) {
        this.pheromones.deposit(Channel.ToHome, ant.x, ant.y, ph.depositForage * dt * 10);
      }

      // Look for nearby food directly.
      const target = this.findFoodNear(ant.x, ant.y, cfg.senseFoodRadius);
      if (target) {
        const d = Math.hypot(target.x - ant.x, target.y - ant.y);
        if (d <= cfg.pickupRadius && target.amount > 0) {
          const take = Math.min(cfg.carryCapacity, target.amount);
          target.amount -= take;
          ant.carrying = take;
          ant.state = AntState.Return;
          ant.depositCooldown = 0.15;
          // Turn around toward home.
          ant.heading = Math.atan2(colony.nestY - ant.y, colony.nestX - ant.x);
          return;
        }
        this.moveAnt(ant, Math.atan2(target.y - ant.y, target.x - ant.x), dt);
        return;
      }

      // Otherwise follow the food trail, blended with wander.
      const g = this.pheromones.sampleDirection(
        Channel.ToFood,
        ant.x,
        ant.y,
        ant.heading,
        ph.fovRad,
        ph.senseRadius,
      );
      if (g.strength > 0.5) {
        const trailHeading = Math.atan2(g.dy, g.dx);
        const blended = this.blendHeadings(trailHeading, this.wanderHeading(ant), 0.7);
        this.moveAnt(ant, blended, dt);
      } else {
        this.moveAnt(ant, this.wanderHeading(ant), dt);
      }
      return;
    }

    // Returning home with food.
    if (ant.state === AntState.Return) {
      if (ant.depositCooldown <= 0) {
        this.pheromones.deposit(Channel.ToFood, ant.x, ant.y, ph.depositReturn * dt * 10);
      }
      const dNest = Math.hypot(colony.nestX - ant.x, colony.nestY - ant.y);
      if (dNest <= cfg.dropRadius) {
        colony.addFood(ant.carrying);
        ant.carrying = 0;
        ant.state = AntState.Forage;
        ant.depositCooldown = 0.15;
        ant.heading += Math.PI; // head back out
        return;
      }
      // Steer home, gently biased by the home trail so ants hug good routes.
      const homeHeading = Math.atan2(colony.nestY - ant.y, colony.nestX - ant.x);
      const g = this.pheromones.sampleDirection(
        Channel.ToHome,
        ant.x,
        ant.y,
        ant.heading,
        ph.fovRad,
        ph.senseRadius,
      );
      const desired =
        g.strength > 0.5
          ? this.blendHeadings(homeHeading, Math.atan2(g.dy, g.dx), 0.75)
          : homeHeading;
      this.moveAnt(ant, desired, dt);
    }
  }

  private updateSoldier(ant: Ant, dt: number): void {
    const colony = this.colonies[ant.faction];

    // Seek the nearest enemy within a generous radius.
    let enemy: Ant | null = null;
    let bestD = 90 * 90;
    this.hash.queryNeighbors(ant.x, ant.y, (idx) => {
      const o = this.ants[idx];
      if (!o.alive || o.faction === ant.faction || o.caste === Caste.Queen) return;
      const d = (o.x - ant.x) * (o.x - ant.x) + (o.y - ant.y) * (o.y - ant.y);
      if (d < bestD) {
        bestD = d;
        enemy = o;
      }
    });

    if (enemy) {
      const e = enemy as Ant;
      ant.state = AntState.Attack;
      this.moveAnt(ant, Math.atan2(e.y - ant.y, e.x - ant.x), dt, 1.15);
      return;
    }

    // No enemy: patrol around the nest, following any attack/home scent.
    ant.state = AntState.Rest;
    const dNest = Math.hypot(colony.nestX - ant.x, colony.nestY - ant.y);
    if (dNest > 220) {
      this.moveAnt(ant, Math.atan2(colony.nestY - ant.y, colony.nestX - ant.x), dt, 0.8);
    } else {
      this.moveAnt(ant, this.wanderHeading(ant), dt, 0.7);
    }
  }

  private updatePossessed(ant: Ant, dt: number): void {
    const cfg = this.cfg.ant;
    const colony = this.colonies[ant.faction];
    const steer = this.pendingSteer;

    if (steer && (steer.x !== 0 || steer.y !== 0)) {
      this.moveAnt(ant, Math.atan2(steer.y, steer.x), dt, 1.25);
    }

    // Possessed ants auto-interact: pick up food / drop at nest like a forager,
    // so direct control feels productive without extra buttons.
    if (ant.carrying <= 0) {
      const target = this.findFoodNear(ant.x, ant.y, cfg.pickupRadius);
      if (target && target.amount > 0) {
        const take = Math.min(cfg.carryCapacity, target.amount);
        target.amount -= take;
        ant.carrying = take;
      }
      // Lay a food trail from where we found it? Only when returning.
      this.pheromones.deposit(Channel.ToHome, ant.x, ant.y, this.cfg.pheromone.depositForage * dt * 8);
    } else {
      this.pheromones.deposit(Channel.ToFood, ant.x, ant.y, this.cfg.pheromone.depositReturn * dt * 8);
      const dNest = Math.hypot(colony.nestX - ant.x, colony.nestY - ant.y);
      if (dNest <= cfg.dropRadius) {
        colony.addFood(ant.carrying);
        ant.carrying = 0;
      }
    }
  }

  private blendHeadings(a: number, b: number, wa: number): number {
    // Blend two angles via unit-vector interpolation to avoid wraparound bugs.
    const x = Math.cos(a) * wa + Math.cos(b) * (1 - wa);
    const y = Math.sin(a) * wa + Math.sin(b) * (1 - wa);
    return Math.atan2(y, x);
  }

  private findFoodNear(x: number, y: number, radius: number): FoodSource | null {
    let best: FoodSource | null = null;
    let bestD = radius * radius;
    for (const f of this.food) {
      if (f.amount <= 0) continue;
      const d = (f.x - x) * (f.x - x) + (f.y - y) * (f.y - y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  // ---- combat --------------------------------------------------------------

  private resolveCombat(dt: number): void {
    const cfg = this.cfg.ant;
    const rangeSq = (cfg.attackRange + cfg.radius) * (cfg.attackRange + cfg.radius);

    for (let slot = 0; slot < this.ants.length; slot++) {
      const a = this.ants[slot];
      if (!a.alive || a.caste === Caste.Queen) continue;

      this.hash.queryNeighbors(a.x, a.y, (idx) => {
        if (idx <= slot) return; // resolve each pair once
        const b = this.ants[idx];
        if (!b.alive || b.faction === a.faction) return;
        const d = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
        if (d > rangeSq) return;

        // Soldiers hit harder; workers still scrap but weakly. Queen is skipped
        // as attacker but can be a victim if reached.
        const aDmg = (a.caste === Caste.Soldier ? cfg.attackDamage : cfg.attackDamage * 0.4) * dt;
        const bDmg = (b.caste === Caste.Soldier ? cfg.attackDamage : cfg.attackDamage * 0.4) * dt;
        a.health -= bDmg;
        b.health -= aDmg;
      });
    }

    // Reap the dead in a second pass so indices stay valid during combat.
    for (let slot = 0; slot < this.ants.length; slot++) {
      const a = this.ants[slot];
      if (a.alive && a.health <= 0) this.killAnt(a, slot);
    }
  }

  // ---- helpers for game layer ---------------------------------------------

  /** Total food across all live sources. */
  totalFoodRemaining(): number {
    let t = 0;
    for (const f of this.food) t += f.amount;
    return t;
  }
}
