/** Shared enums and lightweight data types for the simulation. */

export enum Caste {
  Queen = "queen",
  Worker = "worker",
  Soldier = "soldier",
  Scout = "scout",
}

export enum AntState {
  /** Leaving nest, hunting for food, following TO_FOOD scent. */
  Forage = "forage",
  /** Carrying food home, following TO_HOME scent. */
  Return = "return",
  /** Moving toward a known threat / attack target. */
  Attack = "attack",
  /** Directly driven by the player (possession). */
  Possessed = "possessed",
  /** Idle at nest (nurses, reserves). */
  Rest = "rest",
  Dead = "dead",
}

export enum Faction {
  Player = "player",
  Rival = "rival",
}

export enum BroodStage {
  Egg = "egg",
  Larva = "larva",
  Pupa = "pupa",
}

export interface Brood {
  id: number;
  stage: BroodStage;
  /** Seconds remaining in the current stage. */
  timer: number;
  /** Caste this brood will become on hatching. */
  caste: Caste;
}

/** A depletable food source in the world. */
export interface FoodSource {
  id: number;
  x: number;
  y: number;
  /** Remaining nutrition units. */
  amount: number;
  /** Original amount, for rendering scale. */
  capacity: number;
  kind: "seed" | "sugar" | "crumb" | "aphid";
}

/** Immutable-ish description of the world bounds. */
export interface WorldBounds {
  width: number;
  height: number;
}
