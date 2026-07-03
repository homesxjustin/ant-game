import { describe, it, expect } from "vitest";
import { PheromoneField, Channel } from "../src/core/sim/Pheromone";

describe("PheromoneField", () => {
  it("deposits and reads back scent at a location", () => {
    const f = new PheromoneField(200, 200, 10);
    f.deposit(Channel.ToFood, 55, 55, 100);
    expect(f.read(Channel.ToFood, 55, 55)).toBeGreaterThan(0);
    // A far cell is untouched.
    expect(f.read(Channel.ToFood, 5, 5)).toBe(0);
  });

  it("saturates at the cap", () => {
    const f = new PheromoneField(100, 100, 10);
    f.deposit(Channel.ToHome, 15, 15, 1000, 255);
    expect(f.read(Channel.ToHome, 15, 15)).toBe(255);
  });

  it("evaporates over time toward zero", () => {
    const f = new PheromoneField(100, 100, 10);
    f.deposit(Channel.ToFood, 15, 15, 100);
    const before = f.read(Channel.ToFood, 15, 15);
    for (let i = 0; i < 600; i++) f.update(1 / 60, 2.0, 0);
    const after = f.read(Channel.ToFood, 15, 15);
    expect(after).toBeLessThan(before);
    expect(after).toBe(0); // fully evaporated below the floor
  });

  it("channels are independent", () => {
    const f = new PheromoneField(100, 100, 10);
    f.deposit(Channel.ToFood, 25, 25, 100);
    expect(f.read(Channel.ToHome, 25, 25)).toBe(0);
  });

  it("gradient points toward stronger scent", () => {
    const f = new PheromoneField(400, 400, 10);
    // Lay a strong deposit blob to the east of the sample point, centred at
    // exactly one sense-radius away so the sampling ring crosses it.
    for (let dy = -15; dy <= 15; dy += 5) {
      for (let dx = -10; dx <= 10; dx += 5) {
        f.deposit(Channel.ToFood, 250 + dx, 200 + dy, 200);
      }
    }
    const g = f.sampleDirection(Channel.ToFood, 200, 200, 0, Math.PI, 50, 9);
    expect(g.strength).toBeGreaterThan(0);
    expect(g.dx).toBeGreaterThan(0); // eastward
  });
});
