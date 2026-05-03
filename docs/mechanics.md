# Game Mechanics — Detailed Reference

For top-level overview see CLAUDE.md. This file holds the deeper detail.

## Stick Phase (opening — peakHeat < 1000)

The game opens as a manual labor loop. The merge grid, sparks, and the rest
of the engine are hidden until the player has pushed heat to the
`PHASE_1_HEAT_TARGET` (1000) at least once. Narratively this is "burning
the arcane soot off a long-dormant engine," but the soot itself is not
exposed in the UI — the player just sees a heat target.

At base rates (1 fuel/sec burn, 10 heat/fuel, 1 stick = 3 fuel) reaching
1000 heat takes ~34 sticks fed; with the Stick Basket (4 sticks/trip in
5s) Phase 1 lands around 2-3 minutes of active play.

Player-facing surfaces:

- A **Heat bar** (`#engine-heat-readout`) sits inside the engine
  column directly above the Fuel bar. During Phase 1 it renders as
  `Heat: [▓▓░░] 470 / 1000` with the `+10/s` rate on a second line;
  after Phase 1 the bar hides and only the unbounded number remains.
  Heat is intentionally NOT duplicated in the top resource bar —
  metal/alloy/etc still live there for later phases.
- Narration beats fire as `peakHeat` crosses 25, 50, 75, and 100% of
  the target (`sootBeat1`/`2`/`3` at 250/500/750 and the `mergeGrid`
  reveal at 1000). The 100% reveal triggers a `screenFlash` and
  `screenShake('big')` to mark the moment.
- An **ember-core glow** (red text-shadow on the engine's inner ASCII
  face) pulses softly when the furnace is out of fuel but
  `game.resources.heat > 0`. Sells the idea that heat is the engine's
  *reserve*, not just the current burn. See `.ember-core` spans in
  `renderBareEngineAscii()`.

`peakHeat` is monotonic — heat dips don't roll progress back. Existing
saves past Phase 1 are auto-migrated (`peakHeat = target`) on load.

- **Gather Stick** — 3-second progress-bar action that yields
  `bonuses.sticksPerGather` sticks (default 1). Always visible.
- **Feed Stick** — consumes 1 stick, adds `STICK_FUEL_VALUE` (3) fuel to the
  furnace. One tap = one stick; bulk feed will return as an upgrade.
- Sticks are a counted resource (`game.resources.sticks`), not a grid item.

The Engine column lays out top-to-bottom as: stick controls → log controls
(hidden until Wooden Axe crafted) → engine ASCII visual (with temp badge
top-right and fuel meter beneath the art) → fuel drop zone → Burn All
button. This keeps the drop zone close to the merge grid in the right
column so fuel drags are short.

**Stick upgrades** (Furnace tab, costType `'sticks'`, top of list — appear
once the Upgrades panel reveals at `kindlingAdded >= 3`):

- **Stick Basket** (5 sticks) — `sticksPerGather = 4`, `stickGatherMs = 5000`.
  Trip is slower (3s → 5s) but yields 4 sticks instead of 1, so the rate
  goes from 0.33/s → 0.8/s (2.4× base). Flavor: "It takes sticks to make
  sticks." (the basket is woven from the resource it produces).

The merge grid reveal at `peakHeat >= PHASE_1_HEAT_TARGET` (1000) ends
the stick phase and seeds two Sparks on the grid as a tutorial nudge.

## Progression Tiers

1. **Alchemical Table + Furnace** (unlocks at `peakHeat >= 1000`)
   - 6×4 drag-and-drop merge grid; 8 fuel tiers Spark → Solite, each merge triples value
   - Drop fuel on the engine to feed; **sparking costs 1 heat** (Auto-Sparkers bypass)
   - **Bidirectional engine drag** — `#furnace-ascii` is both a drop target (feed fuel) and a drag source (spawn a Spark, costs 1 heat). `draggedItem.fromEngine` flag routes through `engineDropOnCell()`. The engine drop handler explicitly rejects `fromEngine` drops so a Spark can't loop back into the furnace. Touch surface is the ASCII region only — the wider `#furnace-visual` gets visual feedback via CSS `:has()`.
   - **Press-and-hold (300ms) to start a spark drag on touch.** `handleEngineTouchStart` arms the drag only on a deliberate hold; `ENGINE_HOLD_MOVE_TOLERANCE` (8px) abandons on early movement so quick swipes still scroll. Border ramps to fire-orange via `.engine-charging`; commit fires a 25ms vibration via `hapticTap`.
   - **Grid item drag is immediate (no hold).** `touch-action: none` is scoped to `.fuel-item` / `.ore-item` only — empty cells and drop zones keep default `touch-action` so swipes scroll the page.
   - **Convenience-button gating.** Three quick-action buttons unlock by sacrificing a high-tier item dropped on a slot:
     - `[+] Spark` (merge section) ← Blazite (fuel tier 6)
     - `[»] Burn All Fuel` (engine column) ← Infernite (fuel tier 7)
     - `[»] Smelt All Ore` (smelter) ← Pure Crystal (ore tier 5)

     State is recorded in `game.upgrades` as `'sparkUnlock'` / `'burnAllUnlock'` / `'smeltAllUnlock'` and replayed on load via `applyUnlocksFromSave()`. Manual paths stay available pre-unlock so the player is never blocked.

2. **Smelter** (unlocks at 500 Heat) — spawn ore for 10 Heat; 5 ore tiers merge like fuel; requires furnace temp ≥100° to smelt; produces Metal.

3. **Forge** (unlocks at 100 Metal) — 5 Metal → 1 Alloy.

4. **Workshop** (unlocks at 50 Alloy) — 3 Alloy → 1 Gear; build automation: Auto-Sparker (10g), Auto-Miner (25g), Heat Amplifier (50g, +50% heat each).

5. **Sanctum** (unlocks at 500 Gears + Essence Condenser) — Essence generates passively from furnace temperature. Prestige: spend 1000+ Essence for Philosopher's Stones (+25% all production each, permanent).

## Heat Decay (idle)

Heat is not a permanent accumulator. When the furnace is idle
(`game.furnace.fuel === 0`), `game.resources.heat` decays via two
layered terms — exponential plus a linear floor:

```
expLoss   = heat × (1 − (1 − decayRate)^delta)
floorLoss = MIN_HEAT_DECAY_PER_SEC × delta
heat     -= max(expLoss, floorLoss)
```

- Default `decayRate = 0.005` (0.5% of current heat per second). True
  exponential — half-life ≈ 139 seconds regardless of starting heat.
- `MIN_HEAT_DECAY_PER_SEC = 0.1`. The floor takes over when the
  exponential term shrinks below it (around heat ≤ 20). Without the
  floor a small puddle would linger near-forever.
- Runs only in the foreground game loop; offline processing does NOT
  apply decay.
- Three furnace upgrades form the retention ladder:
  - **Thermal Mortar** (300 heat) — `decayRate = 0.002` (60% slower)
  - **Sealed Crucible** (3000 heat, requires Mortar) — `decayRate = 0`,
    bypasses BOTH terms (the upgrade promises no decay, so the floor
    mustn't kick in either)
  - **Ember Heart** (30000 heat, requires Crucible) — `heatPassiveGen = 0.5`
    heat/sec while idle (multiplied by wisdom)

## Key Game Constants (game.js)

- `FUEL_TIERS` - 8 tiers, values triple (1, 3, 9, 27, 81, 243, 729, 2187)
- `ORE_TIERS` - 5 tiers, same tripling pattern
- `ITEM_KINDS` - **single source of truth** for collectible items (stick,
  stone, ironOre): glyph, label, cssClass, ariaPick, gridTitle, and
  per-kind `respawnMs`. Every renderer (grove pickup, quarry pickup,
  drag ghost, merge-grid ingredient cell) reads from this registry.
- `GRID_SIZE` - 24 cells (6x4)
- `SPARK_HEAT_COST` - 1 (heat per manual spark)
- `STICK_GATHER_MS` - 3000 (base; Stick Basket overrides via `bonuses.stickGatherMs = 5000`)
- `STICK_FUEL_VALUE` - 3 (fuel per stick fed)
- `LOG_GATHER_MS` - 60000 / `LOG_FUEL_VALUE` - 60 (axe-tier gather + fuel)
- `GOLEM_ACTION_MS` - 5000 / `GOLEM_HEAT_COST` - 1
- `PHASE_1_HEAT_TARGET` - 1000 (ends stick phase)
- `EXPLORE_UNLOCK_STICKS` - 50 (Dead Grove gating)
- `MIN_HEAT_DECAY_PER_SEC` - 0.1 (linear floor)
- `RESPAWN_MS_BASE` - 120000 (fallback when an item kind doesn't define
  its own `respawnMs` in `ITEM_KINDS`; current kinds all override:
  stick=60s, stone=180s, ironOre=300s; ±50% jitter at collect time)
- `APP_VERSION` / `CACHE` - **kept in sync** (see `feedback_version_sync.md` memory)
- `UPGRADES` / `ACHIEVEMENTS` (18 with ASCII icons) / `SAVE_VERSION`

## ASCII Visual Style

- Fuel (merge grid): `*`, `**`, `~`, `#`, `##`, `^`, `^^`, `@`
- Ore (merge grid): `o`, `O`, `0`, `()`, `<>`
- **Collectibles** (defined in `ITEM_KINDS`): stick `/`, stone `()`,
  ironOre `[O]`. Use these consistently — every pickup, drag ghost,
  inventory tile, and grid-ingredient cell pulls glyphs from the
  registry.
- Resource icons (top bar): `[~]` Heat, `[#]` Metal, `[%]` Alloy,
  `[*]` Gears, `[+]` Essence
- Buttons: `[+] Spark`, `[>] Forge Alloy`

For new visual work (scene art, item kinds, location variants), the
**`.claude/skills/ascii-scenes/SKILL.md`** skill is the canonical
reference — encodes the kinds + instances pattern, depth tinting,
slope math, sprite tintRowOnPaint behavior, and the 40-col
verification workflow.

## Save System

- Auto-saves every 30s to localStorage under key `alchemistsEngine`
- Also saves on `visibilitychange → hidden` (mobile background / tab switch)
- No manual SAVE button. Export/import modal handles cross-device transfer
  (text + scannable QR code)
- Save codes use a versioned envelope `{ v, ts, game }` (base64 UTF-8 JSON);
  legacy raw-object codes still decode for backward compatibility

## Offline Progress

- On load (and tab return), `processOfflineProgress()` runs if away ≥60s
- Capped at 8 hours, applied at 50% efficiency
- Fuel burns, heat accrues, auto-sparkers/miners fill empty cells (capped
  by grid space), essence generates from residual furnace temperature
