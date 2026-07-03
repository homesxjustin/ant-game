import { describe, it, expect } from "vitest";
import { Simulation } from "../src/core/sim/Simulation";
import { Faction, Caste } from "../src/core/sim/types";

const FIXED_DT = 1 / 60;

function run(sim: Simulation, steps: number): void {
  for (let i = 0; i < steps; i++) sim.step(FIXED_DT);
}

describe("Simulation", () => {
  it("seeds a world with queens, workers, and food", () => {
    const sim = new Simulation(1);
    const living = sim.livingAnts();
    expect(living.length).toBeGreaterThan(10);
    expect(living.some((a) => a.caste === Caste.Queen && a.faction === Faction.Player)).toBe(true);
    expect(sim.food.length).toBeGreaterThan(0);
    expect(sim.totalFoodRemaining()).toBeGreaterThan(0);
  });

  it("is deterministic: same seed + steps => identical stats", () => {
    const a = new Simulation(777);
    const b = new Simulation(777);
    run(a, 1200);
    run(b, 1200);
    expect(a.stats()).toEqual(b.stats());
  });

  it("diverges for different seeds", () => {
    const a = new Simulation(1);
    const b = new Simulation(2);
    run(a, 1200);
    run(b, 1200);
    expect(a.stats()).not.toEqual(b.stats());
  });

  it("gathers food and grows the colony over time", () => {
    const sim = new Simulation(3);
    const startGathered = sim.colonies[Faction.Player].totalGathered;
    const startPop = sim.colonies[Faction.Player].population;
    run(sim, 60 * 60); // ~60 simulated seconds
    const c = sim.colonies[Faction.Player];
    expect(c.totalGathered).toBeGreaterThan(startGathered);
    // Foraging should have fed the queen enough to produce new adults.
    expect(c.population).toBeGreaterThan(startPop);
  });

  it("keeps ants inside the world bounds", () => {
    const sim = new Simulation(5);
    run(sim, 2000);
    for (const a of sim.livingAnts()) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(sim.cfg.world.width);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeLessThanOrEqual(sim.cfg.world.height);
    }
  });

  it("possesses and releases the nearest player ant", () => {
    const sim = new Simulation(9);
    const nest = sim.colonies[Faction.Player];
    sim.step(FIXED_DT, {
      steer: null,
      possessAt: { x: nest.nestX, y: nest.nestY },
      release: false,
      paint: null,
    });
    expect(sim.possessedId).not.toBeNull();
    const possessed = sim.possessedAnt();
    expect(possessed?.caste).not.toBe(Caste.Queen);

    sim.step(FIXED_DT, { steer: null, possessAt: null, release: true, paint: null });
    expect(sim.possessedId).toBeNull();
  });

  it("advances brood from egg to adult and reuses ant slots", () => {
    const sim = new Simulation(11);
    const before = sim.livingAnts().length;
    run(sim, 60 * 90); // long enough for several brood cycles
    const after = sim.livingAnts().length;
    // Population should have changed as brood matured (grew, net of deaths).
    expect(after).not.toBe(before);
    // Slot reuse keeps the backing array from ballooning unbounded.
    expect(sim.allAnts.length).toBeLessThan(after + 400);
  });
});
