# Trial Locations — Detailed Reference

Locations are accessed via the **Explore** card below the Alchemical Table.
The card renders a tiny world map: a hollow box icon for the engine ("you
are here") linked by connectors to the grove (`#grove-enter`) and then
the **Abandoned Quarry** (`#quarry-enter`). The grove → quarry pattern is
the template for future locations.

Tapping a node opens a fullscreen modal containing a hand-authored ASCII
scene. **The picture is the UI** — items embedded in the art are
clickable and add to the player's resources.

## Shared infrastructure

- **Modals are full-bleed** (`100dvh × 100dvw` on `position: fixed` so
  Chrome's address bar can't clip).
- **Body-scroll lock** on open via `lockBodyScroll()` /
  `unlockBodyScroll()` (saves and restores `window.scrollY`).
- **Auto-fit sizing** via `autofitLocationScene()` — measures the scene
  container's real `clientHeight` / `clientWidth` after layout settles,
  computes the exact font-size that packs every row into the available
  space, and sets it inline. Runs at end of `renderGrove()` /
  `renderQuarry()` via `requestAnimationFrame` and on
  resize/orientationchange. CSS `clamp()` formula on `.grove-row` is the
  first-paint fallback.
- **Respawn (shared).** Picked items respawn after
  `RESPAWN_MS_BASE * (0.5 + Math.random())` — a 1–3 minute spread per
  item, naturally staggered. Stored as
  `game.locations.<loc>.respawnAt: { itemId: epochMs }`. Helpers
  `isItemAvailable(state, id)`, `markItemCollected(state, id)`,
  `tickRespawns(state)` live in `game.js` and serve both locations.
  `tickRespawns()` runs on each render so expired entries clear and the
  map doesn't grow unbounded. Old saves with the legacy `collected:
  [ids]` array are migrated by dropping the array; returning players see
  a fresh location (acceptable per `project_pre_launch`).

## The Dead Grove

**Gating.** Locked behind `EXPLORE_UNLOCK_STICKS` (50) cumulative sticks
gathered (`game.stats.sticksGathered`, monotonic — feeding doesn't roll
back). Until unlocked, `#location-grove-locked` shows a live `Sticks
gathered: N / 50` readout. Reveal is the `exploreUnlock` REVEAL_STAGE.

**Scene composition.** 40 cols wide. Each row is a flex of three
side-by-side spans:

```
[ left near-tree (10c) | center depth band (20c) | right near-tree (10c) ]
```

Framing trees (`LEFT_NEAR_TREE` / `RIGHT_NEAR_TREE`) run the full
vertical; the center span rotates through depth bands top-to-bottom
(horizon → far → midfar → mid → midnear → sky), with fog stipple
separators between bands. Atmospheric perspective is per-cell CSS
opacity + color tinting on the depth-class span — `font-size` is
**intentionally not** varied per cell (differing cell sizes inside a
flex row collapse the row's total width and pull the framing trees
inward; v45 polish-pass fix).

Two passes of overlay paint on top of the composed rows:

- **Canopy overlay (rows 0–3).** Framing-tree canopy chars overlay onto
  the side spans at one notch brighter than surrounding distant content,
  so the silhouette reads against the treeline. Whitespace lets distant
  content show through.
- **Trunk fade (rows 4–11).** Inline opacity lerps from `0.55` → `1.0`,
  selling "trees rising out of the haze."
- **Foreground sprites** (`FG_SCRAGGLY`, `FG_LEAN`) painted via
  `overlaySprite()`, which only re-classes a row when at least one
  sprite char actually painted (so blank sprite rows don't up-tint the
  underlying band).

**Items.** Below the scene sit the ground row, an underbrush row, and
item rows. Stones render as `()`, sticks as `/`. When all items are
collected, the three item rows are replaced by spacer / "The grove is
empty for now." / spacer so the message lands centered without the row
count jumping. `$` placeholders are replaced at render with clickable
buttons. Item layout is versioned via `GROVE_LAYOUT_V` — bumping it
resets the respawn map on load for old saves.

**Building blocks** (in `game.js`): `LEFT_NEAR_TREE`, `RIGHT_NEAR_TREE`,
`MID_FAR_*` / `MID_MID_*` / `MID_NEAR_*` slot primitives + `buildBand()`,
`HORIZON_STIPPLE` / `DISTANT_TREELINE` / `FOG_ROW` distant constants,
`FG_SCRAGGLY` / `FG_LEAN` foreground sprites, `GROVE_GROUND_ROW` /
`GROVE_UNDERBRUSH_ROW`, `GROVE_SCENE_ROWS` (pre-computed array consumed
by `renderGrove()`), `GROVE_ITEM_ROWS` + `GROVE_ITEMS`, and
`autofitGroveScene()`.

**Scene variants.** Two render paths, selectable at runtime via
`?grove=v2` (default = v1):

- **v1 (default)** — text-flow rendering with three spans per row
  (left framing tree | center depth band | right framing tree).
  Built dynamically by `buildGroveScene()`. The locked-in reference
  for visual comparison.
- **v2** — same visual, rendered via `GROVE_KINDS` (shared visual
  type definitions) + `GROVE_V2.instances` (placement list). Each
  rendered cell is an absolutely-positioned span carrying `data-kind`
  + `data-instance` for future targeting (graphics swap, animation,
  debug overlays). Kind cls is optional; instance cls overrides;
  most-specific-wins. Sprite kinds (`tintRowOnPaint: true`) re-class
  every cell in a row their content paints into, preserving v1's
  `overlaySprite` row up-tinting semantic. Trunk-fade gradient (rows
  4-11 lerp 0.55→1.0) encoded per-row via optional `opacity` field
  on framing-tree kind rows. Verified zero-char-diff vs v1 grid.

Future grove ideas (mountain range, litter rows retry) live in
`cowork/BACKLOG.md`.

### Grove walker cosmetic

When the grove modal is open, a tiny animated golem appears in the
midground per stick-job assignment (so 1 walker today, 2 once Arcane
Vents unlocks the second slot). Three gaits are wired up under
`GROVE_WALKER_GAITS`, selectable at runtime via
`?gait=crab|splay|cascade` (default = `crab`):

- **crab** (default) — 4-frame pair-flip gait. Same `\`↔`/` mechanic
  as cascade, but legs are paired by inner (positions 1+3) and
  outer (0+4); the inner pair flips first, then the outer, then
  both unwind in the same order. Direction-sensitive: inner leads
  on rightward, outer leads on left. 200ms/frame.
- **splay** — original 4-frame lean cycle (neutral → lean-R → inward
  → lean-L → loop), 220ms/frame.
- **cascade** — 8-frame independent-leg wave; the leading-edge leg
  flips `\` ↔ `/` first and the cascade rolls inward. Direction
  signaled by the starting edge (rightmost first = moving right);
  mirrored frame set for left motion. 130ms/frame.

Each gait carries its own `frameMs`, `driftPerFrame`, `flipChance`,
and `flipOnlyAtRest` flag.

**Vertical wander.** Walkers can step up or down a row inside the
mid mid-band (rows 8–13 reachable via `GROVE_WALKER_Y_MIN/MAX`),
giving them a 2D roam instead of pacing one fixed line. Per-frame
chance is `GROVE_WALKER_VERT_CHANCE` (0.06), only fires at frame 0
of the leg cycle so the slide doesn't conflict with an in-flight
flip. CSS transitions both `left` and `top` for a smooth shuffle.

The walker is NOT real ASCII text — it's an absolutely-positioned
overlay (`#grove-walker-layer`, sized to the scene's 40-col character
grid via `ch` units, fontSize matched to the active autofit pass) so
it doesn't fight `autofitGroveScene` or grove item buttons. Purely
decoration; the actual gather tick runs from the existing
`tickGolemsGathering` timer regardless of the walker. Lifecycle:
started in `groveEnter` click handler, stopped in `groveLeave` and
`onPageHide`. After `renderGrove()` wipes `scene.textContent`, the
next autofit RAF re-paints the layer via `syncGroveWalkers()`.

### Walker Lab

Settings → `[WALKER LAB]` opens a debug modal (`#walker-lab-modal`)
with a single walker pacing back and forth on a track plus live
controls: gait dropdown, drift speed slider, frame interval slider,
and a time-scale slider that proportionally slows the whole thing for
frame-by-frame study. Self-contained (`openWalkerLab` / `closeWalkerLab`
/ `tickWalkerLab` / `paintWalkerLab`) — doesn't touch the live grove
walker. Reads the same `GROVE_WALKER_GAITS` definitions, but with
per-session overrides for drift / frameMs / timescale. `onPageHide`
clears the lab interval.

## The Abandoned Quarry

Second harvestable location. Mountain backdrop with a cave mouth, a
foreground rock-pile band, and embedded items: **4 stones** (tap-pick,
+1 stone) and **3 iron-ore nodes** (tap → 30s mining bar; pickaxe
required). Same modal pattern as the grove.

**World-map gating.** The grove → quarry connector starts with the
`.forest-gated` class while `game.stats.logsGathered < QUARRY_LOG_GATE`.
The class adds a leafy-green tint and a soft mossy gradient to the
heavy-line connector — the path looks overgrown, not passable. Tapping
the quarry node pre-gate shows the progress toast `"Forest blocks the
path (N / M logs)"` and a one-line narration. Once the threshold
trips, the `quarryUnlock` REVEAL_STAGE fires its narration + screen
flash and `updateForestGate()` strips the class on the next tick. The
gate state is driven entirely from current stats by `updateForestGate()`
called from `updateUI()`, so no separate persistence is needed.

`QUARRY_LOG_GATE = 1` is a **test value** — `cowork/BACKLOG.md` carries
the bump-before-launch reminder.

**Mining.** One ore at a time. Tapping an `[O]` node starts a 30s
progress bar (`MINE_ORE_MS`) on the `#mine-ore-btn` at the bottom of
the quarry modal. On completion: +1 `inventory.ironOre`, +1
`stats.ironOreMined`, the node hides and its respawn timer is set.
Cancellable on tap-the-bar, on `quarry-leave`, on a second tap
mid-mining, and on `visibilitychange → hidden` (mirrors
`cancelLogGather`). Without a pickaxe, tapping a node shows the
"You need a pickaxe to mine iron ore." toast.

**Iron ore inventory rail.** New tile (`#inv-tile-iron-ore`, `[O] N`)
between stones and the satchel. Hidden until any ore has been mined
(`stats.ironOreMined > 0`). Not draggable — no recipe consumes iron
ore yet; it's a visible counter only.

**Scene variants.** Two compositions live under `QUARRY_SCENES`,
selectable at runtime via `?quarry=v3|v4` (default = `v3`). Earlier
v1 and v2 variants were removed in v130 — their silhouettes are
preserved in git history if needed.

- **v3** — central hero with a shorter flanking peak nested on each
  side and tiny inner peaks in the saddles. Authored as text-flow
  rows (one string per scene row). The locked-in reference silhouette.
- **v4** — same visual as v3, but rendered via the **kinds + instances**
  pattern. `QUARRY_KINDS` (top-level constant) defines reusable visual
  types (`mountain-tall`, `mountain-medium`, `mountain-small`,
  `cave-arch`, `scree-line`); each kind has a bounding box and per-row
  content with depth-class tint. The v4 scene is just a list of
  `instances` — each `{ name, kind, row, col }` placing one kind in
  the scene. Order in the array is z-stacking order; later instances
  overpaint earlier ones at conflicting positions (occupation map
  evicts the prior cell to prevent X-on-overlap). Each rendered cell
  carries `data-kind` + `data-instance` so future graphics swap,
  per-instance animation, or debug overlays can target by kind ("all
  mountain-medium become real art") or by instance ("highlight
  flanker-left").

Switching the URL param resets `game.locations.quarry.respawnAt`
since item positions differ between variants.

**Scene composition (v2).** Single dominant mountain as the main set
piece, with a small pair of distant peaks behind for atmospheric
depth. ~30 scene rows: 3 sky → 4 distant-peak rows (rows 3-6, far →
midfar) → 1 sky transition → 20 main-mountain rows (rows 8-27, mid
→ near) with a 7-wide arched cave mouth (`,-----.` / `|     |` /
`|_____|`) at rows 22-25 → 1 scree row. Then ground row + 3 item
rows that contain two distinct foreground rock-mound silhouettes
(6 chars wide × 3 rows tall, peaks aligned vertically) with the 8
items (5 stones + 3 ore) scattered around them. Single full-width
span per row (no left/center/right framing-tree split). Depth
tinting reuses the grove's `.grove-cell.grove-{horizon|far|midfar
|mid|midnear|near|sky|ground}` classes. `autofitQuarryScene()` and
`autofitLocationScene()` are generalized helpers — same auto-fit
math as the grove. `QUARRY_LAYOUT_V` migration resets respawn map
so old saves see the new layout cleanly.

**Building blocks** (in `game.js`): `_QUARRY_RAW_ROWS` →
`QUARRY_SCENE_ROWS` (padded to 40c), `QUARRY_GROUND_ROW`,
`QUARRY_ITEM_ROWS` + `QUARRY_ITEMS`, `renderQuarry()`,
`collectQuarryItem()`, `startMineOre()` / `completeMineOre()` /
`cancelMineOre()`, `mineOreState` transient. Layout is versioned via
the `layoutV` field on `game.locations.quarry`.
