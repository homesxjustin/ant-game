/**
 * Public surface of the platform-agnostic simulation core. The game and
 * platform layers import only from here. Nothing under core/ references the
 * DOM, Web APIs, or any device — it is pure TypeScript and runs identically in
 * a browser, in Node (tests), or embedded in a native console shell.
 */
export { Simulation, EMPTY_COMMANDS } from "./sim/Simulation";
export type { SimCommands, SimStats } from "./sim/Simulation";
export { Colony } from "./sim/Colony";
export { Ant } from "./sim/Ant";
export { PheromoneField, Channel, CHANNEL_COUNT } from "./sim/Pheromone";
export { DEFAULT_CONFIG } from "./sim/config";
export type { SimConfig } from "./sim/config";
export { Caste, AntState, Faction, BroodStage } from "./sim/types";
export type { FoodSource, Brood, WorldBounds } from "./sim/types";
export { Rng } from "./math/Rng";
export * as Vec2 from "./math/Vec2";
