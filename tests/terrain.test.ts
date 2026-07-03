import { describe, it, expect } from "vitest";
import { Terrain } from "../src/game/Terrain";

describe("Terrain", () => {
  it("is deterministic for the same coordinates", () => {
    const a = new Terrain(2400, 1600, 10);
    const b = new Terrain(2400, 1600, 10);
    for (let i = 0; i < 50; i++) {
      const x = i * 37;
      const z = i * 53;
      expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
    }
  });

  it("stays within the amplitude bound", () => {
    const t = new Terrain(2400, 1600, 10);
    for (let x = 0; x <= 2400; x += 60) {
      for (let z = 0; z <= 1600; z += 60) {
        const h = t.heightAt(x, z);
        expect(Math.abs(h)).toBeLessThanOrEqual(10 + 1e-6);
      }
    }
  });

  it("varies across the map (not flat)", () => {
    const t = new Terrain(2400, 1600, 10);
    const a = t.heightAt(100, 100);
    const b = t.heightAt(1200, 800);
    expect(a).not.toBeCloseTo(b, 3);
  });

  it("returns a unit-length normal", () => {
    const t = new Terrain(2400, 1600, 10);
    const [nx, ny, nz] = t.normalAt(613, 421);
    expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
    expect(ny).toBeGreaterThan(0); // ground faces up
  });
});
