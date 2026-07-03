/**
 * Pheromone field. The heart of ant behaviour: ants deposit scent into a
 * coarse grid and sense the gradient to navigate. Two independent channels are
 * simulated:
 *
 *   - TO_HOME: dropped by ants leaving the nest; followed by loaded ants
 *     trying to get back.
 *   - TO_FOOD: dropped by ants returning with food; followed by foragers
 *     looking for a source.
 *
 * The grid is a flat Float32Array for cache-friendly iteration and trivial
 * (de)serialization. Values evaporate every tick so stale trails fade — this
 * is what lets the colony adapt when a food source is exhausted.
 */

export enum Channel {
  ToHome = 0,
  ToFood = 1,
}

export const CHANNEL_COUNT = 2;

export class PheromoneField {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  /** channels[c] is a cols*rows grid, row-major. */
  private readonly channels: Float32Array[];

  constructor(worldW: number, worldH: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(worldW / cellSize));
    this.rows = Math.max(1, Math.ceil(worldH / cellSize));
    this.channels = [];
    for (let c = 0; c < CHANNEL_COUNT; c++) {
      this.channels.push(new Float32Array(this.cols * this.rows));
    }
  }

  private index(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  private clampCol(cx: number): number {
    return cx < 0 ? 0 : cx >= this.cols ? this.cols - 1 : cx;
  }

  private clampRow(cy: number): number {
    return cy < 0 ? 0 : cy >= this.rows ? this.rows - 1 : cy;
  }

  colAt(worldX: number): number {
    return this.clampCol(Math.floor(worldX / this.cellSize));
  }

  rowAt(worldY: number): number {
    return this.clampRow(Math.floor(worldY / this.cellSize));
  }

  /** Deposit `amount` into a channel at a world position (saturating). */
  deposit(channel: Channel, worldX: number, worldY: number, amount: number, cap = 255): void {
    const cx = this.colAt(worldX);
    const cy = this.rowAt(worldY);
    const grid = this.channels[channel];
    const i = this.index(cx, cy);
    const v = grid[i] + amount;
    grid[i] = v > cap ? cap : v;
  }

  read(channel: Channel, worldX: number, worldY: number): number {
    return this.channels[channel][this.index(this.colAt(worldX), this.rowAt(worldY))];
  }

  readCell(channel: Channel, cx: number, cy: number): number {
    return this.channels[channel][this.index(this.clampCol(cx), this.clampRow(cy))];
  }

  /**
   * Sample the local gradient of a channel around a world position by probing
   * a ring of directions. Returns the world-space direction of strongest
   * scent, weighted by intensity, plus the peak value found. Callers blend
   * this with their own heading to produce trail-following without hard locks.
   */
  sampleDirection(
    channel: Channel,
    worldX: number,
    worldY: number,
    headingRad: number,
    fovRad: number,
    senseRadius: number,
    samples = 5,
  ): { dx: number; dy: number; strength: number } {
    let bestX = 0;
    let bestY = 0;
    let total = 0;
    const half = fovRad / 2;
    for (let s = 0; s < samples; s++) {
      const t = samples === 1 ? 0.5 : s / (samples - 1);
      const ang = headingRad - half + t * fovRad;
      const px = worldX + Math.cos(ang) * senseRadius;
      const py = worldY + Math.sin(ang) * senseRadius;
      const v = this.read(channel, px, py);
      if (v > 0) {
        bestX += Math.cos(ang) * v;
        bestY += Math.sin(ang) * v;
        total += v;
      }
    }
    if (total <= 0) return { dx: 0, dy: 0, strength: 0 };
    const l = Math.hypot(bestX, bestY) || 1;
    return { dx: bestX / l, dy: bestY / l, strength: total / samples };
  }

  /**
   * Evaporate + lightly diffuse. Diffusion is a cheap 4-neighbour blur applied
   * in-place from a scratch copy so trails widen and soften over time.
   * `dt` scales evaporation so behaviour is frame-rate independent.
   */
  update(dt: number, evaporation: number, diffusion: number): void {
    const decay = Math.max(0, 1 - evaporation * dt);
    for (let c = 0; c < CHANNEL_COUNT; c++) {
      const grid = this.channels[c];
      // Evaporate.
      for (let i = 0; i < grid.length; i++) {
        const v = grid[i] * decay;
        grid[i] = v < 0.05 ? 0 : v;
      }
      // Diffuse (optional; skipped when diffusion≈0 to save cycles).
      if (diffusion > 0) {
        this.diffuse(grid, diffusion * dt);
      }
    }
  }

  private diffuse(grid: Float32Array, k: number): void {
    const { cols, rows } = this;
    // Simple separable-ish box blend using a scratch buffer.
    const scratch = grid.slice();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const c = scratch[i];
        const l = x > 0 ? scratch[i - 1] : c;
        const r = x < cols - 1 ? scratch[i + 1] : c;
        const u = y > 0 ? scratch[i - cols] : c;
        const d = y < rows - 1 ? scratch[i + cols] : c;
        const avg = (l + r + u + d) * 0.25;
        grid[i] = c + (avg - c) * k;
      }
    }
  }

  /** Read-only access to a channel grid for rendering. */
  raw(channel: Channel): Float32Array {
    return this.channels[channel];
  }

  clear(): void {
    for (const g of this.channels) g.fill(0);
  }
}
