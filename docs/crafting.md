# Crafting (v1) — Detailed Reference

The Alchemical Table doubles as a crafting surface. Three storages drive the
economy:

- **Inventory rail** (above the grid) — raw mats: `sticks`, `stones`. Drag
  onto a grid cell to place an `ingredient` tile; drag back to the rail to
  return. Sticks/stones live here, not in the top resource bar.
- **Alchemy Satchel rail** (below Inventory) — 8 slots holding any fuel/ore
  tile from the grid. Stash by dragging a fuel/ore tile onto the rail;
  matching `type+tier` stacks share a slot with a count badge. Deploy by
  dragging a slot back to the grid (empty cell or matching merge target).
- **Key Items Bag** — modal opened by `[Key Items: N]`. Inert read-only
  list of crafted items. Soft cap 8.

A new tile kind `ingredient` (`{type:'ingredient', kind:'stick'|'stone'}`)
sits on the grid without auto-merging. Fuel/ore merging explicitly skips
when `draggedItem.type === 'ingredient'`.

**Pattern matcher** (`findRecipeMatch` in `game.js`) runs after every grid
mutation via `updateUI`. Anchor-free — the pattern can appear anywhere on
the 6×4 grid (excluding cells where arms would fall off). When matched, a
contextual `[Craft <name>]` button surfaces below the grid; tap consumes
the cells and pushes the output to `keyItems`.

## Recipes

- **Stick Golem** — `+` shape: 4 sticks orthogonal around a tier-1 fuel
  (Spark). Taught by a one-shot narration beat (`golemRecipeHint` in
  `REVEAL_STAGES`) the first time the player has 4 sticks AND a tier-1
  fuel on the grid. Subsequent recipes are surfaced in the
  `[Recipes ▾]` accordion (`renderRecipesPanel()`).
- **Wooden Axe** (`shape: 'axe'`, `matchAxe()`) — 3 sticks vertical + 1
  stone to either side of the topmost stick. `canCraft` guard skips the
  match once an axe is in `game.keyItems` so the button stays hidden on
  later visits. Yields `{type:'axe'}`, displayed as `[/]` in the bag.
  Triggers the `logControls` REVEAL_STAGE.
- **Pickaxe** — Minecraft-style: three stones in a horizontal row, with
  two sticks vertically below the center stone (5 ingredients). Matched
  by `matchPickaxe()`. `canCraft` guard skips once a pickaxe is in
  `keyItems`. Yields `{type:'pickaxe'}`, displayed as `[T]`. The
  `pickaxeRecipeHint` REVEAL_STAGE fires once the player has 3 stones +
  2 sticks AND no pickaxe yet.

## Axe → Logs economy

`LOG_GATHER_MS = 60000` (60s/log). `LOG_FUEL_VALUE = 60` (≈60s of burn,
20× a stick). `game.inventory.logs` tracks stored logs.
`startLogGather` / `cancelLogGather` mirror the stick-gather pattern
with a warm-amber `.log-btn-fill`. `cancelLogGather(false)` is called in
`onPageHide` alongside `cancelStickGather(false)`.

## Functional golems (`game.golems.assignments`)

Stick Golems are explicitly assigned to a resource workstation. Each
assigned golem performs one action every `GOLEM_ACTION_MS` (5s), costing
`GOLEM_HEAT_COST` (1 heat):

- `sticks` job → **gather** (+1 stick, +1 `sticksGathered`). Stick
  Golems do not feed the engine — feeding stays a player action until
  a future automation upgrade ships.
- If `resources.heat < GOLEM_HEAT_COST` → idle silently; row hint shows
  "no heat — paused".

`game.golems.assignments` is a `{ jobKey: count }` map. The only job
today is `sticks`; future variants (logs, stones) will add their own
keys without a schema change. Cap is enforced globally:
`sum(assignments) ≤ min(getGolemMaxActive(), countGolemsInBag())`.
`getGolemMaxActive()` returns 1 by default, 2 once
`GOLEM_LEVEL2_UPGRADE_ID` (`'efficiency3'`, Arcane Vents at 1000 heat).

UI: a `[G] Gatherers: [-] N / max [+]` row sits inside `#stick-controls`
right next to the manual `[Gather Stick]` button — assignment is
contextual to the workstation, not centralized in the bag. The Key
Items modal renders a passive count tile only ("Assign at workstations").
`_golemAccums` / `_golemLastActions` are module-level transients
keyed by job (`{ sticks: [ms,...] }`) rebuilt by
`ensureGolemTransient()` — only the assignment counts persist.

Migration on load: any legacy `game.golems.active` (single-count
auto-decide model) is rolled into `game.golems.assignments.sticks`,
then deleted from save.

## Save state

New top-level fields: `game.inventory`, `game.satchel`, `game.keyItems`,
`game.flags.discoveredRecipes`, `game.flags.golemRecipeTaught`,
`game.golems`. Migration on load moves any legacy
`game.resources.sticks`/`.stones` into `game.inventory.*` (taking the
max defensively if both exist).

## Land-mines (v60–v70 lessons)

Each is a one-line warning + the file/fn to look at:

- **Singular kind vs. plural inventory key.** On-grid `kind` is
  `'stick'`/`'stone'`; inventory keys are `sticks`/`stones`. Always
  translate via `invKeyForKind(kind)` — mixing reads as `count === 0` and
  silently bails the drag (v64 fix).
- **Satchel slots update in place — never `replaceChildren()` on a touch
  source.** Removing a touched element fires `touchcancel` and clears the
  drag; `renderSatchelRail` mutates contents only (v66 fix).
- **Satchel-clearing branches in every drop target.** `applyFuelDropOnEngine`,
  the smelter drop handler, and `dispatchTouchDropOnZone` all need
  `if (draggedItem.fromSatchel) { slot.count -= 1; ... }` — without it,
  satchel→engine drops are free fuel (v67 fix).
- **`.craft-row[hidden]` / `.ki-modal--hidden` use class+attribute selectors
  for higher specificity than the bare `display: flex` rules.** The HTML
  `[hidden]` attribute alone loses to a class with equal specificity on
  source order (v61 + v65 fixes).
- **Ingredients never auto-merge.** Both `handleDrop` and
  `dispatchTouchDropOnGrid` guard with `draggedItem.type !== 'ingredient'`
  — without it, two ingredients combine to a tier-undefined cell.
- **Don't mutate an HTML5 drag source's children mid-drag.** Chrome
  desktop cancels the drag the instant `furnaceAscii.textContent = …`
  rewrites children, and the 10Hz game loop reaches that branch within
  100ms of `dragstart`. `updateUI()` skips the engine animation rebuild
  while `.engine-dragging` is on the element; `handleEngineDragEnd`
  removes the class so the next tick repaints. Touch isn't affected
  (its ghost is a separate element), but the same skip is applied for
  consistency.
