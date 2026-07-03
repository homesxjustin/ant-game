/**
 * Central tuning table. Everything a designer might want to balance lives here
 * so gameplay feel can be iterated without touching simulation logic. Values
 * are in world units (px) and seconds unless noted.
 */
export interface SimConfig {
  world: { width: number; height: number };
  pheromone: {
    cellSize: number;
    evaporation: number; // fraction lost per second
    diffusion: number; // blend factor per second (0 = off)
    depositForage: number; // TO_HOME deposited while foraging
    depositReturn: number; // TO_FOOD deposited while returning
    senseRadius: number;
    fovRad: number;
  };
  ant: {
    radius: number;
    speed: number;
    turnRate: number; // radians/sec toward desired heading
    wanderStrength: number;
    carryCapacity: number;
    pickupRadius: number;
    dropRadius: number; // distance from nest to unload
    maxHealth: number;
    attackDamage: number; // per second in contact
    attackRange: number;
    senseFoodRadius: number;
    lifespan: number; // seconds before natural death (workers)
  };
  colony: {
    startFood: number;
    startWorkers: number;
    /** Food needed to queue one egg. */
    eggFoodCost: number;
    /** Queen lays at most one egg per this many seconds when fed. */
    eggInterval: number;
    eggTime: number;
    larvaTime: number;
    pupaTime: number;
    /** Food consumed by the colony per adult per second (upkeep). */
    upkeepPerAnt: number;
    soldierRatio: number; // fraction of brood that becomes soldiers
  };
  spawn: {
    foodSources: number;
    foodAmountMin: number;
    foodAmountMax: number;
    rivalWorkers: number;
  };
}

export const DEFAULT_CONFIG: SimConfig = {
  world: { width: 2400, height: 1600 },
  pheromone: {
    cellSize: 12,
    evaporation: 0.12,
    diffusion: 0.0,
    depositForage: 28,
    depositReturn: 60,
    senseRadius: 26,
    fovRad: Math.PI * 0.9,
  },
  ant: {
    radius: 3.2,
    speed: 46,
    turnRate: 6.0,
    wanderStrength: 2.4,
    carryCapacity: 1,
    pickupRadius: 8,
    dropRadius: 26,
    maxHealth: 30,
    attackDamage: 22,
    attackRange: 6,
    senseFoodRadius: 46,
    lifespan: 240,
  },
  colony: {
    startFood: 40,
    startWorkers: 12,
    eggFoodCost: 6,
    eggInterval: 1.4,
    eggTime: 8,
    larvaTime: 10,
    pupaTime: 8,
    upkeepPerAnt: 0.012,
    soldierRatio: 0.25,
  },
  spawn: {
    foodSources: 14,
    foodAmountMin: 40,
    foodAmountMax: 140,
    rivalWorkers: 16,
  },
};
