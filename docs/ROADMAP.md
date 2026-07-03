# Roadmap

How the full [design vision](DESIGN.md) is delivered on top of the shipped
foundation, sequenced so each phase is playable and de-risks the next. Each
item notes the primary layer it touches — most extend `core/` and `game/`
without disturbing the platform seam.

## Phase 0 — Foundation ✅ (this repository)

- Deterministic, platform-agnostic simulation core (seeded RNG, fixed step).
- Pheromone-driven foraging with emergent trails; food economy; brood pipeline;
  worker/soldier/queen castes; colony-vs-colony combat.
- Ant possession + manual trail painting.
- **3D edition (Three.js):** seamless Ground → Colony → Ecosystem camera,
  GPU-instanced ants, displaced terrain with scale props, day/night cycle,
  terrain-conforming pheromone overlay, DOM HUD.
- 2D edition sharing the identical simulation (`?mode=2d`).
- Camera(s), HUD, Chapter-1 objectives, procedural seeded arena.
- Platform seam with web/desktop hosts (keyboard + mouse + gamepad).
- Test suite (determinism, gameplay, pheromones, terrain, camera) + headless
  WebGL smoke test.

> **Note on verticality:** the presentation is fully 3D, but the *simulation*
> still navigates a plane. True volumetric climbing (trees, walls, vines) is the
> single largest sim-layer expansion — tracked in Phase 3, called out so scope
> stays honest.

## Phase 1 — Colony depth (`core/`, `game/`)

- Full pheromone palette (Danger, Attack, Expand, Repair, Scout, Evacuation,
  Relocation) as additional channels + per-caste interpretation.
- Nurse/builder/scout role behaviours; brood needs (feeding, temperature).
- Underground room-based nest builder; nest capacity affects brood throughput.
- Save/load via deterministic snapshot (`seed + command log` or entity dump).

## Phase 2 — Living ecosystem (`core/`)

- Independent creature AI (ladybug, spider, bee, bird, mantis, wasp) sharing
  the spatial-hash + pheromone substrate.
- Weather & seasons: rain/flood, drought, winter freeze; plant growth cycles.
- First non-ant predators create real survival pressure.

## Phase 3 — Worlds & scale (`core/`, `platform/`)

- Move the simulation to a Web Worker / native thread; optional SoA entity
  layout; instanced rendering to reach "thousands of ants" on screen.
- Additional biomes (Garden, Compost, Shed, Sidewalk, Sandbox, Forest Edge,
  Storm Drain, Greenhouse, Creek) with biome-specific mechanics.
- Procedural world generation with tunable climate/resources/difficulty.

## Phase 4 — Progression systems (`core/`, `game/`)

- Genetics/research modifying the `SimConfig` per colony across generations.
- Extended caste roster (Major Soldier, Acid/Fire ant, Leafcutter, Carpenter,
  Engineer, Explosive Beetle, Flying Alate).
- Quest system content (main / colony / exploration / creature / seasonal /
  legendary) on top of the existing objective tracker.

## Phase 5 — Campaign & bosses (`core/`, `game/`)

- Story Chapters 2–10 as authored objective/scenario data.
- Boss creatures with unique fights that reshape the ecosystem on defeat.
- The Human House campaign (kitchen/pantry/garage) with human countermeasures.

## Phase 6 — Multiplayer (`core/`, `platform/`, netcode)

- Lockstep netplay: exchange only `SimCommands` between peers; the
  deterministic core keeps worlds in sync. (This is why determinism is enforced
  from Phase 0.)
- Modes: co-op colony, competitive territory, queen battle, raid, shared
  backyard; up to 8 players.

## Phase 7 — Ship (all layers)

- Console platform implementations (`platform/<console>/`) per
  [`PORTING.md`](PORTING.md); PC desktop wrapper (Tauri/Electron) with
  storefront services.
- Accessibility, localization, controller glyphs, safe-area/overscan, options.
- Content, audio (sample-based `AudioSink`), art pass, performance
  certification.

---

**Guiding constraint:** new device/platform code stays in `platform/`; new
gameplay stays in `core/`+`game/`. Holding that line keeps every phase — and
every future port — a bounded task.
