# Engine Level 2 — Design Spec

**Date:** 2026-05-04
**Status:** Awaiting user review

## Concept

The engine progresses through three discrete levels:

- **Level 0** — sooty / dormant. The opening Phase 1 state (current behavior, unchanged).
- **Level 1** — active basic engine. Reached when `peakHeat ≥ PHASE_1_HEAT_TARGET` (1000). The "soot burns off, the furnace activates" beat we ship today. Visually identical to current.
- **Level 2** — fully upgraded engine. Reached after the player buys a suite of 4 incremental upgrades plus a final capstone. Visually richer (more parts, color accents, multi-layer animation).

The Level 2 suite serves as a mid-game progression beat — it sits between the Phase 1 reveal and the eventual Tier 3 phase (Smelter / Forge / Workshop / Sanctum). Players engage with the merge grid + smelter to accumulate the resources each upgrade costs, then return to the engine to apply them.

## Architecture

The engine render path migrates from the current ad-hoc string concatenation in `renderBareEngineAscii()` to the **kinds + instances** pattern already used by quarry v4 and grove v2.

- A new `ENGINE_KINDS` registry holds reusable visual definitions (frame, face, mouth variants, smokestack, vents, etched foundation, viewport, ember cluster).
- A new `renderEngine()` function reads `game.engineUpgrades` (a per-flag boolean record) and computes the **active instance list** for the current state. It then renders cells positionally using the same eviction-map approach as quarry v4.
- Each cell carries `data-kind` and `data-instance` for graphics-tier swap targeting and CSS animation hooks.

This refactor is required because the Level 2 suite needs to add and remove visible parts based on purchased upgrades — the current monolithic string approach can't cleanly do this without becoming a tangle of conditionals.

## Components

### `ENGINE_KINDS` registry

Each kind has `width`, `height`, `rows: [{ content, cls?, opacity? }]`. Tint and opacity follow the same most-specific-wins rule as other scenes (instance.cls > kindRow.cls > inherited).

| Kind                       | Footprint | Always present | Animation                                                  |
|----------------------------|-----------|----------------|------------------------------------------------------------|
| `engine-frame-base`        | 13×8      | Yes (L1+)      | none — surrounding silhouette + face burn flicker          |
| `engine-mouth-slot`        | 5×2       | L1 default     | none                                                       |
| `engine-mouth-toothed`     | 5×2 (cap: 7×2) | L2 incremental | tooth shimmer (root `.roaring`)                       |
| `engine-smokestack`        | 5×3       | L2 incremental | none (static stack)                                        |
| `engine-smokestack-puff`   | 1×1       | with smokestack| char cycle `~`/`'`/space, ~1.5s, only when `.burning`      |
| `engine-side-vent-left`    | 2×3       | L2 incremental | none                                                       |
| `engine-side-vent-right`   | 2×3       | L2 incremental | none                                                       |
| `engine-foundation-etched` | 15×2      | L2 incremental | rune heartbeat on corner `*` cells, ~3s, always animating  |
| `engine-viewport`          | 1×1       | Capstone only  | char cycle `╳`/`─`/`│`, ~0.6s, always                      |
| `engine-ember-cluster`     | 9×1       | Capstone only  | per-ember `◊`/`◈`/`◇` brightness pulse, staggered phases  |

The smokestack puff is its OWN kind (rendered one row above the stack at `row: -1` relative to the stack's origin). Splitting it from the stack means the steam can fade in/out independently while the stack itself stays static. Same pattern can apply to future smoke from vents if we ever want it.

When the capstone is active, `engine-ember-cluster` replaces `engine-face`, `engine-mouth-toothed` widens to 7 teeth (kind config has both 5-wide and 7-wide row sets, capstone selects the wider).

### State-driven instance composition

`renderEngine()` produces an instance list at render time. Pseudocode:

```js
function buildEngineInstances(state) {
    const u = state.engineUpgrades || {};
    const list = [];
    list.push({ kind: 'engine-frame-base', row: 0, col: 0 });
    if (u.smokestack) list.push({ kind: 'engine-smokestack', row: 0, col: 4 });
    if (u.vents)      list.push({ kind: 'engine-side-vent-left',  row: 5, col: 0 },
                                { kind: 'engine-side-vent-right', row: 5, col: 13 });
    list.push({ kind: u.toothedMaw ? 'engine-mouth-toothed' : 'engine-mouth-slot', ... });
    if (u.etchedFoundation) list.push({ kind: 'engine-foundation-etched', ... });
    list.push({ kind: u.capstone ? 'engine-ember-cluster' : 'engine-face', ... });
    if (u.capstone) list.push({ kind: 'engine-viewport', ... });
    return list;
}
```

Order matters for z-stacking: base frame first, mouth/face overlays last.

## Visual Specs

### Pre-capstone composite (all 4 incrementals on)

```
      |||
      |||
     _|||_
    _______
   /       \
=[|  .   .  |]=
=[|  ▽▽▽▽▽  |]=
=[|  △△△△△  |]=
  |_________|
 /───────────\
|*===========*|
```

11 rows × 15 chars. Body `|` at cols 2 and 12. Vents extend cols 0–1 and 13–14 on body rows.

### Level 2 capstone

```
        ~
       |||
       |||
      _|||_
    _________
   /         \
=[|  ◊  ◊  ◊  |]=
=[|  ▽▽▽▽▽▽▽  |]=
=[|  △△△△△△△  |]=
=[|     ╳     |]=
  |___________|
 /─────────────\
|*┄═══════════┄*|
```

12 rows × 17 chars (modest scale-up, not double-size). New: 3rd ember in face, 7-wide maw, internal viewport row, decorative `┄` flanking the etched runes. Steam puff `~` floats above smokestack (animated, transient).

## Animation Hooks

All animations are CSS-driven and scoped via `[data-kind="..."]` selectors. They layer independently — adding one doesn't interfere with the others.

| Hook                     | Selector                                | Behavior                                                              |
|--------------------------|------------------------------------------|------------------------------------------------------------------------|
| `engine-smokestack-puff` | `[data-kind="engine-smokestack-puff"]`   | Char cycles `~` → `'` → fade, ~1.5s, only while `.burning` on root    |
| `engine-ember-pulse`     | `[data-kind="engine-ember-cluster"] span`| Each `◊` cycles between `◊`/`◈`/`◇` per ember, staggered phases       |
| `engine-tooth-shimmer`   | `[data-kind="engine-mouth-toothed"] span`| Color flicker orange↔yellow when root has `.roaring` (temp > 400)     |
| `engine-viewport-spin`   | `[data-kind="engine-viewport"]`          | Char cycles `╳` → `─` → `╳` → `│`, ~0.6s, always                     |
| `engine-rune-heartbeat`  | `[data-kind="engine-foundation-etched"] .rune` | Corner `*` chars pulse opacity 0.4↔1.0 on ~3s cycle, always     |

The smokestack puff char is rendered as a separate cell ABOVE the smokestack kind (`row: -1` relative to smokestack origin). This way the puff can fade independently of the stack itself.

## Persistence

New top-level save field:

```js
game.engineUpgrades = {
    smokestack: false,
    vents: false,
    toothedMaw: false,
    etchedFoundation: false,
    capstone: false
};
```

**Migration:** existing saves get `engineUpgrades = {}` on load (defaults to all-false via `||`-fallbacks at read sites). No SAVE_VERSION bump needed since the schema only adds new optional fields.

## UI / Purchase Flow

Upgrades surface in a new **"Engine Tier 2 Suite"** section at the top of the Furnace tab in the Upgrades panel. Visible once `peakHeat ≥ PHASE_1_HEAT_TARGET` (Level 1 reached).

Section ordering:
1. Smokestack
2. Side Vents
3. Toothed Maw
4. Etched Foundation
5. Capstone — **hidden until all 4 prereqs purchased**

Each upgrade is a `UPGRADES` array entry with the existing upgrade machinery: cost, prereq, narration on purchase, persisted via `game.upgrades`. When purchased:

1. `game.engineUpgrades.<key> = true`
2. Toast confirms purchase
3. `updateUI()` re-renders engine — new part appears
4. Optional one-line narration beat ("Smokestack installed. The engine breathes.")

Capstone purchase additionally triggers a `screenFlash` + `screenShake('big')` to mark the Level 2 transition (mirrors the Phase 1 reveal beat).

## Costs (placeholder for testing)

All 5 upgrades cost **1 stick** each. Final pricing and resource mix is deferred to a balancing pass after the architecture ships and is verified.

## Mechanical Bonuses (deferred)

Visual-only for now. Each upgrade currently has no in-game mechanical effect beyond unlocking its visual layer. Balance pass will assign bonuses (heat retention, fuel efficiency, max heat, etc.) once the visual system is verified working.

## Color Palette

Level 1 stays current rust-brown.

Level 2 introduces a brass-gold accent applied to upgraded parts:
- Smokestack: brass tone (`#c9a05a`)
- Side vents: same brass
- Toothed maw teeth: same brass on body, shimmer to white-hot when `.roaring`
- Etched foundation runes: gold pulse (`#e8c060`)
- Viewport: glowing gold-orange center
- Ember cluster: shifts red→orange-white when capstone active

Body itself stays rust-brown so the upgrades read as "metal additions to the original engine" rather than a wholesale repaint.

## Touch / Drag Targets

The fuel-drop drop target stays `#furnace-ascii` (the engine container). The kinds + instances render preserves this — cells render INSIDE `#furnace-ascii`, not as a replacement. Existing engine drag (long-press → spark spawn) and drag-rejection logic continues to work unchanged.

## Testing

Manual playtest checklist:
- [ ] Level 1 engine renders identically to current (zero visual diff)
- [ ] Buying smokestack alone: smokestack appears, no other change
- [ ] Buying each incremental alone: only that part appears
- [ ] Buying all 4 incrementals: composite matches the spec sketch
- [ ] Capstone unlock requires all 4 prereqs (button hidden until then)
- [ ] Capstone purchase triggers flash + shake
- [ ] Level 2 visual matches the spec sketch (12 rows × 17 chars, viewport, 3 embers, 7 teeth)
- [ ] All 5 animations run independently (no interference)
- [ ] Animation only when relevant (smokestack puff stops when not burning, tooth shimmer only at high temp)
- [ ] Fuel-drag drop on engine still works at all upgrade levels
- [ ] Engine spark drag (long-press) still works at all upgrade levels
- [ ] Save → reload preserves all upgrade flags + visual state
- [ ] Existing save (no engineUpgrades field) loads cleanly with all flags false

Verifier script (mirrors `_check_v4.js` / `_check_grove_v2.js` pattern): given a state + upgrades, compose the merged char grid, diff against the spec's expected output for that state. Run for L1, each incremental-alone, all-incrementals, and capstone states.

## Out of Scope (this spec)

- Final cost balancing
- Final mechanical bonuses
- Tier 3+ engine (any Level 3 or beyond — intentionally not designed yet)
- Engine drag/drop semantic changes
- Smelter integration / cross-engine effects
- Graphics-tier swap (the kinds registry sets us up for it but actual swap is later)
- Alternate engine variants / "skins"

## Open Questions (resolved by user during brainstorm)

- ✅ Trigger for L2: suite of 4 incrementals + gated capstone
- ✅ Each upgrade adds a visible part (vs capstone-only transform)
- ✅ Mouth visual: toothed maw `▽▽▽▽▽` / `△△△△△`
- ✅ Animations: 5 distinct hooks, CSS-driven, layered
- ✅ Costs: 1 stick each (placeholder, balance later)
- ✅ Mechanics: visual-only for now (balance later)

No remaining TBDs.
