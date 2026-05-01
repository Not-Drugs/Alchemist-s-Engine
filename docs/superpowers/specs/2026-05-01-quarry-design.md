# Abandoned Quarry — Design

Status: design approved 2026-05-01 (Nicholas), pending spec review.

The quarry is the second harvestable location on the world map (after the
Dead Grove). It introduces a new resource (iron ore), a new tool
(pickaxe), and the first respawn behavior in the game — which is
retro-applied to the grove so the two locations share one mechanic.

## 1. World-map progression

The quarry node already exists as a placeholder (`#quarry-enter`) on the
`#location-grove` map. It currently shows a "coming soon" toast. This
spec wires it up.

**Forest gate.** The grove → quarry connector is replaced with a "dense
forest" treatment (`══[dense forest]══` styling) until the player has
gathered ≥1 log cumulatively. While locked, tapping the quarry node
shows: `"The path is choked with growth. Chop more logs to clear it.
(N / 1)"`. Counter live-updates so the gate is visible.

- **Gate value: 1 log** (test value while iterating). A
  `cowork/BACKLOG.md` entry **must** be added: *"Bump quarry log-gate
  from 1 → 5 before public launch."*
- Source stat: `game.stats.logsGathered` (add if not already tracked,
  monotonic).

After threshold, connector renders as plain `━━━━━━━━` and the quarry
node opens the modal on tap. New `REVEAL_STAGES` entry `quarryUnlock`
fires a one-shot narration beat ("The forest opens onto a quarry…")
when the threshold trips.

## 2. Quarry scene

40-col fullscreen modal, `100dvh × 100dvw` (`position: fixed`), reusing
grove's `lockBodyScroll` / `unlockBodyScroll` lifecycle. Composition
top-to-bottom:

- **Mountain backdrop (top ~40% of rows).** Large mountain silhouette
  with a cave opening (dark interior square). Authored as a hand-drawn
  ASCII block; depth tint applied per row (faintest at the top, slight
  warm-grey toward the base of the mountain).
- **Slope / fog band (middle).** Single-row fog stipple separator, plus
  1–2 rows of rocky slope easing from mountain into the foreground.
- **Foreground (bottom ~30% of rows).** Rock piles (sprite overlays
  similar to grove's `FG_SCRAGGLY`/`FG_LEAN`). Embedded clickable items
  sit *within* the rock piles so they read as "stones on the ground" /
  "ore in the rock face."

No rotating depth bands (grove has six; quarry has one mountain). Reuse
grove's `autofitGroveScene()` mechanism — generalize the helper to
accept a scene root id (`#quarry-scene`) so it can serve both locations.

ASCII building blocks live in `game.js` as new constants:

- `QUARRY_MOUNTAIN_ROWS` — pre-composed mountain silhouette
- `QUARRY_GROUND_ROW` / `QUARRY_PILES` — foreground sprites
- `QUARRY_SCENE_ROWS` — pre-computed array consumed by `renderQuarry()`
- `QUARRY_ITEM_ROWS` + `QUARRY_ITEMS`

Versioned via `QUARRY_LAYOUT_V` (mirrors `GROVE_LAYOUT_V`) so layout
revisions reset `collected` state on load.

## 3. Items

Per-visit pool (one-shot generation, then respawn — see §6):

- **4 stones** rendered as `()`. Tap-to-pick: +1 `inventory.stones`,
  collected node hides, respawn timer set.
- **3 iron-ore nodes** rendered as `[O]`. Tap behavior:
  - If pickaxe **not** in `game.keyItems`: toast `"You need a pickaxe to
    mine iron ore."` and a narration beat (one-shot) suggesting the
    recipe.
  - If pickaxe held: starts the **Mine Iron Ore** progress bar (30s,
    cool-grey fill). Cancellable on tap-elsewhere or on
    `visibilitychange → hidden` (mirrors `cancelLogGather(false)`).
    On completion: +1 `inventory.ironOre`, node hides, respawn timer
    set.
- The mining bar is a single global UI element below the scene (only
  one mining action at a time), styled like the log-gather bar but in
  a quarry-appropriate cool-grey-blue.

## 4. Pickaxe recipe

Minecraft-shape, anywhere on the 6×4 merge grid:

```
[S][S][S]
   [/]
   [/]
```

Three stone ingredients in a horizontal row + two stick ingredients
vertically below the center stone. 5 ingredients total.

- New `matchPickaxe()` in the pattern matcher (analogue of `matchAxe`).
- `canCraft` guard: skip once a pickaxe is already in `keyItems`.
- Yields `{type:'pickaxe'}`, displayed as `[T]` in the Key Items bag.
- Recipe surfaced in the `[Recipes ▾]` accordion once discovered.
- One-shot teaching narration (`pickaxeRecipeHint` REVEAL_STAGE) the
  first time the player has 3 stones AND 2 sticks placed on the grid
  AND no pickaxe yet.

## 5. Iron ore — inventory resource

`game.inventory.ironOre: 0` (new field). Visible in the **inventory
rail** above the merge grid as a third tile (after sticks, stones)
showing `[O] N`. **Not draggable to the grid** in this spec — no recipe
consumes it yet. Ships as a visible counter only; future
recipe/smelter integration is a separate effort.

Stats counter: `game.stats.ironOreMined` (monotonic, for achievements
and future gating).

## 6. Respawn (grove + quarry, shared)

Replaces the grove's current one-shot `collected: true` boolean with a
timestamp model:

```js
RESPAWN_MS_BASE = 2 * 60 * 1000   // 2 minutes
// per-item, set on collect:
item.respawnAt = Date.now() + RESPAWN_MS_BASE * (0.5 + Math.random())
// → 1–3 min per item, naturally staggered
```

On scene render AND on a slow tick (every 10s while a location modal
is open), each item with `respawnAt && respawnAt < Date.now()` clears
its respawn flag and renders as available. Offline-friendly — pure
timestamp comparison; no active timer needed when the modal is closed.

**Save model:**

```js
game.location = {
    grove: {
        items: [{ id, kind, respawnAt: null|number }, ...]
    },
    quarry: {
        items: [{ id, kind, respawnAt: null|number }, ...]
    }
}
```

**Migration.** Existing grove saves currently store `collected: true`
booleans. On load, any `collected: true` item is rewritten to
`{respawnAt: 0}` — meaning "respawned in the past, available now."
Players returning to a previously-cleared grove see it freshly stocked.
This is acceptable because we have no live players (project_pre_launch
memory).

## 7. Architectural decisions

- **Reuse, don't fork.** `lockBodyScroll`, `autofitGroveScene`, depth
  tinting, fog stipple, sprite overlay, and the modal lifecycle are all
  generalized to accept a scene root rather than copy-pasted. The
  grove and quarry use the same render core, parameterized by ASCII
  data + item config.
- **Picture-as-UI preserved.** Item buttons remain inline `$`
  placeholders replaced at render time, exactly like the grove. No
  separate "interact list" — the scene IS the UI.
- **Mining is global, not per-node-concurrent.** Only one ore can be
  mined at a time. Tapping a second node while a mining bar is active
  just cancels the first (matches log-gather behavior).

## 8. New / changed surfaces

| Area | Change |
|------|--------|
| `game.js` | `QUARRY_*` constants, `renderQuarry()`, `enterQuarry()`/`exitQuarry()`, `mineIronOre()` + `cancelMineOre()`, `matchPickaxe()`, `pickaxeRecipeHint` REVEAL_STAGE, `quarryUnlock` REVEAL_STAGE, respawn helpers `tickRespawns()`, save migration, generalize `autofitGroveScene()` to take a scene id |
| `index.html` | Quarry modal markup (`#location-quarry`, `#quarry-scene`, mining-bar UI), iron-ore inventory rail tile |
| `style.css` | Quarry modal styling, mining-bar fill animation, `[O]` ore-node styling, "dense forest" connector treatment |
| `service-worker.js` + `APP_VERSION` | Bumped together (workflow rule) |
| `CLAUDE.md` | Quarry section under "Trial Locations", respawn note, pickaxe recipe, BACKLOG note for log-gate |
| `cowork/BACKLOG.md` | New entry: bump log-gate before ship |

## 9. Out of scope (deferred)

- Iron-ore consumption — no recipe, no smelter pipeline integration yet.
  Pure visible counter for now.
- Quarry-specific upgrades.
- Heat coupling for mining (deferred per Q5 brainstorm).
- Multi-mine concurrent extraction.
- Rare ores / ore variants beyond iron.
- Cave opening as a navigable sub-location (door is decorative for now).

## 10. Open questions for spec review

None at design time — flagged for the user to surface during review.
