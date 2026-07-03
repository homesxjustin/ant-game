# Porting guide — PC & Console editions

The game is built so that **a port is a new platform implementation, not a
rewrite.** `core/` (simulation) and `game/` (integration) are pure TypeScript
and never touch a device. Everything platform-specific lives behind three
interfaces in `platform/Platform.ts`:

- `Renderer` — declarative drawing
- `InputSource` — polled abstract `GameAction`s + analog axis/pointer/zoom
- `AudioSink` — named audio cues

To bring the game to a new target you implement those three interfaces and a
`Platform` that wires them and drives a frame loop. Then change two lines in
`main.ts` (or add a new entry point) to construct your platform instead of
`WebPlatform`.

```ts
// main.ts — the only place that names a concrete platform
const platform = new WebPlatform(canvas);   // ← swap for your platform
const game = new Game(platform);
game.start();
```

---

## PC edition (Windows / macOS / Linux)

The web build **is** the PC edition. Two standard shipping paths:

### Option A — Desktop wrapper (recommended first step)

Wrap the static `dist/` build in **Tauri** (small, Rust-based) or **Electron**.

1. `npm run build` → `dist/`
2. Point the wrapper at `dist/index.html`.
3. Add native niceties via a thin platform tweak: fullscreen toggle, window
   management, Steam/Epic SDK hooks (achievements, cloud saves) behind small
   helpers the `game/` layer can call.

Gamepad already works (the `WebInput` adapter reads the Gamepad API), so
controller support on PC is done.

### Option B — Native runtime

Because `core/` is engine-agnostic logic, it can be compiled/transpiled and
embedded in a native host (e.g. a Rust/C++ shell via a JS runtime, or ported to
another language). Implement `Renderer`/`InputSource`/`AudioSink` over your
graphics/input/audio stack (wgpu, SDL, etc.). This is the same work a console
port does — see below.

**Storefront checklist (PC):** cloud saves (serialize `seed + command log` or a
world snapshot — trivial thanks to determinism), key rebinding (already a
mapping table in the input adapter), ultrawide/4K (renderer is
resolution-independent; camera clamps to world), Steam Input for controllers.

---

## Console edition (PlayStation / Xbox / Switch)

Consoles forbid arbitrary web runtimes in shipping titles and require certified
graphics/input/audio APIs. The plan:

### 1. Host the core

Run the deterministic `core/` simulation on the console. Options, cheapest
first:

- Embed a JS engine (e.g. a lightweight VM) and run `core/` as-is.
- Transpile/port `core/` to the console toolchain's language.

Either way **nothing in `core/` needs behavioural changes** — it has no
platform dependencies and is already fixed-step + seeded.

### 2. Implement the three adapters

| Interface | Console implementation |
| --------- | ---------------------- |
| Renderer (3D) | Native graphics API (GNM/GNMX, D3D12, NVN/Vulkan) behind a `ThreeStage`-shaped class: a displaced-terrain ground, instanced ant meshes, props, and a day/night lit scene driven by a `PerspectiveCamera` the `CameraRig` already positions. The 3D edition owns its surface via `Host3D`/`Surface3D`, so you provide the surface + renderer and reuse `CameraRig`, `WorldView3D`, and `Terrain` as-is. (The 2D `Renderer` interface — ~8 declarative primitives — remains available if a target wants the 2D edition instead.) |
| `InputSource` | Native controller API. Map physical buttons/sticks → the existing `GameAction` enum and `moveAxis`. **No game code changes** — the mapping is the whole job. On gamepad-only, `pointer()` returns `null` and possession targets the camera focus (already handled). |
| `AudioSink` | Platform audio mixer; map the named cues (`food`, `hatch`, `possess`, …) to samples. |

### 3. Provide a `Platform` + frame loop

Drive `game.frame(dt)` from the console's vsync/game loop with a fixed-step
accumulator (already implemented in `Game`). Feed it `now()` from a monotonic
timer.

### 4. Certification-friendly properties you already have

- **Deterministic repros** — QA/cert bugs reproduce from `(seed, inputs)`.
- **Fixed timestep** — behaviour is identical at 30/60 Hz caps.
- **No hidden global state / no wall-clock in sim** — save-anywhere is a
  snapshot of the sim, not a screenshot of the world.
- **Suspend/resume** — the accumulator clamps large `dt` gaps (see
  `WebPlatform.onFrame`); mirror that clamp in the native loop so a
  system suspend can't fast-forward the sim.

### Console UX gaps to close during a port (tracked, not yet built)

- On-screen/reticle cursor for gamepad-only pointing (the input interface
  already exposes what's needed).
- Controller glyph prompts instead of keyboard hints in the HUD (HUD hint
  strings are centralized in `Hud.ts`).
- Safe-area margins for TV overscan (HUD lays out from configurable pads).
- Platform account / cloud-save / achievement plumbing behind small services
  the `game/` layer calls.

---

## Summary

| Layer | PC edition | Console edition |
| ----- | ---------- | --------------- |
| `core/` | unchanged | unchanged (embed or transpile) |
| `game/` | unchanged | unchanged |
| `platform/` | `web/` (+ optional native tweaks) | new `platform/<console>/` adapters |
| `main.ts` | unchanged | new entry point selecting the platform |

The seam is the product. Keep new device code inside `platform/`, keep gameplay
inside `core/`+`game/`, and every future target stays a bounded, well-defined
task.
