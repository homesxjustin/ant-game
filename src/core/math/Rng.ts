/**
 * Deterministic seeded PRNG (mulberry32). Every source of randomness in the
 * simulation flows through an instance of this so that a given seed + input
 * stream always produces an identical world. That determinism is what makes
 * replays, save-states, automated tests, and future lockstep multiplayer
 * possible — and it is a hard requirement for console certification where a
 * repro must be reproducible. NEVER call Math.random() inside core/sim.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Ensure a non-zero 32-bit state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Random element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Snapshot the internal state (for save/replay). */
  snapshot(): number {
    return this.state;
  }

  /** Restore a previously snapshotted state. */
  restore(state: number): void {
    this.state = state | 0;
  }
}
