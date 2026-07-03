import type { CameraView } from "../platform/Platform";

/**
 * Camera with smooth follow and clamped zoom. Converts between screen (device
 * pixel) and world space so input can be interpreted in world terms. Purely a
 * view concern — never touches the simulation.
 */
export class Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  viewportWidth = 1;
  viewportHeight = 1;

  private readonly worldW: number;
  private readonly worldH: number;
  readonly minZoom: number;
  readonly maxZoom = 4.0;

  constructor(worldW: number, worldH: number, startX: number, startY: number) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.x = startX;
    this.y = startY;
    this.zoom = 1;
    this.targetZoom = 1;
    this.minZoom = 0.25;
  }

  setViewport(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  zoomBy(steps: number): void {
    const factor = Math.pow(1.15, steps);
    this.targetZoom = clamp(this.targetZoom * factor, this.minZoom, this.maxZoom);
  }

  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  follow(x: number, y: number, lerp: number): void {
    this.x += (x - this.x) * lerp;
    this.y += (y - this.y) * lerp;
  }

  update(dt: number): void {
    // Smoothly approach target zoom.
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 10);
    this.clampToWorld();
  }

  private clampToWorld(): void {
    const halfW = this.viewportWidth / 2 / this.zoom;
    const halfH = this.viewportHeight / 2 / this.zoom;
    // If the world is smaller than the viewport on an axis, keep it centred.
    if (halfW * 2 >= this.worldW) this.x = this.worldW / 2;
    else this.x = clamp(this.x, halfW, this.worldW - halfW);
    if (halfH * 2 >= this.worldH) this.y = this.worldH / 2;
    else this.y = clamp(this.y, halfH, this.worldH - halfH);
  }

  view(): CameraView {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
    };
  }

  /** Device-pixel screen point → world point. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewportWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewportHeight / 2) / this.zoom + this.y,
    };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
