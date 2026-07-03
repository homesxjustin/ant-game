import type { Platform } from "../Platform";
import { CanvasRenderer } from "./CanvasRenderer";
import { WebInput } from "./WebInput";
import { WebAudio } from "./WebAudio";

/**
 * Concrete Platform for the browser / desktop (Electron/Tauri) edition. Wires
 * the canvas renderer, DOM input, and Web Audio together and drives the frame
 * loop with requestAnimationFrame. This is the ONLY file that assumes a
 * browser; swap it (plus its three adapters) to bring the game to a console.
 */
export class WebPlatform implements Platform {
  readonly renderer: CanvasRenderer;
  readonly input: WebInput;
  readonly audio: WebAudio;
  private rafId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new CanvasRenderer(canvas);
    this.input = new WebInput(canvas, () => this.renderer.pixelRatio);
    this.audio = new WebAudio();

    const doResize = () => this.renderer.resize(window.innerWidth, window.innerHeight);
    doResize();
    window.addEventListener("resize", doResize);

    // Unlock audio on first interaction (autoplay policy).
    const unlock = () => this.audio.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
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
      // Clamp huge gaps (tab switch) so the sim never explodes.
      if (dt > 0.25) dt = 0.25;
      cb(dt);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(this.rafId);
  }
}
