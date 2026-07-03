/**
 * Platform abstraction interfaces. Everything device-specific hides behind
 * these three seams. Porting to a new target (Windows/macOS/Linux via
 * Electron/Tauri, PlayStation, Xbox, Switch) means implementing these
 * interfaces against that platform's SDK — the game/ and core/ layers do not
 * change. See docs/PORTING.md.
 */

import type { GameAction } from "./InputSource";

/** Abstract, resolution-independent 2D camera the renderer honours. */
export interface CameraView {
  x: number; // world-space centre
  y: number;
  zoom: number; // world units per... larger = closer
  viewportWidth: number; // device pixels
  viewportHeight: number;
}

/** A drawable frame is described declaratively by the game and drawn by the
 * renderer, so the game layer never touches a drawing API directly. */
export interface Renderer {
  /** Device pixel dimensions of the drawable surface. */
  readonly width: number;
  readonly height: number;
  /** Called when the surface is resized by the host. */
  resize(width: number, height: number): void;
  /** Begin a frame; clears to the given background. */
  begin(camera: CameraView, background: string): void;
  /** Draw the pheromone field as a heat overlay (channel grids + palette). */
  drawField(grid: Float32Array, cols: number, rows: number, cellSize: number, rgba: [number, number, number]): void;
  /** Filled circle in WORLD space. */
  circle(x: number, y: number, r: number, color: string): void;
  /** A small oriented ant sprite in WORLD space. */
  ant(x: number, y: number, heading: number, r: number, color: string, carrying: boolean): void;
  /** Stroked ring in WORLD space (nest markers, ranges). */
  ring(x: number, y: number, r: number, color: string, width: number): void;
  /** Screen-space text (HUD). Coordinates are device pixels from top-left. */
  text(text: string, sx: number, sy: number, color: string, size: number, align?: "left" | "center" | "right"): void;
  /** Screen-space filled rectangle (HUD panels, bars). */
  rect(sx: number, sy: number, w: number, h: number, color: string): void;
  /** Finish and present the frame. */
  end(): void;
}

/** Polled input: the game asks "what is the player intending this frame?" */
export interface InputSource {
  /** Latch a fresh snapshot of device state. Called once per frame. */
  poll(): void;
  /** True while an action is held. */
  isDown(action: GameAction): boolean;
  /** True only on the frame an action went from up→down. */
  wasPressed(action: GameAction): boolean;
  /** Analog stick / WASD as a normalized vector (magnitude ≤ 1). */
  moveAxis(): { x: number; y: number };
  /** Pointer/cursor in device pixels, or null on gamepad-only platforms. */
  pointer(): { x: number; y: number; down: boolean } | null;
  /** Accumulated zoom delta since last poll (wheel / triggers). */
  zoomDelta(): number;
}

/** Fire-and-forget audio cues, addressed by logical name. */
export interface AudioSink {
  play(cue: string, volume?: number): void;
  setMasterVolume(v: number): void;
}

/** The bundle a Game needs from its host. */
export interface Platform {
  renderer: Renderer;
  input: InputSource;
  audio: AudioSink;
  /** Wall-clock seconds, monotonic. */
  now(): number;
  /** Register the per-frame callback; the host drives the loop (rAF, vsync,
   * or a native game loop). Returns a stop function. */
  onFrame(cb: (dtSeconds: number) => void): () => void;
}
