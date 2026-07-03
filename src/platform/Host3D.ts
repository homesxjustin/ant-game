import type { InputSource, AudioSink } from "./Platform";

/**
 * Host contract for the 3D edition. The 3D renderer (Three.js today, a native
 * graphics API on console) owns its own drawing surface, so — unlike the 2D
 * `Platform` — the host does not expose a `Renderer`. It provides only the
 * cross-cutting services that are identical on every platform: input, audio, a
 * clock, a frame driver, and the drawing surface's size.
 *
 * This mirrors the 2D seam exactly: input/audio/loop are shared and abstract;
 * the render target is the one thing a port re-implements.
 */
export interface Surface3D {
  readonly canvas: HTMLCanvasElement;
  /** Drawing-buffer size in device pixels (includes DPR). */
  readonly width: number;
  readonly height: number;
}

export interface Host3D {
  readonly input: InputSource;
  readonly audio: AudioSink;
  readonly surface: Surface3D;
  now(): number;
  onFrame(cb: (dtSeconds: number) => void): () => void;
}
