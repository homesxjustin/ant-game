/**
 * Visual-only terrain heightfield. The simulation is a 2D plane (sim x,y); the
 * 3D presentation lifts it onto gently rolling ground so the world reads as an
 * "alien landscape" rather than a flat table. Height is a cheap, deterministic
 * function of world (x, z) so the renderer, the camera rig, and prop placement
 * all agree on where the ground is without sharing state.
 *
 * Coordinate convention for the whole 3D layer:
 *   sim.x  → world.x        (east/west)
 *   sim.y  → world.z        (north/south)
 *   world.y is UP (height), and is never part of the simulation.
 */
export class Terrain {
  readonly amplitude: number;
  private readonly w: number;
  private readonly h: number;

  constructor(worldWidth: number, worldHeight: number, amplitude = 10) {
    this.w = worldWidth;
    this.h = worldHeight;
    this.amplitude = amplitude;
  }

  /** Ground height at a world (x, z). Smooth, seamless, bounded by amplitude. */
  heightAt(x: number, z: number): number {
    const u = x / this.w;
    const v = z / this.h;
    // Layered sines → soft rolling hills. Coefficients chosen so nests (near
    // the middle band) sit on relatively flat ground.
    const a =
      Math.sin(u * Math.PI * 3.0) * 0.5 +
      Math.sin(v * Math.PI * 2.3 + 1.7) * 0.5 +
      Math.sin((u + v) * Math.PI * 4.1 + 0.4) * 0.25 +
      Math.sin((u - v) * Math.PI * 5.7 + 2.1) * 0.2;
    // Normalise by the sum of coefficients so `amplitude` is a true bound.
    return (a / 1.45) * this.amplitude;
  }

  /** Approximate surface normal via finite differences (for lighting/orient). */
  normalAt(x: number, z: number): [number, number, number] {
    const e = 4;
    const hL = this.heightAt(x - e, z);
    const hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e);
    const hU = this.heightAt(x, z + e);
    const nx = hL - hR;
    const nz = hD - hU;
    const ny = 2 * e;
    const len = Math.hypot(nx, ny, nz) || 1;
    return [nx / len, ny / len, nz / len];
  }
}
