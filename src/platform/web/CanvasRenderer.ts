import type { CameraView, Renderer } from "../Platform";

/**
 * Reference renderer for the PC/web edition, backed by an HTML5 2D canvas.
 * It knows nothing about the game — it only executes the declarative draw
 * calls the game issues. A console edition would provide a different Renderer
 * (e.g. over a native graphics API) implementing the same interface.
 *
 * World↔screen transform is applied via the canvas matrix during the world
 * pass; HUD calls draw in raw device pixels after the matrix is reset.
 */
export class CanvasRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private dpr = 1;
  width = 0;
  height = 0;
  private cam: CameraView | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    this.width = Math.floor(cssWidth * this.dpr);
    this.height = Math.floor(cssHeight * this.dpr);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
  }

  begin(camera: CameraView, background: string): void {
    this.cam = camera;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = background;
    c.fillRect(0, 0, this.width, this.height);

    // Apply camera: translate to screen centre, scale by zoom, offset by cam.
    c.setTransform(
      camera.zoom,
      0,
      0,
      camera.zoom,
      this.width / 2 - camera.x * camera.zoom,
      this.height / 2 - camera.y * camera.zoom,
    );
  }

  drawField(
    grid: Float32Array,
    cols: number,
    rows: number,
    cellSize: number,
    rgb: [number, number, number],
  ): void {
    if (!this.cam) return;
    const c = this.ctx;
    const [r, g, b] = rgb;
    // Only draw cells with meaningful scent; additive-ish via alpha.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y * cols + x];
        if (v < 4) continue;
        const a = Math.min(0.5, v / 255);
        c.fillStyle = `rgba(${r},${g},${b},${a})`;
        c.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  circle(x: number, y: number, r: number, color: string): void {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }

  ant(x: number, y: number, heading: number, r: number, color: string, carrying: boolean): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.rotate(heading);
    c.fillStyle = color;
    // Three body segments for a readable ant silhouette even when tiny.
    c.beginPath();
    c.arc(r * 1.2, 0, r * 0.7, 0, Math.PI * 2); // head
    c.arc(0, 0, r * 0.85, 0, Math.PI * 2); // thorax
    c.arc(-r * 1.4, 0, r, 0, Math.PI * 2); // abdomen
    c.fill();
    if (carrying) {
      c.fillStyle = "#e8d24a";
      c.beginPath();
      c.arc(r * 2.1, 0, r * 0.9, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  ring(x: number, y: number, r: number, color: string, width: number): void {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
  }

  text(
    text: string,
    sx: number,
    sy: number,
    color: string,
    size: number,
    align: "left" | "center" | "right" = "left",
  ): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = color;
    c.font = `${size * this.dpr}px ui-monospace, Menlo, Consolas, monospace`;
    c.textAlign = align;
    c.textBaseline = "top";
    c.fillText(text, sx * this.dpr, sy * this.dpr);
    this.reapplyCamera();
  }

  rect(sx: number, sy: number, w: number, h: number, color: string): void {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = color;
    c.fillRect(sx * this.dpr, sy * this.dpr, w * this.dpr, h * this.dpr);
    this.reapplyCamera();
  }

  private reapplyCamera(): void {
    if (!this.cam) return;
    const cam = this.cam;
    this.ctx.setTransform(
      cam.zoom,
      0,
      0,
      cam.zoom,
      this.width / 2 - cam.x * cam.zoom,
      this.height / 2 - cam.y * cam.zoom,
    );
  }

  end(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Device-pixel ratio, exposed so the game can convert pointer coords. */
  get pixelRatio(): number {
    return this.dpr;
  }
}
