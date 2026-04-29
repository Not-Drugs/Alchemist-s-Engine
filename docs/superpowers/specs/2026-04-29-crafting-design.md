# Crafting System — Design

**Date:** 2026-04-29
**Status:** Approved (brainstorming complete; implementation plan pending)
**Scope:** v1 — ship the crafting mechanic + first recipe (Stick Golem). Golem behavior (assignment, chores, heat drain) is deferred. Axe and any other recipes are deferred.

---

## Goal

Add a Minecraft-style pattern-crafting layer to the Alchemical Table so the player can drag ingredients onto the merge grid in specific shapes and craft items. Ship one recipe end-to-end (the Stick Golem) as proof the mechanic works. Defer everything golems and axes *do* — those are follow-up specs.

## Locked-in decisions

| Decision | Value |
|---|---|
| Crafting surface | Existing 6×4 merge grid (dual-purpose, option A) |
| Confirm interaction | Tap a contextual `[Craft <name>]` button below the grid |
| Pattern matching | Anchor-free — recipe shape can appear anywhere on the grid |
| Recipe discovery | Hybrid (option C) — first recipe taught by narration, subsequent recipes appear in a Recipes panel on first craft |
| Inventories | Three: **Inventory** (raws), **Alchemy Satchel** (any fuel-tier item), **Key Items Bag** (crafted output, placeholder for v1) |
| UI layout | Approach 2 — dedicated Inventory and Satchel rails directly above the merge grid; Recipes and Key Items Bag as collapsible/modal toggles below the grid |
| First recipe | Stick Golem — 4 sticks (ingredient, kind:`stick`) in a `+` around 1 tier-1 fuel (spark) at the center; 5 cells total |
| Auto-merging | Fuel and ore tiles continue to auto-merge on match. Ingredient tiles never auto-merge — they sit where placed until consumed by a craft or returned to Inventory. |

## Data model

New state buckets on `game`:

```js
game.inventory = { sticks: 0, stones: 0 }    // raw mats; counted ints; drag source
game.satchel   = []                           // [{type:'fuel'|'ore', tier:1..N, count:1+}, ...] — soft cap 8 stacks
game.keyItems  = []                           // [{type:'golem', id:'<uuid>'}, ...] — soft cap 8 items (no stacking)
game.flags     = game.flags || {}             // existing pattern; reused for narration flags
game.flags.discoveredRecipes = game.flags.discoveredRecipes || {}  // { stickGolem: true, ... }
```

Inventory keys map 1:1 to raw mats (currently `sticks` and `stones`; existing top-bar pills are sourced from `game.resources.sticks` / `.stones` and migrate over — see Migration).

Satchel and Key Items Bag are arrays so the UI can render fixed slots in a stable order. Soft cap 8 each for v1; cap is enforced at insert time with a "full" toast and the source drag returning to origin.

### New grid tile kind: `ingredient`

Existing tiles have shape `{type:'fuel'|'ore', tier:N}`. Add a new third kind:

```js
{ type: 'ingredient', kind: 'stick' | 'stone' }
```

Drop and merge handlers explicitly skip merge logic for `ingredient` tiles. They are placed, moved, and removed but never combine. They are consumed only by a successful craft.

### Recipe registry

New constant in `game.js`:

```js
const RECIPES = [
  {
    id: 'stickGolem',
    name: 'Stick Golem',
    output: { type: 'golem' },   // template; craft flow expands with a fresh id, e.g. {type:'golem', id:randomId()}
    pattern: {
      shape: 'plus',
      center: { type: 'fuel', tier: 1 },
      arms:   { type: 'ingredient', kind: 'stick' },
    },
  },
  // future recipes appended here
];
```

Pattern shape `'plus'` means: one center cell + four orthogonal neighbors. v1 supports only this shape; the pattern matcher is structured so other shapes (`'square'`, `'line'`, etc.) can be added later without re-architecting.

## UI layout (mobile portrait)

```
┌─────────────────────────────────────────┐
│ ┌─ Alchemical Table ────────────────────┐│
│ │ Inventory: [/x23] [#x4]               ││  ← rail 1: raws (draggable)
│ │ Satchel:   [*x2] [**x1] [_] ... [_]   ││  ← rail 2: fuel-tier (drag source + drop target)
│ │                                       ││
│ │ ┌─────────────────────────────┐       ││
│ │ │ . . . . . .                 │       ││
│ │ │ . . . . . .                 │ ← 6×4 merge grid (unchanged geometry)
│ │ │ . . . . . .                 │       ││
│ │ │ . . . . . .                 │       ││
│ │ └─────────────────────────────┘       ││
│ │                                       ││
│ │ [ Craft Stick Golem ]   ← contextual; appears only when a recipe matches
│ │                                       ││
│ │ [Recipes ▾]   [Key Items: 0]          ││  ← collapsibles (panel + modal trigger)
│ └───────────────────────────────────────┘│
```

### Inventory rail

- Renders one tile per raw mat with a count badge: `[/x23]` (stick), `[#x4]` (stone).
- Tile is the drag source. `touch-action: none` is scoped to these tiles like `.fuel-item` / `.ore-item`, so drag commits immediately on touch (no hold).
- A tile with count 0 renders dimmed and is not draggable.
- Drop target: yes — drag a grid `ingredient` tile back onto its matching Inventory tile to return it (decrement grid, increment inventory).
- Sticks and stones are removed from the top resource bar entirely once this rail reveals; their counts only appear in the rail.

### Satchel rail

- 8 fixed slots, rendered as `[glyph x N]` if occupied, `[_]` if empty.
- Drop target: drag any `fuel` or `ore` tile from the grid onto the rail. If a slot with matching `type`+`tier` already exists, its `count` increments. Otherwise a new slot is appended. If neither (no match AND already 8 stacks), toast "Satchel full" and the drag returns to source.
- Drag source: drag from a satchel slot back to a grid cell to deploy the tile (slot's `count` decrements; the slot is removed from the array when count hits 0).
- Stacking model: same `type`+`tier` pairs share one slot with a `count` badge. Different tiers (e.g. tier-1 spark vs. tier-2 ember) occupy separate slots. The 8-slot cap counts distinct stacks, not individual tiles.

### Recipes panel (`[Recipes ▾]`)

- Inline accordion (not a modal), expands directly below the grid.
- Lists every recipe in `RECIPES` whose `id` is present in `game.flags.discoveredRecipes`.
- Each entry renders the recipe name, the pattern as a small mini-grid drawing (e.g. a 3×3 with the `+` shape filled), and the ingredient legend.
- Hidden entirely until the first recipe is taught (see Reveal triggers).

### Key Items Bag (`[Key Items: N]`)

- Small button below the grid. Tap opens a modal listing `game.keyItems` as inert tiles (golem icon, count). v1: no interaction inside the modal beyond viewing.
- Hidden until the first successful craft.

### Contextual Craft button

- Rendered directly below the grid when `findRecipeMatch(grid)` returns non-null.
- Label: `[ Craft <recipe.name> ]`.
- Tap-only (no hold).
- Disappears the moment the pattern is broken (player picks up an ingredient, swaps a tile, etc.) or the destination bag is full.

## Interactions & data flow

### Drag actions

| Drag from | Drag to | Effect |
|---|---|---|
| Inventory tile (count > 0) | Empty grid cell | `inventory[kind]--`; place `{type:'ingredient', kind}` on cell. |
| Grid (ingredient) | Inventory tile of matching kind | Remove from cell; `inventory[kind]++`. |
| Grid (ingredient) | Inventory tile of different kind | Reject (no-op; drag returns). |
| Grid (ingredient) | Empty grid cell | Move (no merge, no drag-return). |
| Grid (fuel/ore) | Satchel rail (matching stack or fewer than 8 stacks) | Stash: clear cell; insert into satchel (increment matching stack's count, or append a new stack). |
| Grid (fuel/ore) | Satchel rail (8 stacks, no matching stack) | Toast "Satchel full"; drag returns. |
| Satchel slot | Empty grid cell | Deploy: place tile on cell; decrement satchel slot's count (remove slot when count hits 0). |
| Satchel slot | Grid cell with matching `type`+`tier` | Merge into existing grid tile per existing rules; decrement satchel slot's count. |
| Grid (fuel/ore) | Grid (fuel/ore matching) | Existing merge behavior, unchanged. |
| Grid (fuel/ore) | Furnace / Smelter | Existing behavior, unchanged. |

All drags are immediate. The engine ASCII keeps its 300ms hold for spark-drag (multi-purpose surface); rails and grid items don't have that ambiguity, so no hold.

### Pattern matching

Run after every grid mutation (place, remove, merge, deploy, stash):

```js
function findRecipeMatch(grid) {
  for (const recipe of RECIPES) {
    if (recipe.pattern.shape === 'plus') {
      const cells = matchPlus(grid, recipe.pattern.center, recipe.pattern.arms);
      if (cells) return { recipe, cells };
    }
  }
  return null;
}

function matchPlus(grid, centerSpec, armSpec) {
  const W = 6, H = 4;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const c = grid[y * W + x];
      if (!matchesSpec(c, centerSpec)) continue;
      const arms = [
        grid[(y - 1) * W + x],
        grid[(y + 1) * W + x],
        grid[y * W + (x - 1)],
        grid[y * W + (x + 1)],
      ];
      if (arms.every(a => matchesSpec(a, armSpec))) {
        return [
          y * W + x,
          (y - 1) * W + x,
          (y + 1) * W + x,
          y * W + (x - 1),
          y * W + (x + 1),
        ];
      }
    }
  }
  return null;
}

function matchesSpec(cell, spec) {
  if (!cell || !spec) return false;
  if (cell.type !== spec.type) return false;
  if (spec.tier !== undefined && cell.tier !== spec.tier) return false;
  if (spec.kind !== undefined && cell.kind !== spec.kind) return false;
  return true;
}
```

The matcher ignores edge candidates (a `+` center on the perimeter would have arms off-grid). First match wins; v1 has only one recipe so this is unambiguous.

The most recent match is cached on `game._recipeMatch` (transient — not persisted). `updateUI()` reads it to show or hide the Craft button.

### Craft flow

1. Player taps `[Craft Stick Golem]`.
2. Defensive re-check via `findRecipeMatch` (button is reactive, so this is belt-and-suspenders).
3. Clear the 5 matched cells (`grid[i] = null` for each).
4. If `game.keyItems.length >= 8`: toast "Key Items full"; abort. (Defensive — the button should already be disabled in this case; see Edge cases.)
5. Push `{type:'golem', id:randomId()}` onto `game.keyItems`.
6. `floatPopup(craftBtn, '+golem', 'gear')`; `sfx('craft')`.
7. Set `game.flags.discoveredRecipes.stickGolem = true`.
8. If this is the first ever craft of any recipe, reveal the Recipes panel and the Key Items button via `revealEl(...)` calls.
9. Re-run `findRecipeMatch`; button hides (the spark and 4 sticks are gone).
10. `updateUI()` re-renders inventory rail, key items count, etc.

### First-recipe narration (one-shot)

Add a new entry to `REVEAL_STAGES`:

```js
{
  id: 'golemRecipeHint',
  cond: g =>
    !g.flags?.golemRecipeTaught &&
    (g.inventory?.sticks ?? 0) >= 4 &&
    hasTier1FuelOnGrid(g),
  narrate: 'Four sticks crossed about a single spark... place them on the table.',
  onReveal: () => { game.flags.golemRecipeTaught = true; }
}
```

Where `hasTier1FuelOnGrid(g)` is a small helper: `g.grid.some(c => c?.type === 'fuel' && c.tier === 1)`.

This fires once when the player first has both materials simultaneously and stays silent thereafter. After this fires, the Recipes panel reveals (empty initially); the Stick Golem entry is added on first successful craft.

## Reveal triggers

| Element | Trigger |
|---|---|
| Inventory rail | When the Alchemical Table reveals (`peakHeat >= 1000`) — same moment as the merge grid. Sticks/stones leave the top resource bar at this point. |
| Satchel rail | Same trigger as Inventory rail. |
| First-recipe narration | `inventory.sticks >= 4 && hasTier1FuelOnGrid(g)` — see narration block above. |
| Recipes panel button | After first-recipe narration fires (panel exists but is empty until the recipe is crafted). |
| Key Items Bag button | After first successful craft. |
| Craft button | Contextual — visible whenever `findRecipeMatch(grid) !== null`. |

## Save state & migration

New persisted fields on `game`:

```
inventory:                { sticks: 0, stones: 0 }
satchel:                  []
keyItems:                 []
flags.discoveredRecipes:  {}
flags.golemRecipeTaught:  false
```

**Migration on load** (in the existing save-load path):

- If `game.inventory` is missing, create it from `game.resources.sticks` and `game.resources.stones` (carry the existing counts forward).
- If `game.satchel` is missing, set to `[]`.
- If `game.keyItems` is missing, set to `[]`.
- Ensure `game.flags` exists; default `discoveredRecipes` to `{}` and `golemRecipeTaught` to `false`.
- After migration, set `game.resources.sticks = 0` and `game.resources.stones = 0` (the source of truth has moved to `game.inventory`). All existing reads/writes of `game.resources.sticks/.stones` are updated to `game.inventory.sticks/.stones` in the same change.

This is a non-breaking migration for the player (their counts carry over). Per the project's pre-launch policy, no refund logic is needed for any incidental losses.

`APP_VERSION` and `CACHE` must be bumped together when the implementation lands.

## Edge cases & defensive checks

| Case | Behavior |
|---|---|
| Drag stick from Inventory tile when count = 0 | Tile renders dimmed and `dragstart` is rejected before drag begins. |
| Pattern broken between Craft tap and dispatch | Defensive re-check inside the click handler returns null → no-op (button should already be hidden). |
| Satchel full, drag fuel onto rail | Toast "Satchel full"; drag returns. No partial state change. |
| Key Items Bag full at craft time | Craft button renders disabled with tooltip "Key Items Bag full"; tap is rejected. |
| Save loaded with missing fields | Migration sets defaults (see above). |
| Save loaded where `inventory.sticks` and `resources.sticks` both have values | Take the max during migration (defensive against partially-migrated saves), then zero out `resources.sticks/.stones`. |
| Player drops an ingredient on a non-empty grid cell | Reject (drag returns). Ingredient tiles do not displace. |
| Player drops fuel/ore on a cell that already holds an ingredient | Reject (drag returns). Ingredients are not overwritten by fuel drops. |

## Out of scope (v1)

- Golem behavior — assignment, chore execution, heat drain. Golems sit inert in the Key Items Bag.
- Axe — recipe, crafting, button it unlocks, what chopping wood actually does.
- Recipes beyond the Stick Golem.
- Dragging items out of the Key Items Bag (modal is read-only in v1).
- Drag-from-Recipes-panel (e.g. tap a recipe to auto-arrange the grid).
- Stash hotkey / shift-click bulk operations on rails.
- New visuals for the rails beyond plain text tiles in the existing CRT aesthetic.

## Verification

Manual only — this codebase has no automated test infrastructure.

End-to-end happy path:

1. Load a fresh save; gather 4 sticks (or load past Phase 1).
2. Reach the Alchemical Table (`peakHeat >= 1000`); confirm the Inventory and Satchel rails appear above the grid and that sticks/stones leave the top resource bar.
3. Spawn a tier-1 fuel (spark) onto the grid via the engine drag.
4. Confirm the narration beat fires: "Four sticks crossed about a single spark..."
5. Confirm the empty Recipes panel button appears.
6. Drag 4 sticks from the Inventory rail onto the grid in a `+` around the spark.
7. Confirm `[Craft Stick Golem]` button appears below the grid.
8. Tap it; confirm the 5 cells clear, the toast/popup fire, and the Key Items Bag button appears with `Key Items: 1`.
9. Open the Key Items modal; confirm the golem tile is listed.
10. Open the Recipes panel; confirm the Stick Golem entry is listed with the `+` pattern drawn.

Edge-path checks:

- Satchel: drag a tier-2 ember from the grid onto the Satchel rail; confirm it stashes. Drag it back; confirm it deploys.
- Satchel full: stash 8 items; try a 9th; confirm "Satchel full" toast.
- Pattern break: build a `+`, then pick up one stick before tapping Craft; confirm the button vanishes.
- Migration: load a save from before this change; confirm sticks/stones carry over into the Inventory rail and that the top resource bar no longer shows them.

## Open questions deferred to follow-ups

- **Golem assignment UI** — A (Golems panel), B (drag onto action button), or C (visible mini-slot beside each action). Discussed in brainstorming, parked.
- **Axe behavior** — unlocks a button (TBD what button) once owned; chops wood for logs. Logs are a future ingredient.
- **Stick golem heat drain rate, gather rate** — pending the assignment design.
- **Logs as a fuel tier vs. a separate raw mat** — pending axe design.
- **Key Items Bag interaction model** — currently read-only modal; revisit when first crafted item gains real behavior.
