---
name: ascii-scenes
description: Use when authoring or editing the hand-drawn ASCII scenes in Alchemist's Engine — Dead Grove, Abandoned Quarry, or any future location. Triggers on requests like "redesign the quarry," "add a new scene variant," "tweak the grove mountain range," "make a v3 / v4 of <location>," or any work that touches `QUARRY_SCENES`, `GROVE_SCENE_ROWS`, `_QUARRY_RAW_ROWS`, or new mountain/tree silhouette ASCII. Encodes the slope math, depth-class tinting, overlap resolution, 40-col verification, and the land-mines we've hit.
---

# ASCII Scenes — Composition Reference

Hand-authored ASCII scenes in this repo (grove, quarry) share a single
rendering convention. This skill encodes the patterns so future scene
work doesn't re-derive them.

## Two modes of ASCII (read this first)

There are two fundamentally different ways to do ASCII art, and the
distinction matters for every layout decision in this repo:

**1. Text-flow ASCII** — the scene is a sequence of strings. Each
character is part of a contiguous text run, so adding/removing a char
mid-row shifts everything to its right. Width discipline (`.padEnd(40)`,
40-col verification) is mandatory; one off-by-one and the whole frame
slides. This is what the current grove and quarry scene rows do —
each row is one string consumed by a `for (const ch of text)` loop.
Rigid, but cheap to author for static silhouettes.

**2. Positional / grid ASCII** — each character (or character cluster)
is an independent positioned element. Removing or moving one cell
doesn't reflow neighbors. You can layer multiple "scenes" on top of
each other (sky → mountains → sprites → walkers), animate individual
cells, swap one item without touching the rest. The grove walker
(`#grove-walker-layer`) already does this — absolutely-positioned
overlay sized in `ch` units, fontSize matched to the autofit pass, so
it sits cleanly on the character grid without participating in text
flow.

**Bias toward #2 for new work.** The text-flow approach is locked in
for the current grove/quarry rawRows, but anything new — additional
sprites, item overlays, animated decorations, layered scenes —
should default to positional. It buys massive flexibility: you can
toggle individual elements, A/B test variants, animate, recolor
per-cell, and combine layers without re-authoring the underlying
text. The cost (one DOM element per cell vs one per row) is
negligible at our scene sizes.

Concrete pattern for a new positional layer:

```js
// Sized to the same 40-col character grid as the scene below.
const layer = document.createElement('div');
layer.style.position = 'absolute';
layer.style.inset = '0';
layer.style.fontSize = currentAutofitPx + 'px';   // match autofit
layer.style.fontFamily = 'monospace';
// Each cell is independently addressable
for (const cell of cells) {
    const node = document.createElement('span');
    node.style.position = 'absolute';
    node.style.left  = (cell.col)  + 'ch';
    node.style.top   = (cell.row * lineHeight) + 'px';
    node.textContent = cell.char;
    layer.appendChild(node);
}
```

When the autofit pass re-runs, the layer's `fontSize` and `lineHeight`
must be updated (see `syncGroveWalkers()` for the pattern).

**Critical: positional ASCII does NOT occlude automatically.** Two
spans at the same `(row, col)` BOTH render — transparent text on
transparent background, so you see both characters as an X. Text-flow
gets occlusion for free (the later string overwrites the earlier
char in the same string position); positional needs an explicit
occupation map.

The pattern (see `renderQuarry()` v4 path):

```js
const occupied = Object.create(null);  // key = "row,col" -> cell node
for (const layer of layers) {                  // back-to-front order
    for (each char in layer.content) {
        if (ch === ' ') continue;              // transparent
        const key = row + ',' + col;
        if (occupied[key]) occupied[key].remove();   // EVICT prior cell
        const cell = createCellAt(row, col, ch, layer.cls);
        frame.appendChild(cell);
        occupied[key] = cell;
    }
}
```

Without the eviction step, hero `/` at col 11 and flanker `\` at col
11 both render as visible chars and you get an X at the crossing.
This bit me on the first v4 commit — fix in v129.

## Kinds + instances (the canonical pattern for new work)

The maturity step beyond per-layer authoring: separate **kind**
(visual identity — what a thing IS) from **instance** (where it sits
in a scene). Same idea as flyweight pattern / Unity prefabs / ECS
components: store the shared definition once, reference it by name
from many instances. **All new scene + item work should use this
pattern** unless there's a strong reason not to.

Live examples in `game.js`:
- **`QUARRY_KINDS` + `QUARRY_SCENES.v4.instances`** — quarry's hero,
  flankers (one kind used twice), inner peaks, cave, scree
- **`GROVE_KINDS` + `GROVE_V2.instances`** — atmospheric rows, mid-band
  trees (one kind reused across far/mid/near depth bands), framing
  trees, foreground sprites
- **`ITEM_KINDS` + `*_SPAWN_POINTS` + parallel `*_ITEMS`** — collectible
  items (sticks, stones, ironOre) at fixed (row, col) per location

**When to adopt:** as soon as (a) two scenes share visual types
(grove + future forest both have scraggly trees), OR (b) you're
committed to a graphics-tier swap. Cross-location reuse, animation
targeting, and debug overlays all become trivial.

**Kind format**:

```js
const QUARRY_KINDS = {
    'mountain-medium': {
        width: 12, height: 6,
        rows: [
            { content: '     /\\     ', cls: 'mid' },
            { content: '    /  \\    ', cls: 'mid' },
            ...
            { content: '/          \\', cls: 'midnear' }
        ]
    },
    ...
};
```

Origin is the kind's own row 0 / col 0. Bounding box `width` ×
`height` documents the kind's footprint.

**Tint policy — most-specific wins:**

```
instance.cls    →  if set on the instance, wins
  ↓ (else)
kindRow.cls     →  if the kind row defines tint, used
  ↓ (else)
no tint         →  cell skipped (warn / dev error)
```

Quarry kinds OWN their tint progression (kind rows have `cls`)
because mountain silhouettes have intrinsic aerial perspective —
the hero's peak is `mid`, its base is `near`. Grove tree kinds
DON'T own tint (no `cls` on kind rows) because the same tree
shape reads as far / midfar / mid / midnear depending on which
depth band hosts it; the instance specifies the tint per
placement. The renderer supports both — write whichever fits
the visual.

**Instance format**:

```js
instances: [
    { name: 'flanker-left',  kind: 'mountain-medium', row: 11, col: 0  },
    { name: 'flanker-right', kind: 'mountain-medium', row: 11, col: 28 },
    { name: 'hero',          kind: 'mountain-tall',   row: 8,  col: 0  },
    // Grove example — instance supplies cls because tree kinds are tint-agnostic:
    { name: 'far-tree-1',    kind: 'tree-far-A',      row: 4, col: 10, cls: 'midfar' },
    ...
]
```

`name` = unique instance identity (target "the left one" later).
`kind` = shared visual type. `cls` = optional tint override. Order
in the array is z-stacking — later instances overpaint earlier ones
at conflicting positions via the eviction map.

**Sprite kinds — `tintRowOnPaint: true`** for any sprite that should
re-class the entire row it lands on (preserves grove v1's
`overlaySprite` row up-tinting semantic):

```js
'sprite-scraggly': {
    width: 7, height: 9, tintRowOnPaint: true,
    rows: [ { content: '   ^   ' }, ... ]
}
```

After all instances paint, the renderer post-passes any row a sprite
touched and re-classes every cell to the sprite's `cls`. Without this
flag, sprite-tinted rows would have mixed depth classes and the
foreground tree wouldn't read as "in front of" the band.

**Optional per-row `opacity`** for kind rows that fade gradient
(e.g., grove framing trees fade from 0.55 at row 4 → 1.0 at row 11):

```js
{ content: '    || /  ', cls: 'near', opacity: 0.55 },   // row 4
{ content: '    ||/   ', cls: 'near', opacity: 0.61 },   // row 5
...
{ content: '    ||-   ', cls: 'near', opacity: 1.00 },   // row 11
```

**Rendered cells get data attributes** for future targeting:

```html
<span class="quarry-cell grove-cell grove-mid"
      data-kind="mountain-medium"
      data-instance="flanker-left"
      style="left: 5ch">/</span>
```

`document.querySelectorAll('[data-kind="mountain-medium"]')` returns
every cell of every flanker — bulk-style for graphics swap. Adding
`data-instance` lets animation target one specific occurrence.

**Authoring rules:**

- One kind = one nameable visual concept ("a small mountain peak").
  If you'd describe two visuals identically in conversation, they
  share a kind.
- Don't push every singleton through the registry — cave/scree are
  unique to quarry, but live in `QUARRY_KINDS` for uniformity. Cheap.
- Kind names should describe what the thing IS, not how it looks
  (`mountain-medium`, not `slash-cluster-six-rows`). The name
  survives the graphics-tier swap; the glyph doesn't.
- Promote frequently-shared kinds (e.g., `tree-scraggly`) to a
  top-level `WORLD_KINDS` dict if/when grove + future locations
  start sharing.

**Verification** (kinds + instances version): script that loads
the kinds + instances data, composes the merged char grid (and
optionally cls grid), and diffs against the text-flow reference.
Zero diff = identical visual. See git history of `_check_v4.js`
and `_check_grove_v2.js` for templates.

**Land-mine: regex alternation order vs. depth-class names.** The
depth-tint class names share prefixes — `mid` is a prefix of `midnear`,
`midfar` is a prefix of nothing. JS regex alternation tries options
in the order written; the FIRST match wins. So:

```js
// BAD — `mid` matches before `midnear` is even tried
str.replace(/grove-(horizon|far|midfar|mid|midnear|near|sky|ground|items)/g, ...)
// On 'grove-midnear': matches `grove-mid`, leaves orphan `near`
// Result: 'grove-{newcls}near' — invalid class, cell loses tint
```

Two fixes, pick one:

```js
// Word boundary on the trailing side — `mid\b` requires non-word after
str.replace(/grove-(horizon|far|midfar|mid|midnear|near|sky|ground|items)\b/g, ...)

// Or: longer alternatives FIRST so they match before their prefixes
str.replace(/grove-(horizon|midnear|midfar|mid|near|far|sky|ground|items)/g, ...)
```

Word boundary is more robust — it doesn't matter what the alt order is.
This bit grove v2's sprite tint-row-on-paint pass (v131→v132): cells
originally classed `grove-midnear` got rewritten to `grove-midnearnear`
when a sprite painted into their row, and rendered white instead of
tan. Look out for this any time you generate or rewrite grove-* / depth-
class names dynamically.

## Items as positional kinds (canonical pattern)

Collectible items (sticks, stones, ironOre, future kinds) follow the
same kinds + instances split, with two extra concepts:

**`ITEM_KINDS` registry** (single source of truth for every item):

```js
const ITEM_KINDS = {
    stick: {
        glyph: '/',                        // visual, 1 char
        label: 'stick',
        cssClass: 'grove-stick',           // colour rule
        ariaPick: 'Pick up a stick',
        gridTitle: 'Stick — drag back to Inventory rail to return',
        respawnMs: 60 * 1000               // 1 min base, ±50% jitter
    },
    stone:   { glyph: '()',  ..., respawnMs: 3 * 60 * 1000 },
    ironOre: { glyph: '[O]', ..., respawnMs: 5 * 60 * 1000 }
};
```

Every renderer (grove pickup button, quarry pickup, drag ghost,
merge-grid ingredient cell) reads from this. Adding a new collectible
= one entry, flows through every site. Fixes the kind of inconsistency
where a stone showed `()` in one place and `#` in another.

**Per-kind respawn rates.** `ITEM_KINDS[type].respawnMs` is the base
time (ms); `markItemCollected(state, id, respawnMs)` jitters ±50%.
Sticks repopulate fast, stones medium, ore slow — set the economy
once in the registry, every collect site honours it.

**Spawn points = geography** (one list per location):

```js
const GROVE_SPAWN_POINTS = [
    { row: 0, col: 3  },   // spot 0
    { row: 0, col: 8  },   // spot 1
    ...
];
```

**`*_ITEMS` = economy** (parallel array — the kind at each spot):

```js
const GROVE_ITEMS = [
    { type: 'stick' }, { type: 'stick' }, { type: 'stone' }, ...
];
```

`GROVE_ITEMS[i]` fills `GROVE_SPAWN_POINTS[i]`. To change which
KIND is at a position: edit one entry in `*_ITEMS`. To change the
GEOMETRY: edit one entry in `*_SPAWN_POINTS`.

**Render path:** items render as `<button>`s wrapped in absolute-
positioned spans, anchored to `left: <col>ch` inside a per-row
fixed-width frame (40ch). Picking one up just removes its button —
siblings stay anchored to their own cols. No reflow, no width
reservation tricks. Respawn check (`isItemAvailable`) gates whether
the button is rendered at all.

**Background content** (decorative chars in the same row, e.g.
quarry's rock mounds `/\` / `/____\`) stays as text-flow `<span>`
inside the frame, with `$` placeholders stripped. Items overlay
positionally on top — neither shifts.

**Future hooks the architecture supports** (not built yet):

- Per-spot rate override (`spot.respawnMs`) for lush/scarce zones.
- Randomized type-at-spot on respawn (roll a fresh kind from a
  spawn table when the timer expires).
- Adding new spawn points without renumbering existing items.

## Frame contract

- **40 cols wide.** Every row gets padded to 40 chars by `.padEnd(40, ' ')`
  in `_QUARRY_RAW_ROWS` / `GROVE_SCENE_ROWS` builders (text-flow paths).
  Kinds + instances paths render to a 40-`ch`-wide frame. You can
  author at ≤40 cols and rely on padding, but verify before committing.
- **Row count:** quarry currently 29 rawRows (rows 0-28). Grove uses
  `GROVE_SCENE_ROWS`, computed from depth-band primitives. Match the
  existing length when adding a variant unless you have a reason to
  change it.
- **Ground row + 3 item rows are SEPARATE** from scene `rawRows` —
  rendered by `renderGrove()` / `renderQuarry()` after the scene
  rows, with their own positional-items frames.

## Depth tinting (per-row CSS class)

Each row carries a class consumed by `.grove-cell.grove-{class}`:

| Class     | Use for                                            |
|-----------|----------------------------------------------------|
| `sky`     | Empty rows above the scene                         |
| `far`     | Distant peak/tree tips, faintest                   |
| `midfar`  | Mid-distance silhouettes                           |
| `mid`     | Hero's upper portion, mid-ground content           |
| `midnear` | Hero's body, foreground transitioning              |
| `near`    | Hero's base, scree row, foremost content           |
| `ground`  | Ground row only                                    |

**Tint applies to the whole row.** You cannot have hero (mid) and
flanker (midfar) on the same row at different tints. Compositions that
need per-cell tint must use the grove's left/center/right span model
(see `LEFT_NEAR_TREE` / center depth band / `RIGHT_NEAR_TREE`), which
splits a row into 3 spans with independent classes.

## Slope math (`/\` mountains)

Standard mountain widens **+1 col on each side per row down**:

| Row offset from peak | Width | Example          |
|----------------------|-------|------------------|
| 0 (peak)             | 2     | `/\`             |
| +1                   | 4     | `/  \`           |
| +2                   | 6     | `/    \`         |
| +N                   | 2+2N  | `/` + 2N spaces + `\` |

For peak at row R col C (where `/\` straddles cols C, C+1):
- `/` (left edge) at row R+k → col C-k
- `\` (right edge) at row R+k → col C+1+k

**Quarry hero** (v3 text-flow / v4 kinds-instances): peak row 8 cols
19-20, base row 27 cols 0-39. That's 19 rows of widening, base width
40. Cave at rows 22-25, cols 16-22 (`,-----.` / `|     |` / `|     |`
/ `|_____|`).

## Overlap resolution

Single-layer ASCII can only show one char per cell. When two slopes
collide:

- **Foreground wins.** Foreground = visually closer = lower base in
  frame = wider footprint. Hero overpaints flanker.
- **Test for collision per-row** by computing each mountain's `/` and
  `\` cols at that row, then resolving any shared col. Example: v3
  row 16, hero `/` at col 11 AND flanker `\` at col 11 → hero wins,
  flanker `\` is dropped.
- **`\/` adjacent (e.g. cols 13-14)** reads as a clean saddle between
  two peaks. Use this when you want the slopes to visibly merge
  without literal overlap.

If a flanker's outer slope hits col 0 or col 39 before its base row,
the slope **clips at the frame edge** — its remaining portion is
implicitly off-frame. That's the natural way to "extend a mountain
beyond the visible scene." See v3 row 16 — left flanker's outer `/` at
col 0, then the next row would be col -1 (off-screen).

## Width verification (REQUIRED before commit)

Before committing any scene change, save this as a temp script
(`_check_scene.js`) at the repo root, run with `node _check_scene.js`,
then delete:

```js
const fs = require('fs');
const src = fs.readFileSync('game.js', 'utf8');
const startIdx = src.indexOf('v3: {');          // adjust target variant
const endIdx = src.indexOf('};', startIdx);
const block = src.slice(startIdx, endIdx);
const re = /\['([^']*)',\s*'(sky|far|midfar|mid|midnear|near|ground)'\]/g;
let m, i = 0;
while ((m = re.exec(block)) !== null) {
    const row = m[1].replace(/\\\\/g, '\\');
    const ok = row.length === 40 || row.length === 0 ? 'OK ' : 'BAD';
    console.log(ok, 'row', i++, 'len=' + row.length, '|' + row + '|');
}
```

Every non-empty row must be exactly 40 chars. Empty rows (`''`, sky)
are OK.

A row that's 39 cols won't crash but will misalign with neighbors and
read as a stair-step. The codebase's `.padEnd(40, ' ')` masks the bug
in render output but the SOURCE should still be exact 40 — easier
diff/edit/verify.

## Layout versioning

When item POSITIONS change (`itemRows` / `items` array):

1. Bump `GROVE_LAYOUT_V` (grove) or `QUARRY_LAYOUT_V` (quarry) in
   `game.js` — these are local consts inside the migration block.
2. The migration code resets `game.locations.<loc>.respawnAt = {}` so
   old saves don't carry stale positions.

When adding a NEW scene VARIANT (e.g. `v3` to `QUARRY_SCENES`):

- No layoutV bump needed. The `scene` field on `game.locations.quarry`
  auto-resets respawn when the URL param changes (`if (game.locations.
  quarry.scene !== QUARRY_SCENE_KEY) ...`).

## Adding a new variant

For a kinds + instances variant (preferred for new work):

1. Author kind definitions in the location's `*_KINDS` dict
   (`QUARRY_KINDS`, `GROVE_KINDS`). Reuse existing kinds when the
   visual already exists.
2. Build the instance list — `{ name, kind, row, col, cls? }` per
   placement. Order = z-stacking; later overpaints earlier.
3. Wire the variant into the location's scene-pick function
   (`_pickQuarryScene`, `_pickGroveScene`) and update the URL-param
   default if needed. URL-param scene switch already auto-resets
   `respawnAt` for the location on save load.
4. Run the verifier — node script that composes the merged char +
   cls grids and diffs against the reference variant.
5. Update `docs/locations.md` with a one-line description.
6. Bump `APP_VERSION` (game.js) AND `CACHE` (service-worker.js) in
   lock-step — pre-commit hook enforces this.

For a text-flow variant (legacy path — only when matching an
existing text-flow scene):

1. Add `{ rawRows, groundRow, itemRows, items }` to the scenes dict.
2. Update the comment block above the scenes dict listing the variant.
3. Run the width-check script.
4. Same docs + version-bump steps as above.

## Land-mines (lessons learned)

- **Flex-row collapse if `font-size` differs per cell.** Atmospheric
  perspective is per-cell CSS opacity + color tinting on the
  depth-class span — DO NOT vary font-size per cell. Differing cell
  sizes inside a flex row collapse the row's total width and pull
  framing trees inward (v45 polish-pass).
- **`autofitGroveScene()` / `autofitLocationScene()` measures real
  `clientHeight` after layout settles.** Run via `requestAnimationFrame`
  at end of `renderGrove()` / `renderQuarry()`. CSS `clamp()` on
  `.grove-row` is the first-paint fallback only.
- **`100dvh` / `100dvw` on full-bleed modal**, not `100vh` / `100vw`.
  Chrome's address bar overshoots `vh`. Grove + quarry modals use
  `position: fixed` with `100dvh × 100dvw`.
- **Body scroll lock** via `lockBodyScroll()` / `unlockBodyScroll()`
  on modal open/close — saves and restores `window.scrollY`.
- **Items render positionally — `$` placeholders are legacy.** As of
  v135, items use `*_SPAWN_POINTS` (geography) + parallel `*_ITEMS`
  (economy) instead of `$` markers in row strings. The `$` branch
  in `buildSpan` / quarry's `buildRow` survives as a defensive
  no-op for any future row that wants the old text-flow inline
  pattern. Don't put `$` chars where you mean literal dollar signs
  in any row — they'll render as a blank space.
- **Overlay sprite `overlaySprite()`** only re-classes a row when at
  least one sprite char actually painted (so blank sprite rows don't
  up-tint the underlying band). Relevant if adding `FG_*` foreground
  sprites.

## Existing scenes — read before authoring

- **Quarry v1, v2, v3** in `game.js` `QUARRY_SCENES` dict. v1 = narrow
  mountain, v2 = dominant hero with arched cave, v3 = hero + nested
  flankers + tiny inner peaks.
- **Grove** scene primitives: `LEFT_NEAR_TREE`, `RIGHT_NEAR_TREE`,
  `MID_FAR_*`, `MID_MID_*`, `MID_NEAR_*`, `buildBand()`,
  `HORIZON_STIPPLE`, `DISTANT_TREELINE`, `FOG_ROW`, `FG_SCRAGGLY`,
  `FG_LEAN`, `GROVE_GROUND_ROW`, `GROVE_UNDERBRUSH_ROW`.
- **Reference art** (study-only, paraphrase — never copy): curated
  indexes under `_research/ascii-<category>/INDEX.md`. Master list at
  `_research/ascii-co-uk-INDEX.md`. Licensing posture in
  `_research/ascii-co-uk-LICENSING.md`.

## Workflow tips

- **Sketch on graph paper / monospace text editor first.** Computing
  all the col positions by hand in a normal editor leads to off-by-one
  errors. Open a 40-col-wide monospace pane and build the row visually.
- **Always verify col positions when adding a NEW slope.** Compute the
  expected col for each `/` and `\` from the peak row + offset; don't
  eyeball it.
- **Iterate one row at a time** when geometry is complex. Get row N
  right, run the width check, then move to row N+1.
- **Keep slopes consistent.** Mixing different slope rates (some `/\`
  at +1/row, others at +2/row) makes the mountain look broken. If you
  need a steeper slope, use horizontal extensions (`_,_/`) at the base
  rather than steepening `/`.
