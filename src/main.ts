import { WebHost3D } from "./platform/web/WebHost3D";
import { Game3D } from "./game/Game3D";
import { WebPlatform } from "./platform/web/WebPlatform";
import { Game } from "./game/Game";

/**
 * Composition root. Selects a presentation edition and wires it to the shared,
 * platform-agnostic simulation core:
 *
 *   - 3D edition (default): WebHost3D + Game3D, rendering through Three.js.
 *   - 2D edition (?mode=2d): WebPlatform + Game, rendering through a canvas.
 *
 * Both drive the SAME deterministic `Simulation`; only the renderer/camera/HUD
 * differ. Porting to PC/console means providing a new host + renderer here —
 * `core/` and the game controllers are untouched. See docs/PORTING.md.
 */
function boot(): void {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("game-canvas element missing");

  const mode = new URLSearchParams(location.search).get("mode");

  if (mode === "2d") {
    const platform = new WebPlatform(canvas);
    const game = new Game(platform);
    game.start();
    (window as unknown as { __game?: unknown }).__game = game;
  } else {
    const host = new WebHost3D(canvas);
    const game = new Game3D(host);
    game.start();
    (window as unknown as { __game?: unknown }).__game = game;
  }

  const bootEl = document.getElementById("boot");
  if (bootEl) bootEl.classList.add("hidden");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
