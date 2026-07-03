# SimAnt: Evolution

A modern reimagining of the SNES classic *SimAnt* — a living ant-colony
ecosystem where you begin as a single scout and grow a superorganism.

This repository is the **ship-ready foundation**: a genuinely playable vertical
slice of the core loop (lone worker → pheromone trails → colony growth → food
economy → combat) built on an architecture designed from day one to port to
**PC and console** editions.

![Gameplay](docs/screenshot.png)

*Two rival colonies. Blue lines are exploration ("to-home") pheromone
highways; bright green lines are reinforced food trails that emerge — not
scripted — as ants discover a source and recruit nestmates to it.*

---

## Quick start

```bash
npm install
npm run dev        # play at http://localhost:5173
```

Other scripts:

| Script              | What it does                                             |
| ------------------- | -------------------------------------------------------- |
| `npm run build`     | Typecheck + production build to `dist/` (static, hostable)|
| `npm run preview`   | Serve the production build locally                        |
| `npm test`          | Run the deterministic simulation + unit test suite        |
| `npm run typecheck` | Strict TypeScript check, no emit                          |
| `npm run lint`      | ESLint over `src/`                                        |
| `npm run smoke`     | Headless browser smoke test of the built game             |

## Controls

Keyboard/mouse **and gamepad** are supported out of the box (the same code
path a console edition uses).

| Action                       | Keyboard / Mouse | Gamepad          |
| ---------------------------- | ---------------- | ---------------- |
| Move (when possessing an ant)| `WASD` / arrows  | Left stick       |
| Possess ant under cursor / release | `E`        | A                |
| Paint food trail             | hold `F`         | X                |
| Paint home trail             | hold `H`         | B                |
| Zoom                         | mouse wheel / `+` `-` | LB / RB     |
| Toggle pheromone overlay     | `Tab`            | Y                |
| Recenter camera              | `C`              | Back             |
| Pause                        | `P`              | Start            |
| New world (on win/lose)      | `Enter` / `Space`| A                |

## How to play the slice

You command the **green** colony against a **red** rival. Foragers leave the
nest, find food, and lay trails home that other ants reinforce — so your job is
to shape the ecosystem, not micromanage every ant:

- **Possess** a worker (`E`) and drive it to a food source and back to
  bootstrap a trail by hand.
- **Paint** food/home trails (`F`/`H`) to steer traffic toward rich food or
  away from the rival.
- Stored food lets the queen lay eggs → larvae → pupae → new workers and
  soldiers. Grow, raise soldiers, and out-scale the rival to complete
  **Chapter 1 — Survival**.

## Architecture at a glance

The single most important engineering decision here is a hard seam between a
**deterministic simulation core** and a **thin platform layer**:

```
src/
  core/        Pure TypeScript simulation. No DOM, no Web APIs, no device I/O.
               Deterministic (seeded RNG + fixed timestep). Runs in a browser,
               in Node (tests), or embedded in a native console shell — byte
               for byte identically.
  platform/    Abstraction interfaces (Renderer, InputSource, AudioSink) plus
               the reference web/desktop implementation. A console port
               implements these against its SDK; core/ and game/ don't change.
  game/        Glue: fixed-step loop, camera, HUD, objectives — consumes the
               core through the platform seam.
```

Determinism (see `src/core/math/Rng.ts` and `Simulation.step`) is not
decoration: it is what makes save-states, replays, automated tests, console
certification repros, and future lockstep multiplayer possible.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture and
[`docs/PORTING.md`](docs/PORTING.md) for the PC/console porting guide.

## What's built vs. the full vision

The [design vision](docs/DESIGN.md) is a multi-year AAA scope. This foundation
deliberately implements the **core loop end-to-end** so every later system has
something real to extend. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for how the
biomes, genetics, campaign, bosses, and multiplayer map onto this base.

## License

MIT — see [LICENSE](LICENSE).
