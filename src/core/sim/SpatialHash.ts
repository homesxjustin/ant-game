/**
 * Uniform-grid spatial hash for broad-phase neighbour queries. Rebuilt each
 * tick from the live ant list. Keeps combat and food-sensing near O(n) instead
 * of O(n²), which is what lets the colony scale into the thousands. Stores ant
 * indices (into the caller's array) rather than references to stay allocation-
 * light and serialization-friendly.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: number[][];

  constructor(worldW: number, worldH: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(worldW / cellSize));
    this.rows = Math.max(1, Math.ceil(worldH / cellSize));
    this.cells = new Array(this.cols * this.rows);
    for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
  }

  clear(): void {
    for (let i = 0; i < this.cells.length; i++) this.cells[i].length = 0;
  }

  private cellIndex(x: number, y: number): number {
    let cx = Math.floor(x / this.cellSize);
    let cy = Math.floor(y / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(index: number, x: number, y: number): void {
    this.cells[this.cellIndex(x, y)].push(index);
  }

  /**
   * Invoke `fn` for every stored index within the 3×3 cell block around
   * (x, y). Callers do the exact distance test themselves.
   */
  queryNeighbors(x: number, y: number, fn: (index: number) => void): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let oy = -1; oy <= 1; oy++) {
      const ny = cy + oy;
      if (ny < 0 || ny >= this.rows) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox;
        if (nx < 0 || nx >= this.cols) continue;
        const bucket = this.cells[ny * this.cols + nx];
        for (let k = 0; k < bucket.length; k++) fn(bucket[k]);
      }
    }
  }
}
