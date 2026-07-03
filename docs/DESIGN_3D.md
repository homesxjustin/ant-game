# 3D Design Vision — "Six Millimetres Tall"

*Honey, I Shrunk the Kids meets a nature documentary.* The world should never
feel like a backyard — it should feel like an entirely new planet. A pebble is
a mountain, a blade of grass a towering tree, a puddle an ocean. This document
preserves the 3D vision and marks what the current build implements.

Legend: ✅ implemented · 🟡 partial · ⬜ designed, not yet built.

---

## Camera system — seamless perspectives ✅

The three named views are implemented as one **continuous zoom axis** so
switching is a glide, not a cut (`src/game/CameraRig.ts`):

- **Ground** ✅ — camera sits just above an ant; grass towers against the sky,
  pebbles become boulders. While possessing, the camera falls in behind the ant
  so you experience the world as the insect does.
- **Colony** ✅ — RTS boom; pheromone highways and crowds are visible at once.
- **Ecosystem** ✅ — the whole property, both colonies, and the full trail
  network in a single frame, with atmospheric fog for depth.

Keys `1/2/3` snap to presets; the wheel glides between them; `Q/E` orbit.

## Environmental scale ✅ (foundation)

Giant grass blades and pebble "boulders" are scattered across rolling terrain
and conform to a heightfield (`Terrain.ts`, `ThreeStage.ts`), so scale reads
immediately at ground level. ⬜ Flowers-as-dungeons, logs-as-ecosystems, and
per-object interiors are authored content that sits on this base.

## Dynamic lighting & day/night ✅ (foundation)

A sun orbits a full day/night cycle driven by the deterministic sim clock:
morning cool light → bright noon → golden-hour warmth → indigo night, with sky
and fog colour and light intensity all interpolating (`ThreeStage.setDayPhase`).
⬜ Dew, fireflies, and nocturnal-species swaps are follow-on content.

## Underground world ⬜

The design's "second open world" (tunnels, chambers, caverns, roots, ruins) is
not yet built. The nest is a single surface node today; the room-based builder
(see `ROADMAP.md`, Phase 1) is where this begins.

## Weather as gameplay ⬜

Rain that floods tunnels, moves food, and erases pheromone trails; mud; new
lakes. The pheromone field already supports erasure (evaporation) and the sim
is authored to accept environmental modifiers — the hooks exist; the systems
don't yet.

## Verticality & climbing 🟡

The presentation is fully 3D and the world rolls in height, but the simulation
still navigates a plane, so true volumetric climbing (trees, walls, vines,
fences, gutters) is ⬜. This is the largest sim-layer expansion and is called
out explicitly so scope stays honest: it requires a navigation upgrade in
`core/`, not just rendering.

## Dynamic grass, water physics, human scale ⬜

Wind-driven stealth grass, puddle/ripple/float physics, and the "humans as
distant earthquakes" treatment are designed and not yet built. The scale and
camera work here is what makes them land later.

## Creature AI & living colony 🟡

Ants already forage, build trails, raise brood, fight, and carry on with no
player input — you can stop and watch the colony work. ⬜ Independent daily
routines for spiders/birds/bees and full ecosystem AI are Phase 2.

## Sound design 🟡

Procedural audio cues exist (`WebAudio`); the "world sounds enormous"
spatialized mix (raindrop-as-explosion, bee-as-helicopter) is ⬜ and swaps in
behind the same `AudioSink` seam.

## Graphics direction

Target: between realism and stylised beauty (Grounded, A Bug's Life, Planet
Earth, Hollow Knight, Ori). The current build is a clean low-poly style — the
readable base a full art pass elevates.

---

## What the 3D slice proves

1. **The scale fantasy works** — the same world reads as an alien landscape at
   ground level and a strategy map from above, seamlessly.
2. **The renderer is a swappable layer** — the deterministic core is untouched;
   3D is a new presentation over the exact same `Simulation`, which is precisely
   what makes a native console renderer a bounded task (see `PORTING.md`).
