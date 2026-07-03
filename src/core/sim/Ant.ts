import { Caste, AntState, Faction } from "./types";
import type { Vec2 } from "../math/Vec2";

/**
 * A single ant. Kept deliberately as plain mutable data plus a few helpers;
 * all decision-making lives in Simulation so update order stays explicit and
 * deterministic. Ants are pooled and reused (see Simulation) — `alive`
 * distinguishes a live ant from a free slot.
 */
export class Ant {
  id: number;
  faction: Faction;
  caste: Caste;
  state: AntState;

  x: number;
  y: number;
  heading: number; // radians
  speed: number;

  health: number;
  maxHealth: number;
  age: number;
  carrying: number; // food units held

  alive: boolean;

  /** Ants briefly ignore their own just-dropped scent to avoid U-turns. */
  depositCooldown: number;
  /** Set when the player possesses this ant; drives Possessed state. */
  possessed: boolean;

  constructor(id: number) {
    this.id = id;
    this.faction = Faction.Player;
    this.caste = Caste.Worker;
    this.state = AntState.Forage;
    this.x = 0;
    this.y = 0;
    this.heading = 0;
    this.speed = 0;
    this.health = 1;
    this.maxHealth = 1;
    this.age = 0;
    this.carrying = 0;
    this.alive = false;
    this.depositCooldown = 0;
    this.possessed = false;
  }

  pos(): Vec2 {
    return { x: this.x, y: this.y };
  }

  isCombatant(): boolean {
    return this.caste === Caste.Soldier;
  }

  reset(id: number, faction: Faction, caste: Caste, x: number, y: number, maxHealth: number): void {
    this.id = id;
    this.faction = faction;
    this.caste = caste;
    this.state = caste === Caste.Queen ? AntState.Rest : AntState.Forage;
    this.x = x;
    this.y = y;
    this.heading = 0;
    this.speed = 0;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.age = 0;
    this.carrying = 0;
    this.alive = true;
    this.depositCooldown = 0;
    this.possessed = false;
  }
}
