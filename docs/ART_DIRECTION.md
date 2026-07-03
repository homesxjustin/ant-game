# Art Direction — *Empire of the Small*

> Working title for the high-fidelity edition of *SimAnt: Evolution*. This is
> the authoritative visual bible for the game's look. It is engine-independent:
> it states the target, then maps each requirement to what the current
> **real-time web build (Three.js/WebGL)** already does versus what belongs to
> the **production client (Unreal Engine 5)**.

## Engine reality (read this first)

This document's target — photoreal PBR with **Nanite**, **Lumen**, ray-traced
GI, and photogrammetry — is an **Unreal Engine 5** production goal. The playable
build in this repository is a portable **Three.js/WebGL** client. Those are
different renderers, and this repo cannot compile or run UE5.

That is by design, and it is what our architecture protects:

- The **deterministic simulation core** (`src/core/`) is engine-agnostic pure
  logic. It is the shared brain of the game.
- **A UE5 client is another presentation layer over that same core** — exactly
  as the 2D canvas and 3D Three.js clients are today. It re-implements the
  render/host seam (`ThreeStage` → a UE5 renderer) and, if desired, hosts the
  core via a JS runtime or a C++ port. Gameplay does not fork.

So this bible governs **two** deliverables: the near-term look of the web client
(what we can do now), and the production look of the UE5 client (the target).
Every section below is tagged:

- ✅ **web build** — implemented now in Three.js.
- 🎯 **UE5** — production-engine target; not achievable in WebGL.
- 🟡 **web approx.** — a real-time stand-in for a UE5 feature is in place.

---

## Overall vision

Not a cartoon ant — a **real living creature in a real ecosystem**, with AAA
spectacle. Every frame should sit between *Planet Earth*, a Hollywood
blockbuster, and a UE5 cinematic: grounded in real biology, made magical by
scale.

## Rendering style

🎯 **UE5:** photoreal PBR — accurate reflections, realistic roughness,
subsurface scattering, micro-surface imperfections, high-frequency displacement,
volumetric lighting, cinematic DoF, AO, **ray-traced GI**, SSR, dynamic shadows,
volumetric fog, sparing bloom.

Current web build:
- 🟡 Filmic **ACES tone mapping** + sRGB output (`ThreeStage`).
- 🟡 **Bloom**, used sparingly (high threshold) via post-processing.
- 🟡 **Volumetric-fog approximation** (distance fog tinted by time of day).
- ✅ PBR-lit standard materials (roughness/metalness).
- 🎯 SSS, ray-traced GI, SSR, displacement, soft dynamic shadows, DoF — UE5.

## The ant

🎯 Biologically accurate hero: detailed mandibles, segmented armour, antenna
movement, exoskeleton scratches, adhering water droplets, visible breathing,
articulated joints, realistic foot placement, sunlit micro-hairs. **No**
smiling, cartoon eyes, oversized heads, or human proportions.

- ✅ web build: a readable, non-anthropomorphic instanced ant silhouette
  (head/thorax/abdomen) that scales to thousands on screen.
- 🎯 UE5: the photoreal hero model + per-limb animation rig above. (At web
  scale, thousands of individually rigged ants is out of budget; the hero
  treatment applies to the possessed/near ant, with instanced crowds beyond.)

## Macro scale

Design everything from **macro-photography** reference: a grain of sand is a
boulder, bark is canyon walls, grass blades are skyscrapers, droplets are
crystal spheres, moss is forest.

- ✅ web build: rolling terrain + towering grass + pebble "boulders" already
  deliver the scale read at ground level; the three-mode camera makes the world
  flip between "alien landscape" and "strategy map."
- 🎯 UE5: photogrammetry/Nanite assets for true macro fidelity.

## Environment detail

🎯 Every square foot tells a story: tiny rocks, decomposing leaves, moss, fungi,
pollen, seeds, twigs, insect shells, spider silk, puddles, mud, roots, feathers,
petals, mushrooms, bark. Nothing procedurally empty.

- ✅ web build: scattered grass + pebbles + food props over varied terrain.
- 🎯 UE5: the full authored/scanned dressing set above.

## Lighting

🎯 Cinematic, never evenly lit. **Golden hour is the visual identity.** Sun
filters through grass; god rays between leaves; dew as thousands of highlights;
rain reflections; night with moonlight, fireflies, glowing fungi,
bioluminescence.

- ✅ web build: full **day/night cycle** driven by the deterministic clock —
  morning cool → bright noon → golden-hour warmth → indigo night, with sky, fog,
  and light colour/intensity interpolating; warm golden key light.
- 🟡 web build: bloom stands in for sun-catch/dew sparkle.
- 🎯 UE5: true god rays (volumetrics), dew highlights, bioluminescence.

## Animation philosophy

🎯 Nothing mechanical — biology-driven: micro head adjustments, antenna
scanning, weight shifting, leg repositioning, mandible movement, micro-pauses,
surface testing, slips on wet rock, reactions to vibration. The creature appears
to *think before acting*.

- ✅ web build: smooth heading/turn-rate steering and trail-driven behaviour
  read as purposeful, not gridlocked.
- 🎯 UE5: the full procedural/creature-animation layer above.

## Camera direction

🎯 A cinematic **macro camera**: shallow DoF, lens compression, subtle handheld
during exploration, slow framing on discoveries, wide reveals, low hero shots,
focus pulls. Every screenshot worthy of box art.

- ✅ web build: seamless Ground → Colony → Ecosystem rig with orbit, follow, and
  low ground-hero framing.
- 🎯 UE5: DoF, focus pulls, handheld noise, discovery framing.

## Materials

🎯 Layered detail that rewards inspection: glistening wet mud, weathered bark,
leaf veins, refractive droplets, shimmering silk, damp mushrooms, a battle-worn
shell.

- ✅ web build: roughness-based standard materials, flat-shaded stone.
- 🎯 UE5: the layered, scanned, detail-mapped materials above.

## Atmosphere

The world must never feel static: wind in grass, drifting pollen, sunlit dust,
insects overhead, falling leaves, flowing water, passing bird shadows.

- ✅ web build: **GPU wind** sways every grass blade (tips lead, phased per
  blade); **drifting pollen/dust motes** catch light in an additive haze — the
  world breathes while you stand still.
- 🎯 UE5: falling leaves, flying insects, flowing water, bird shadows.

## Colour palette

Grounded natural colour, **not** oversaturated: deep forest greens, warm
sunlight, rich earth browns, wet blacks, golden highlights, morning blues,
autumn oranges.

- ✅ web build: palette + tone mapping tuned to this grounded range; the earlier
  neon overlay was pulled back to a readable green/blue.

## Artistic references

Planet Earth III · Life in Color · Honey I Shrunk the Kids · Grounded · Avatar:
The Way of Water (natural light) · The Last of Us Part II (environment detail) ·
UE5 *Valley of the Ancient* · Nanite/Lumen demos. Secondary: macro insect
photography, National Geographic, high-end nature docs, photogrammetry.

## Emotional goal

Childlike wonder on entering every biome. Standing under a blade of grass should
feel like standing under a skyscraper; the first rainstorm like a natural
disaster; the first spider like an impossible monster; the first sunrise
peaceful enough to simply stop and watch. Every environment says: *this world
existed long before you arrived, and will live on long after you leave.*

---

## Production path to the UE5 look

1. **Keep the core untouched.** `src/core/` remains the deterministic brain;
   the UE5 client hosts it (embedded JS runtime or a C++ port validated against
   the same test vectors).
2. **Implement the render/host seam in UE5.** Mirror `ThreeStage`'s
   responsibilities (world, camera, lighting) with Nanite geometry, Lumen GI,
   and the material library from this bible. Reuse the `CameraRig` intent
   (Ground/Colony/Ecosystem) as camera states.
3. **Author the asset + material set** per the Environment/Materials sections
   (photogrammetry/scanned where possible).
4. **Layer creature animation** for the hero/near ant; keep instanced crowds for
   scale.
5. **Grade to the palette** and lock golden hour as the signature.

Until then, the web client is the **look-and-feel prototype**: it proves the
scale, camera, day/night, and living-atmosphere pillars in real time, at a
fidelity WebGL can sustain, on an architecture the UE5 client inherits.
