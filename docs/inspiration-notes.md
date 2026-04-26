# Inspiration Notes — Candy Box 2 (visuals) + A Dark Room (layered mechanics)

This document captures patterns we want to lift from two open-source
incremental games. **We do not copy code.** Both upstream sources are
quarantined under `_research/` (gitignored). Everything below is our
own paraphrase of architectural patterns we want to adopt, expressed
in our own voice.

## Why these two

- **Candy Box 2** — the bar for ASCII-as-environment. Hand-drawn text
  scenes where the picture IS the UI. Trees, dragons, lighthouses,
  candies — every interactive element is a glyph positioned inside
  a scene rather than a row of menu buttons.
- **A Dark Room** — the bar for layered mechanic depth. Each new
  resource, worker, or building unlocks the next. The progression is
  satisfying because every previous layer becomes the substrate for
  the next; nothing gets discarded.

## License posture

- Candy Box 2: GPLv3 (reciprocal).
- A Dark Room: MPL 2.0 (file-level reciprocal).
- Direct code copy would force our project to inherit those terms.
  Reading the source for understanding and reimplementing in our own
  style is fully legal and is the only path we use.

---

## What Candy Box 2 teaches us about VISUALS

### Scenes are pictures, not menus

A Dark Room is text + buttons. Candy Box 2 is *the picture is the
UI*. You see a forest with trees and a wolf, you tap the wolf to
fight it. You see a candy box with candies in it, you tap a candy to
eat it. The interactive elements are positioned glyphs inside the
ASCII landscape, not separated tiles.

### How they assemble a scene

- Each location is a class with its own multi-line ASCII art string
  plus a positional table of "tags" — character coordinates where
  interactivity is wired up.
- The render layer is a 2D character grid. Static art is painted
  first, then interactive overlays are positioned at known (row, col)
  pairs.
- As the player progresses, characters in the scene mutate: a dragon
  shrinks across fight rounds, doors open, fortunes change. Same
  scene, evolving art.

### What we lift

- **Items live in the scene.** We've already started this in the Dead
  Grove — sticks (`/`) and a stone (`#`) embedded inline among trees,
  tapped to collect. This is the pattern for every future location.
- **Each new location is its own visual identity.** When we add the
  Ash Drift, Boulder Field, Ember Path, each gets a distinct ASCII
  art with its own glyphs — wind in the ash, jagged stones, a single
  living tree dripping resin.
- **Scenes evolve with progress.** Items disappear as collected. Dead
  trees might bear leaves once the engine is fully restored. The
  scene is a record of what the player has done.
- **Better than CB2's hand-positioning.** CB2 does pixel/char-level
  positioning of interactive overlays — fragile. Our pattern (`$`
  placeholder character in the scene template, JS replaces in scan
  order with a clickable span) is easier to author and edit.

### Things to avoid

- Don't ship lots of slightly-different ASCII variants — author 4-6
  distinct stages per scene, max. Otherwise tuning becomes endless.
- Don't position interactivity by absolute pixel coordinates. Stay
  with the `$` placeholder approach; it survives font-size changes.

---

## What A Dark Room teaches us about LAYERED MECHANICS

### Each layer earns the next, and the previous layer keeps mattering

- Open with a fire that needs stoking. *That's it.* One button. One
  resource.
- The fire reveals you have wood. Now there's a builder. The builder
  needs more wood. The wood-loop upgrades from "rub two sticks" to
  "send gatherers to the forest."
- Building a hut creates villagers. Villagers become gatherers,
  hunters, trappers. Trappers need bait, bait costs meat, meat comes
  from hunters. Now there's a supply chain.
- Eventually: traders, weapons, an outside expedition, a war, a ship.
  At every step the previous layer becomes the *substrate* for the
  next. Nothing is discarded.

### How they wire it

- Workers are assigned to jobs from a population pool. Each job has a
  tick delay (e.g., 10s) and a resource delta map (e.g., +1 wood,
  -0.5 meat).
- Recipes are plain objects: `{ name, cost, type, max, flavor }`.
  Costs scale (Nth hut costs more than 1st). Crafting checks
  prerequisites (other unlocks, current resource counts) before the
  button is shown.
- Events trigger periodically and present a tree of choices. Each
  choice mutates the world: gain an item, lose villagers, unlock a
  building. Outcomes change the substrate, so the world keeps feeling
  alive.

### What we lift

- **Interlocking resources, no orphans.** Stones aren't trophies —
  they craft an axe that gathers more sticks. Sticks aren't trophies —
  fed to the engine they make heat. Heat isn't a vanity number — it
  powers the next phase. Each resource has a "next thing it makes
  possible," and the loop is the point.
- **Recipe-object table.** Move our one-off unlocks (Stone Axe,
  etc.) into a `RECIPES` array of plain objects. Each entry is
  data: cost, requires, effect, flavor. New recipes become an
  add-to-array operation, not a new function and matching modal slot.
- **Worker / generator metaphor for idle.** Once we add Stockpile or
  similar idle production, model it the ADR way: a "gatherer
  worker" with a tick interval and a resource delta. Same shape will
  scale to "miner," "scribe," and so on.
- **Event tree for encounters.** The Wanderer becomes a multi-scene
  event with branches (trade vs decline). Reusable shape:
  `{ id, scenes: { entry: { text, choices: [...] }, ... } }`. The
  next encounter (a trader, a relic, a stranger) plugs into the same
  pipe.
- **Earn the next layer with the previous.** Don't gate on time
  alone. Gate on "you've produced enough X to invest in Y" — that's
  the engine of ADR's pacing. When we shape Phase 1 → 2 → 3 → ..., the
  bridge is always *output of previous* feeding *input of next*.

### Things to avoid

- ADR's onboarding is famously slow ("nothing happens" for the first
  minute). We mitigate that with a stronger intro modal and earlier
  visible feedback (sticks visible immediately, not after first
  ember).
- ADR centralizes state through `$SM`. Our `game` global is enough;
  don't import a state manager pattern wholesale.
- Pure number-go-up loops without narrative anchors get repetitive.
  Borrow ADR's *flavor strings on every action* — every craft, every
  event, every milestone has a one-line line of text. That's a low-cost
  way to add texture.

---

## How this maps to our roadmap

| Borrowed pattern | Where it lands |
|---|---|
| Items embedded in ASCII scene | Already in (Dead Grove). Pattern repeats for Ash Drift, Boulder Field, Ember Path. |
| Scene state evolves with progress | Add respawn / regrowth to Dead Grove. Eventually animate the grove turning green when the engine is fully restored. |
| Recipe-object table | Reshape `UNLOCK_SLOTS` into a single `RECIPES` table. Add Stone Axe, Bone Whittler, Resin Vial as data entries. |
| Worker / job shape for idle | Future Stockpile becomes a single "gatherer" job: 1 stick per 60s. Same shape will scale to other idle generators. |
| Event scene tree | Wanderer modal becomes the first instance: `{ id: 'wanderer', scenes: { meet: { text, choices: [{ trade }, { decline }] } } }`. Reusable for later encounters. |
| Flavor string per action | Every craft / explore / unlock gets a one-liner. Already partly done; lean into it. |

## Files quarantined under `_research/`

- `_research/candybox2/repo/` — Candy Box 2 source. Read paths above
  + skim the `code/main/` TS files for any new pattern.
- `_research/a-dark-room/repo/` — A Dark Room source. Read paths
  above + the `script/` JS files for additional mechanics.

`_research/` is gitignored. Source files live there for reading; we
never read FROM them into our working files. This document is our
deliverable from the analysis pass.
