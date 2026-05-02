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

## Frame contract

- **40 cols wide.** Every row gets padded to 40 chars by `.padEnd(40, ' ')`
  in `_QUARRY_RAW_ROWS` / `GROVE_SCENE_ROWS` builders. You can author at
  ≤40 cols and rely on padding, but verify before committing — see
  "Width verification" below.
- **Row count:** quarry currently 29 rawRows (rows 0-28). Grove uses
  `GROVE_SCENE_ROWS`, computed from depth-band primitives. Match the
  existing length when adding a variant unless you have a reason to
  change it.
- **Ground row + 3 item rows are SEPARATE** from `rawRows` — rendered
  by `renderGrove()` / `renderQuarry()` after the scene rows. Items
  (`$` placeholders) only live in item rows.

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

**Quarry hero** (v2/v3): peak row 8 cols 19-20, base row 27 cols 0-39.
That's 19 rows of widening, base width 40. Cave at rows 22-25, cols
16-22 (`,-----.` / `|     |` / `|     |` / `|_____|`).

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

1. Add the new key to `QUARRY_SCENES` (or equivalent dict): `{ rawRows,
   groundRow, itemRows, items }`. Mirror an existing variant's shape.
2. Update the comment block above `QUARRY_SCENES` listing the variant.
3. Update `_pickQuarryScene()` if changing the default. The function
   already accepts any key present in `QUARRY_SCENES`.
4. Update `docs/locations.md` with a one-line description of the new
   variant.
5. Run the width-check script.
6. Bump `APP_VERSION` (game.js) AND `CACHE` (service-worker.js) in
   lock-step — pre-commit hook enforces this.

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
- **`$` is the item placeholder.** Anywhere a `$` appears in `rawRows`,
  `groundRow`, or `itemRows` becomes a clickable item button at render
  time. Items are consumed in array order — `items[0]` fills the first
  `$`, etc. Don't put `$` chars where you mean literal dollar signs.
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
