import { WebPlatform } from "./platform/web/WebPlatform";
import { Game } from "./game/Game";

/**
 * Composition root for the web / PC edition. It picks the concrete Platform
 * (WebPlatform) and hands it to the platform-agnostic Game. To bring the game
 * to another target you write a new Platform implementation and swap the two
 * lines below — nothing in game/ or core/ changes. See docs/PORTING.md.
 */
function boot(): void {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("game-canvas element missing");

  const platform = new WebPlatform(canvas);
  const game = new Game(platform);
  game.start();

  // Dismiss the boot splash once the first frame is scheduled.
  const boot = document.getElementById("boot");
  if (boot) boot.classList.add("hidden");

  // Expose for debugging / e2e harness.
  (window as unknown as { __game?: Game }).__game = game;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
