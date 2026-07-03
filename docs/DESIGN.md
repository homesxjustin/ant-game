# Design vision — SimAnt: Evolution

This document preserves the full creative vision for the game and marks, for
each pillar, what the current build implements versus what is designed for
later. It is the north star; [`ROADMAP.md`](ROADMAP.md) is the plan to get
there.

Legend: ✅ implemented in the vertical slice · 🟡 partially implemented ·
⬜ designed, not yet built.

---

## Vision

*SimAnt: Evolution* is the definitive modern evolution of the SNES classic — a
living ecosystem where you begin as a single scout ant and, over time, command
thousands and eventually millions across persistent worlds. It blends real-time
strategy, colony simulation, survival, exploration, genetics, diplomacy, and
action-RPG control. The goal isn't to defeat another colony — it's to build a
civilization. The journey runs from *"I'm trying not to get stepped on"* to
*"my empire controls the entire ecosystem."*

## Core philosophy

Make the player feel incredibly **small** at first — and eventually
unbelievably **powerful**.

## Progression

- **Stage 1 — The Lone Worker.** 🟡 One controllable ant, a weak queen,
  scarce food, an expanding rival. Possession + hand-laid trails implemented;
  the "flood cold open" cutscene is ⬜.
- **Stage 2 — Rebuilding.** 🟡 Workers hatch and forage autonomously via
  pheromones; queen lays brood as food allows. Nurse/builder role AI is ⬜.
- **Stage 3 — Expansion.** 🟡 Larger world and rival pressure in the slice;
  multiple biomes are ⬜.

## Living ecosystem

⬜ Independent AI for ladybugs, spiders, bees, birds, mantises, wasps; weather
(rain floods tunnels, winter freezes); plant growth. *The slice ships the
ant/rival/food ecology and the pheromone substrate these creatures will plug
into.*

## Colony classes

- ✅ Workers (gather/build), Soldiers (combat), Queens (lay brood), Scouts
  (defined caste).
- ⬜ Major Soldiers, Explosive Beetles, Acid/Fire ants, Leafcutters,
  Carpenters, Engineers, Flying Alates.

## Genetics system

⬜ Per-generation research: longer legs, stronger jaws, night vision, venom /
cold / heat resistance, swimming, gliding, camouflage, size/speed/flight. *The
`SimConfig` table is the hook — genetics become per-colony modifiers over it.*

## Massive colony scale

🟡 Seamless zoom from one worker to the whole battlefield is implemented. The
"highways of thousands" target is an optimization milestone (Web Worker / SoA /
instanced rendering) the architecture is already shaped for.

## Dynamic pheromone AI

🟡 Two channels (to-food, to-home) with deposit / gradient-sensing /
evaporation drive emergent trails today, plus manual painting. The full palette
(Danger, Attack, Expand, Repair, Emergency, Scout, Evacuation, Relocation) is
⬜ and is purely additive channels + interpretation rules.

## Underground colony builder

⬜ Room-based nest construction (nursery, storage, barracks, mushroom farms,
research, ventilation, reservoirs, escape tunnels). *Nest is a single node
today.*

## The human house

⬜ Kitchen/pantry/garage campaign with human countermeasures (vacuum, spray,
traps, pets, robots).

## Boss creatures

⬜ Black widow, giant centipede, hornet queen, bullfrog, snake, mole, crow,
termite king, scorpion, fire-ant queen, army-ant legion — each reshaping the
ecosystem on defeat.

## Multiplayer

⬜ Up to 8 players (co-op colony, competitive territory, queen battle, raid,
shared backyard). *Determinism + the command seam make lockstep the intended
path — see ROADMAP.*

## Story campaign

🟡 Chapter 1 (Survival) is playable as concrete win/lose objectives. Chapters
2–10 (Red Threat, Flood, Garden, Predators, Humans, Winter, Great Swarm, New
Kingdom, Evolution) are ⬜.

## Quest system

🟡 Objective tracking exists (`Objectives.ts`). Main/colony/exploration/
creature/seasonal/legendary quest content is ⬜.

## Maps & worlds

🟡 One procedurally seeded backyard-style arena. Neighborhood, City Park,
Forest, Desert, Jungle, Farm, Laboratory, and full procedural generation are ⬜.

## Endgame

⬜ Multi-territory civilization: trade routes, wars, seasons, evolution, and
launching new queens to colonize new worlds.

---

## What the slice proves

The vertical slice exists to de-risk the two things everything else depends on:

1. **The core loop is fun and legible** — emergent pheromone trails, a food
   economy that feeds brood, direct possession, and readable colony-vs-colony
   pressure.
2. **The architecture ports** — deterministic, platform-agnostic core with a
   clean device seam (see [`ARCHITECTURE.md`](ARCHITECTURE.md) and
   [`PORTING.md`](PORTING.md)).

Every ⬜ system above extends this base rather than replacing it.
