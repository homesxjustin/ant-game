import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/math/Rng";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it("stays within [0,1)", () => {
    const r = new Rng(99);
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("snapshots and restores state", () => {
    const r = new Rng(7);
    for (let i = 0; i < 10; i++) r.next();
    const snap = r.snapshot();
    const expected = [r.next(), r.next(), r.next()];
    r.restore(snap);
    expect([r.next(), r.next(), r.next()]).toEqual(expected);
  });

  it("int() respects inclusive bounds", () => {
    const r = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
