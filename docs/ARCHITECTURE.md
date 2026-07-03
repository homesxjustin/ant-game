# Architecture

The codebase is organized in three layers with a strict dependency direction:

```
        ┌─────────────────────────────────────────────┐
        │  game/   (integration: loop, camera, HUD)    │
        └───────────────┬──────────────┬───────────────┘
                        │ depends on   │ depends on
                        ▼              ▼
        ┌───────────────────┐   ┌──────────────────────┐
        │  core/ (sim)      │   │  platform/ (I/O seam) │
        │  pure, portable   │   │  interfaces + web impl│
        └───────────────────┘   └──────────────────────┘
```

**Dependency rule:** `core/` depends on nothing but the language runtime.
`platform/` defines interfaces (and one concrete web implementation).
`game/` wires a platform to the core. Nothing in `core/` or `game/` imports a
browser/Web API — those live only in `platform/web/`.

---

## `core/` — the deterministic simulation

Pure TypeScript. This is the game, minus any way to see or touch it.

| File | Responsibility |
| ---- | -------------- |
| `math/Rng.ts` | Seeded mulberry32 PRNG. **The only source of randomness in the sim.** |
| `math/Vec2.ts` | Allocation-light 2D vector helpers. |
| `sim/config.ts` | `SimConfig` — the entire balance table in one place. |
| `sim/types.ts` | Enums + POD types (`Caste`, `AntState`, `Faction`, brood, food). |
| `sim/Pheromone.ts` | Two-channel scent grid (deposit / sense-gradient / evaporate / diffuse). |
| `sim/SpatialHash.ts` | Uniform-grid broad phase for O(n) neighbour queries. |
| `sim/Ant.ts` | A single ant as pooled mutable data. |
| `sim/Colony.ts` | Nest, stored food, brood pipeline, population counts. |
| `sim/Simulation.ts` | The authoritative world. `step(dt, commands)` advances it. |

### Determinism

Two guarantees make the simulation reproducible:

1. **Seeded RNG.** Every random decision flows through one `Rng` instance. No
   `Math.random()`, no `Date.now()`, no wall-clock reads inside `core/`.
2. **Fixed timestep.** `Simulation.step` only ever advances by the caller's
   fixed `dt` (the game uses `1/60`). Real frame time is decoupled by an
   accumulator in `game/Game.ts`.

Given the same `(seed, command stream)` the world evolves identically on any
machine. The test suite asserts this directly
(`tests/simulation.test.ts` → "same seed + steps => identical stats").

Determinism buys us, for free later:

- **Save/load** — persist `(seed, tick, command log)` or an entity snapshot.
- **Replays & spectating** — replay the command log.
- **Lockstep multiplayer** — exchange only inputs, not world state.
- **Console cert repros** — a bug report reproduces exactly.
- **Cheap CI** — headless runs verify behaviour without a GPU.

### The command seam

`Simulation.step` takes a `SimCommands` value describing *player intent* in
world space — never device state:

```ts
interface SimCommands {
  steer: Vec2 | null;                 // possessed-ant steering, 0..1
  possessAt: Vec2 | null;             // possess nearest ant to this point
  release: boolean;                   // release possession
  paint: { channel, x, y } | null;    // manual pheromone painting
}
```

The platform layer is responsible for turning keyboard/mouse/gamepad/touch
into these fields. The sim cannot tell — and must not care — which device the
player used.

---

## `platform/` — the portability seam

`platform/Platform.ts` declares three interfaces:

- **`Renderer`** — a *declarative* draw API (`circle`, `ant`, `ring`,
  `drawField`, screen-space `text`/`rect`). The game describes a frame; the
  renderer executes it. The game never touches a drawing API.
- **`InputSource`** — polled abstract actions (`GameAction` enum) plus analog
  axis, pointer, and zoom. Device→action mapping lives entirely in
  implementations.
- **`AudioSink`** — fire-and-forget named cues.

`platform/web/` is the reference implementation for the browser / desktop
(Electron/Tauri) edition: `CanvasRenderer`, `WebInput` (keyboard + mouse +
Gamepad API), `WebAudio` (procedural), and `WebPlatform` (wires them and drives
the `requestAnimationFrame` loop).

A console edition adds `platform/<target>/` with the same three interfaces over
that platform's SDK. See [`PORTING.md`](PORTING.md).

---

## `game/` — integration

| File | Responsibility |
| ---- | -------------- |
| `Game.ts` | Owns the sim + view; fixed-step accumulator; maps input→`SimCommands`; audio events. |
| `Camera.ts` | Smooth follow, clamped zoom, screen↔world transforms. |
| `WorldView.ts` | Read-only rendering of the sim through the `Renderer` interface. |
| `Hud.ts` | Screen-space stats, objectives, and control hints. |
| `Objectives.ts` | Chapter-1 win/lose + progression stages (reads the sim, never mutates). |

`main.ts` is the composition root: it picks `WebPlatform` and hands it to
`Game`. Swapping the platform is a two-line change there.

---

## Performance notes

- Ants are **pooled**; dead slots are recycled (`freeSlots`) so the backing
  array doesn't grow unbounded as brood cycles.
- Neighbour-dependent systems (combat, food sensing) use the **spatial hash**,
  keeping the frame near O(n) as the colony scales.
- The pheromone field is a flat `Float32Array` per channel — cache-friendly and
  trivially serializable.
- The current build comfortably simulates the slice's populations at 60 Hz.
  The design's "thousands of ants" target is reachable on this structure by
  moving the sim to a Web Worker / native thread and (optionally) an SoA layout;
  the interfaces already isolate that change to `core/`.
