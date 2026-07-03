import type { InputSource } from "../Platform";
import { GameAction } from "../InputSource";

/**
 * Web input adapter. Maps keyboard + mouse AND the Gamepad API onto the shared
 * GameAction set, so the desktop build already supports a controller — the
 * same code path a console edition would use. Key/button bindings live only
 * here; the game consumes abstract actions.
 */
const KEY_BINDINGS: Record<string, GameAction> = {
  KeyR: GameAction.Release,
  KeyF: GameAction.PaintFood,
  KeyH: GameAction.PaintHome,
  KeyQ: GameAction.OrbitLeft,
  KeyE: GameAction.OrbitRight,
  Digit1: GameAction.PerspGround,
  Digit2: GameAction.PerspColony,
  Digit3: GameAction.PerspEcosystem,
  Equal: GameAction.ZoomIn,
  Minus: GameAction.ZoomOut,
  KeyP: GameAction.Pause,
  Tab: GameAction.ToggleOverlay,
  KeyC: GameAction.Recenter,
  Enter: GameAction.Confirm,
  Space: GameAction.Confirm,
};

export class WebInput implements InputSource {
  private readonly held = new Set<GameAction>();
  private readonly pressedEdge = new Set<GameAction>();
  private readonly prevHeld = new Set<GameAction>();

  private keyVec = { x: 0, y: 0 };
  private pointerX = 0;
  private pointerY = 0;
  private pointerDown = false;
  private accumZoom = 0;
  private readonly pixelRatioFn: () => number;

  constructor(target: HTMLElement, pixelRatioFn: () => number) {
    this.pixelRatioFn = pixelRatioFn;

    window.addEventListener("keydown", (e) => {
      this.rawKeys.add(e.code);
      const action = KEY_BINDINGS[e.code];
      if (action) {
        this.held.add(action);
        e.preventDefault();
      }
      if (e.code === "Tab") e.preventDefault();
    });
    window.addEventListener("keyup", (e) => {
      this.rawKeys.delete(e.code);
      const action = KEY_BINDINGS[e.code];
      if (action) this.held.delete(action);
    });

    target.addEventListener("pointermove", (e) => {
      const rect = target.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.pointerY = e.clientY - rect.top;
    });
    target.addEventListener("pointerdown", (e) => {
      this.pointerDown = true;
      const rect = target.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.pointerY = e.clientY - rect.top;
    });
    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
    target.addEventListener(
      "wheel",
      (e) => {
        this.accumZoom += e.deltaY < 0 ? 1 : -1;
        e.preventDefault();
      },
      { passive: false },
    );
    // Prevent context menu so right-click can be a game control later.
    target.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  poll(): void {
    // Compute WASD/arrow movement vector.
    let x = 0;
    let y = 0;
    if (this.rawKey("KeyA") || this.rawKey("ArrowLeft")) x -= 1;
    if (this.rawKey("KeyD") || this.rawKey("ArrowRight")) x += 1;
    if (this.rawKey("KeyW") || this.rawKey("ArrowUp")) y -= 1;
    if (this.rawKey("KeyS") || this.rawKey("ArrowDown")) y += 1;

    // Merge gamepad (first connected pad).
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (pad) {
      const lx = deadzone(pad.axes[0] ?? 0);
      const ly = deadzone(pad.axes[1] ?? 0);
      if (lx !== 0 || ly !== 0) {
        x = lx;
        y = ly;
      }
      // Console-style mapping onto the shared action set.
      this.mapPadButton(pad, 0, GameAction.Possess); // A
      this.mapPadButton(pad, 1, GameAction.Release); // B
      this.mapPadButton(pad, 2, GameAction.PaintFood); // X
      this.mapPadButton(pad, 12, GameAction.PaintHome); // D-pad up
      this.mapPadButton(pad, 3, GameAction.ToggleOverlay); // Y
      this.mapPadButton(pad, 4, GameAction.OrbitLeft); // LB
      this.mapPadButton(pad, 5, GameAction.OrbitRight); // RB
      this.mapPadButton(pad, 9, GameAction.Pause); // Start
      this.mapPadButton(pad, 8, GameAction.Recenter); // Back
      // Right stick Y → zoom continuum.
      const ry = deadzone(pad.axes[3] ?? 0);
      if (ry !== 0) this.accumZoom += -ry * 0.5;
    }

    const l = Math.hypot(x, y);
    this.keyVec = l > 1 ? { x: x / l, y: y / l } : { x, y };

    // Compute edges (pressed this frame).
    this.pressedEdge.clear();
    for (const a of this.held) if (!this.prevHeld.has(a)) this.pressedEdge.add(a);
    this.prevHeld.clear();
    for (const a of this.held) this.prevHeld.add(a);
  }

  private padPrev = new Set<number>();
  private mapPadButton(pad: Gamepad, buttonIndex: number, action: GameAction): void {
    const pressed = !!pad.buttons[buttonIndex]?.pressed;
    const key = buttonIndex;
    if (pressed) this.held.add(action);
    else if (this.padPrev.has(key)) this.held.delete(action);
    if (pressed) this.padPrev.add(key);
    else this.padPrev.delete(key);
  }

  private readonly rawKeys = new Set<string>();
  private rawKey(code: string): boolean {
    return this.rawKeys.has(code);
  }

  isDown(action: GameAction): boolean {
    return this.held.has(action);
  }

  wasPressed(action: GameAction): boolean {
    return this.pressedEdge.has(action);
  }

  moveAxis(): { x: number; y: number } {
    return this.keyVec;
  }

  pointer(): { x: number; y: number; down: boolean } | null {
    const dpr = this.pixelRatioFn();
    return { x: this.pointerX * dpr, y: this.pointerY * dpr, down: this.pointerDown };
  }

  zoomDelta(): number {
    const z = this.accumZoom;
    this.accumZoom = 0;
    return z;
  }
}

function deadzone(v: number, dz = 0.18): number {
  return Math.abs(v) < dz ? 0 : v;
}
