import { Brood, BroodStage, Caste, Faction } from "./types";

/**
 * Colony-level state: the nest location, stored food, brood pipeline, and
 * simple population bookkeeping. One instance per faction. The player commands
 * the Player colony; the AI drives the Rival colony with the same rules.
 */
export class Colony {
  faction: Faction;
  nestX: number;
  nestY: number;
  food: number;
  brood: Brood[] = [];
  /** Live adult counts, refreshed each tick by the Simulation. */
  population = 0;
  soldiers = 0;
  /** Cumulative food ever gathered — a progression / scoring signal. */
  totalGathered = 0;
  /** Seconds until the queen may lay the next egg. */
  eggCooldown = 0;
  private nextBroodId = 1;

  constructor(faction: Faction, nestX: number, nestY: number, startFood: number) {
    this.faction = faction;
    this.nestX = nestX;
    this.nestY = nestY;
    this.food = startFood;
  }

  addFood(amount: number): void {
    this.food += amount;
    this.totalGathered += amount;
  }

  layEgg(caste: Caste, eggTime: number): void {
    this.brood.push({
      id: this.nextBroodId++,
      stage: BroodStage.Egg,
      timer: eggTime,
      caste,
    });
  }

  get broodCount(): number {
    return this.brood.length;
  }
}
