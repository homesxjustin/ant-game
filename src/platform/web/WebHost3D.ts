import type { Host3D, Surface3D } from "../Host3D";
import { WebInput } from "./WebInput";
import { WebAudio } from "./WebAudio";

/** Mutable surface whose size is refreshed on resize. Reported in device
 * pixels so the renderer sizes its drawing buffer to match. */
class WebSurface implements Surface3D {
  width = 1;
  height = 1;
  constructor(readonly canvas: HTMLCanvasElement) {}
}

/**
 * Browser / desktop host for the 3D edition. Bundles the shared web adapters
 * (keyboard+mouse+gamepad input, procedural audio) and drives the frame loop
 * with requestAnimationFrame — but leaves all drawing to the Three.js stack,
 * which owns the WebGL context on the supplied canvas. Swapping this file (plus
 * a native renderer) is the console-port task.
 */
export class WebHost3D implements Host3D {
  readonly input: WebInput;
  readonly audio: WebAudio;
  readonly surface: WebSurface;

  private dpr = 1;
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.audio = new WebAudio();
    this.input = new WebInput(canvas, () => this.dpr);
    this.surface = new WebSurface(canvas);

    this.recomputeSize();
    window.addEventListener("resize", () => this.recomputeSize());

    const unlock = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  private recomputeSize(): void {
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.surface.width = Math.floor(window.innerWidth * this.dpr);
    this.surface.height = Math.floor(window.innerHeight * this.dpr);
  }

  now(): number {
    return performance.now() / 1000;
  }

  onFrame(cb: (dt: number) => void): () => void {
    let last = this.now();
    const loop = () => {
      const t = this.now();
      let dt = t - last;
      last = t;
      if (dt > 0.25) dt = 0.25;
      cb(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(this.rafId);
  }
}
