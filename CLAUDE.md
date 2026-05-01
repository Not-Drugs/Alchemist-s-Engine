# Alchemist's Engine

An incremental/idle merge game with an ASCII terminal aesthetic.

**Primary target: mobile** (touch-first, installable as a PWA). The page also
runs in desktop browsers, but design decisions favor the mobile experience
— no keyboard shortcuts, touch-sized controls, portrait layout, drag-and-drop
that mirrors HTML5 drag for mouse users. When something has to choose, choose
the touch interaction.

**Primary playtest device: Chrome on Google Pixel** (Android). When fixing
mobile layout bugs, assume Chrome's viewport quirks — the address bar
shrinks/grows the visible viewport, so `100vh` overshoots the visible
height when the bar is showing. Prefer `100dvh` (dynamic viewport height,
adjusts to chrome) for full-bleed layouts on this primary device. Cowork
runs DOM-measurement verification in browser emulation, but Nicholas's
playtest is the canonical visual check, and that's a real Pixel running
real Chrome.

## Project Structure

```
/
├── index.html              # Main HTML structure with ASCII art visuals
├── style.css               # Terminal/CRT aesthetic + responsive mobile layout
├── game.js                 # All game logic in one file
├── qrcode.js               # Inline QR encoder (byte mode, level L, v1–v25)
├── manifest.webmanifest    # PWA manifest — standalone display, portrait
├── service-worker.js       # Offline-first shell cache (stale-while-revalidate)
├── icon.svg                # PWA / apple-touch icon
├── DISPATCH_LOG.md         # Changelog for work shipped via Dispatch sessions
└── CLAUDE.md               # This file
```

## Tech Stack

- Vanilla HTML/CSS/JavaScript (no dependencies, no build step)
- localStorage for save/load
- Pure CSS animations for terminal effects (scanlines, CRT flicker, glow)
- Web Audio API for synthesized SFX (no audio assets)
- Service Worker + Web App Manifest for installable PWA / offline play

## How to Run

- **Desktop**: Open `index.html` in any modern browser.
- **Mobile / PWA**: Serve over http(s) and "Add to Home Screen". The service
  worker registers on http(s) only and is skipped for `file://`.

## Game Mechanics Overview

### Stick Phase (opening — peakHeat < 1000)

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

### Progression Tiers

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

### Crafting (v1)

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

**Recipes:**

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

**Axe → Logs economy.** `LOG_GATHER_MS = 60000` (60s/log). `LOG_FUEL_VALUE
= 60` (≈60s of burn, 20× a stick). `game.inventory.logs` tracks stored
logs. `startLogGather` / `cancelLogGather` mirror the stick-gather pattern
with a warm-amber `.log-btn-fill`. `cancelLogGather(false)` is called in
`onPageHide` alongside `cancelStickGather(false)`.

**Functional golems (`game.golems.active`).** Stick Golems are deployable
workers — each performs one action every `GOLEM_ACTION_MS` (5s), costing
`GOLEM_HEAT_COST` (1 heat):

- If `inventory.sticks > 0` and furnace has room → **feed** (–1 stick,
  +`STICK_FUEL_VALUE` fuel, +1 `kindlingAdded`)
- Else → **gather** (+1 stick, +1 `sticksGathered`)
- If `resources.heat < GOLEM_HEAT_COST` → idle silently; status shows
  "no heat — paused"

`getGolemMaxActive()` returns 1 by default, 2 once
`GOLEM_LEVEL2_UPGRADE_ID` (`'efficiency3'`, Arcane Vents at 1000 heat) is
purchased. Cap also respects `countGolemsInBag()`. Deploy/Recall live in
the Key Items modal as a grouped `Nx (active/max)` tile with `[+]`/`[-]`.
Per-golem `_golemAccums` and `_golemLastActions` are module-level transients
rebuilt by `ensureGolemTransient()` — only the active count persists.

**Save state.** New top-level fields: `game.inventory`, `game.satchel`,
`game.keyItems`, `game.flags.discoveredRecipes`,
`game.flags.golemRecipeTaught`, `game.golems`. Migration on load moves any
legacy `game.resources.sticks`/`.stones` into `game.inventory.*` (taking
the max defensively if both exist).

**Land-mines (v60–v70 lessons).** Each is a one-line warning + the file/fn
to look at:

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

### Heat Decay (idle)

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

### Key Game Constants (game.js)

- `FUEL_TIERS` - 8 tiers, values triple (1, 3, 9, 27, 81, 243, 729, 2187)
- `ORE_TIERS` - 5 tiers, same tripling pattern
- `GRID_SIZE` - 24 cells (6x4)
- `SPARK_HEAT_COST` - 1 (heat per manual spark)
- `STICK_GATHER_MS` - 3000 (base; Stick Basket overrides via `bonuses.stickGatherMs = 5000`)
- `STICK_FUEL_VALUE` - 3 (fuel per stick fed)
- `LOG_GATHER_MS` - 60000 / `LOG_FUEL_VALUE` - 60 (axe-tier gather + fuel)
- `GOLEM_ACTION_MS` - 5000 / `GOLEM_HEAT_COST` - 1
- `PHASE_1_HEAT_TARGET` - 1000 (ends stick phase)
- `EXPLORE_UNLOCK_STICKS` - 50 (Dead Grove gating)
- `MIN_HEAT_DECAY_PER_SEC` - 0.1 (linear floor)
- `APP_VERSION` / `CACHE` - **kept in sync** (see `feedback_version_sync.md` memory)
- `UPGRADES` / `ACHIEVEMENTS` (18 with ASCII icons) / `SAVE_VERSION`

### ASCII Visual Style

- Fuel: `*`, `**`, `~`, `#`, `##`, `^`, `^^`, `@`
- Ore: `o`, `O`, `0`, `()`, `<>`
- Resource icons: `[~]` Heat, `[#]` Metal, `[%]` Alloy, `[*]` Gears, `[+]` Essence
- Buttons: `[+] Spark`, `[>] Forge Alloy`

### Save System

- Auto-saves every 30s to localStorage under key `alchemistsEngine`
- Also saves on `visibilitychange → hidden` (mobile background / tab switch)
- No manual SAVE button. Export/import modal handles cross-device transfer
  (text + scannable QR code)
- Save codes use a versioned envelope `{ v, ts, game }` (base64 UTF-8 JSON);
  legacy raw-object codes still decode for backward compatibility

### Offline Progress

- On load (and tab return), `processOfflineProgress()` runs if away ≥60s
- Capped at 8 hours, applied at 50% efficiency
- Fuel burns, heat accrues, auto-sparkers/miners fill empty cells (capped
  by grid space), essence generates from residual furnace temperature

### Trial Location: The Dead Grove

A separate exploration mechanic, accessible from the **Explore** card below
the Alchemical Table. The card renders a tiny world map: a hollow box icon
for the engine ("you are here") linked by a connector to the grove
(`#grove-enter` button), then to the **Abandoned Quarry**
(`#quarry-enter`) — visual-only for now, clicking shows a "coming soon"
toast. The grove → quarry pattern is the template for future locations.

Tapping the grove opens a fullscreen modal containing a hand-authored
ASCII forest scene. **The picture is the UI** — items embedded in the art
(sticks, stones) are clickable and add to the player's resources. Items
don't respawn yet (proof-of-concept for picture-as-UI).

**Gating.** Locked behind `EXPLORE_UNLOCK_STICKS` (50) cumulative sticks
gathered (`game.stats.sticksGathered`, monotonic — feeding doesn't roll
back). Until unlocked, `#location-grove-locked` shows a live `Sticks
gathered: N / 50` readout. Reveal is the `exploreUnlock` REVEAL_STAGE.

**Scene composition.** 40 cols wide, full-bleed (`100dvh × 100dvw` on
`position: fixed` so Chrome's address bar can't clip). Each row is a flex
of three side-by-side spans:

```
[ left near-tree (10c) | center depth band (20c) | right near-tree (10c) ]
```

Framing trees (`LEFT_NEAR_TREE` / `RIGHT_NEAR_TREE`) run the full vertical;
the center span rotates through depth bands top-to-bottom (horizon → far
→ midfar → mid → midnear → sky), with fog stipple separators between
bands. Atmospheric perspective is per-cell CSS opacity + color tinting on
the depth-class span — `font-size` is **intentionally not** varied per
cell (differing cell sizes inside a flex row collapse the row's total
width and pull the framing trees inward; v45 polish-pass fix).

Two passes of overlay paint on top of the composed rows:

- **Canopy overlay (rows 0–3).** Framing-tree canopy chars overlay onto
  the side spans at one notch brighter than surrounding distant content,
  so the silhouette reads against the treeline. Whitespace lets distant
  content show through.
- **Trunk fade (rows 4–11).** Inline opacity lerps from `0.55` → `1.0`,
  selling "trees rising out of the haze."
- **Foreground sprites** (`FG_SCRAGGLY`, `FG_LEAN`) painted via
  `overlaySprite()`, which only re-classes a row when at least one sprite
  char actually painted (so blank sprite rows don't up-tint the
  underlying band).

**Auto-fit sizing.** `autofitGroveScene()` measures `#grove-scene`'s real
`clientHeight` / `clientWidth` after layout settles, computes the exact
font-size that packs every `.grove-row` into the available space, and
sets it inline. Runs at the end of `renderGrove()` via `requestAnimationFrame`
and on resize/orientationchange. The CSS `clamp()` formula on `.grove-row`
is the first-paint fallback.

Modal lifecycle locks body scroll on open via `lockBodyScroll()` /
`unlockBodyScroll()` (saves and restores `window.scrollY`).

**Items.** Below the scene sit the ground row, an underbrush row, and item
rows. Stones render as `()`, sticks as `/`. When all items are collected,
the three item rows are replaced by spacer / "The grove is empty for now."
/ spacer so the message lands centered without the row count jumping.
`$` placeholders are replaced at render with clickable buttons. Item
layout is versioned via `GROVE_LAYOUT_V` — bumping it resets `collected`
on load for old saves.

**Building blocks** (in `game.js`): `LEFT_NEAR_TREE`, `RIGHT_NEAR_TREE`,
`MID_FAR_*` / `MID_MID_*` / `MID_NEAR_*` slot primitives + `buildBand()`,
`HORIZON_STIPPLE` / `DISTANT_TREELINE` / `FOG_ROW` distant constants,
`FG_SCRAGGLY` / `FG_LEAN` foreground sprites, `GROVE_GROUND_ROW` /
`GROVE_UNDERBRUSH_ROW`, `GROVE_SCENE_ROWS` (pre-computed array consumed
by `renderGrove()`), `GROVE_ITEM_ROWS` + `GROVE_ITEMS`, and
`autofitGroveScene()`.

Future grove ideas (mountain range, litter rows retry) live in
`cowork/BACKLOG.md`.

## Mobile & PWA

- Viewport locked (no pinch-zoom), `viewport-fit=cover` for notched devices
- Touch drag mirrors the HTML5 drag API: `touchstart` on a grid item begins
  a ghost-element drag with the same merge logic as mouse drag. 6px move
  threshold preserves double-tap and long-press as quick-send shortcuts
- Responsive breakpoints at 900px, 600px, 380px, and landscape ≤500px tall.
  6×4 merge grid is preserved on phones by shrinking cells
- `@media (hover: hover)` scoping + `(hover: none) and (pointer: coarse)`
  ensure hover states don't stick on touch and buttons meet the 44×44
  HIG minimum
- `touch-action`, `overscroll-behavior`, `user-select`, JS blockers
  prevent pull-to-refresh, iOS bounce, double-tap zoom, and long-press
  callouts on game surfaces (textareas/narration remain selectable)
- Portrait-preferred: CSS rotate-hint for small landscape;
  `screen.orientation.lock('portrait')` attempted in fullscreen/PWA
- `safe-area-inset-*` padding clears notches and home indicator
- **Use `100dvh` / `100dvw` on full-bleed elements**, not `100vh` / `100vw`.
  Chrome on Android (primary playtest) and iOS Safari overlay the address
  bar, so static `vh` overshoots the visible area and pushes content (e.g.
  the grove modal's [X] button, framing-tree canopy) behind chrome. `dvh`
  tracks the dynamic viewport; `svh` is the safe fallback (assume
  smaller chrome-visible viewport always).
- Game loop pauses on `visibilitychange → hidden`; resuming calls
  `processOfflineProgress()` to fast-forward
- `#furnace-ascii` has `touch-action: none` so the 300ms hold→spark-drag
  flow stays reliable. Trade-off: can't scroll by starting a swipe on
  the engine — players scroll from elsewhere on screen
- `hapticTap(ms)` is the centralized vibration helper — defensively
  wraps `navigator.vibrate` (no-op on iOS Safari). Used by engine-drag
  commit (25ms) and every merge (15ms)

## Development Notes

- Game loop: 10 ticks/sec (100ms `setInterval`). Intervals tracked in
  `_loopIntervals` so they can stop on tab hide
- All UI updates happen in `updateUI()`
- Drag-and-drop supports both HTML5 mouse drag (desktop) and a parallel
  touch-drag implementation (mobile). Both share `draggedItem` /
  `draggedIndex` / `draggedElement` state and reuse the same merge logic
- QR encoder is a self-contained inline library (`qrcode.js`) exposing
  `window.QR.generate(text)` and `window.QR.toSvg(qr, cellSize, margin)`
- Service worker (`service-worker.js`) caches the shell with
  stale-while-revalidate. Bump `CACHE` AND `APP_VERSION` together when
  the shell changes — see Workflow Rules below
- A `[↻]` refresh button next to the version tag self-serves out of any
  stuck-SW state — saves the game, wipes Cache Storage, prods the SW for
  an update, then reloads. See `forceRefresh()`
- Prestige resets everything except: Philosopher's Stones, prestige count,
  achievements, and cumulative stats

## Future Ideas

Deferred design ideas — click-automation upgrades, heat↔temperature
coupling revisit, runic unlock-slot redesign, environment/terraforming
meta-layer, and unsorted one-liners — all live in `cowork/BACKLOG.md`.

## Clean Room Protocol — Reference Material

When taking inspiration from other open-source incremental games (Candy Box
2, A Dark Room, etc.) we observe a strict separation: **read for patterns,
implement in our own voice. Never copy code verbatim.**

- Upstream source goes into `_research/<source-name>/repo/` (gitignored)
- Use shallow clones (`git clone --depth 1 …`) — we only need latest state
- Our own analysis (notes, lessons, pattern summaries) lives in
  `docs/inspiration-notes.md` and is freely committable
- Both Candy Box 2 (GPLv3) and A Dark Room (MPL 2.0) are reciprocal
  licenses. Direct code copy would force our project to inherit those
  obligations. Reading and reimplementing is fine; copying is not
- When adding a new source: create `_research/<name>/`, clone into `repo/`
  underneath, update `docs/inspiration-notes.md` with the patterns to lift

**ASCII art references** are a separate kind of source — not cloned repos
but curated per-category indexes under `_research/ascii-<category>/INDEX.md`
(e.g. `ascii-trees/`, `ascii-fire/`). Each `INDEX.md` carries source URL,
attributed pieces with artist signatures, tags, game-relevance notes, plus
a "style takeaways" section.

- Master index: `_research/ascii-co-uk-INDEX.md` (23+ categories from
  ascii.co.uk grouped by theme; logs URLs that returned typography-only
  so we don't refetch)
- Licensing posture: `_research/ascii-co-uk-LICENSING.md`. The site
  publishes no license, no copyright notice, and no contact info, so we
  treat every piece as **study-only** and paraphrase. When a hand-authored
  piece is recognizably derived, cite the source piece and artist in the
  commit message

This rule applies even when "just borrowing a small function" looks
tempting. Always paraphrase by re-deriving the logic in our own style.

## Cowork Playtest Channel

A file-based ticketing channel for browser-automated playtesting lives
under `cowork/`. **cowork-Claude** runs in a browser session, plays the
game, files bug tickets, and visually verifies fixes after they're
pushed. **terminal-Claude** (this session) claims tickets, fixes them in
code, pushes, and marks `[ready-for-retest]`.

**Quick start.** If the user says **"/cowork"**, **"enter cowork mode"**,
**"cowork mode"**, **"enter ticket mode"**, or **"ticket mode"**, treat
it as a request to enter the cowork playtest workflow: read
`cowork/PROTOCOL.md` and `cowork/README.md`, identify which side this
session is (terminal vs cowork — ask if unsure), and start the
appropriate `/loop` from the README. The terminal-side slash command is
defined at `.claude/commands/cowork.md`.

- `cowork/PROTOCOL.md` — ticket format, status lifecycle, reply convention
- `cowork/README.md` — bring-up steps and paste-ready `/loop` prompts
- `cowork/agent-template.md` — standing rules every dispatched coding
  agent follows (don't push, don't bump version, don't touch inbox, one
  atomic commit, etc.). Orchestrator prompts reference this instead of
  restating rules
- `cowork/BACKLOG.md` — Nicholas-flagged deferred design ideas. Promoted
  into the inbox when ready to ship
- `cowork/PRE_PROD_CHECKLIST.md` — hardening items deferred to before
  public launch (anti-injection: hide `game` from window + save-load
  range validation + `?dev=1` for cowork's test URL)
- `cowork/FEEDBACK.md` — cowork-Claude's playtest design / balance
  observations (separate from bugs)
- `cowork/TEST_LOG.md` — what cowork-Claude has exercised by area, with
  expected/result/ticket per test. Helps future sessions skip
  already-covered ground and focus on gaps. Scope: Phase 1 + Alchemical
  Table + Exploration; smelter/forge/workshop/sanctum out of scope while
  those mechanics may change
- `cowork/inbox.md` — active runtime state, gitignored, append-only
- `cowork/archive.md` — verified tickets evicted from inbox during
  lean-up. Gitignored; local history only
- `cowork/attachments/` — runtime state, gitignored (`.gitkeep`
  preserves the directory)

Status lifecycle: `[new]` → `[claimed]` → `[ready-for-retest]` →
`[verified]`, with `[needs-info]` (terminal bounces back) and
`[reopened]` (retest failed) as branches. `[needs-human]` is an escape
hatch — either Claude side flips a ticket to it when stuck; both loops
then skip it and the user adjudicates before flipping the status back.
The terminal loop only acts on `[new]` and `[reopened]`; the cowork loop
only acts on `[ready-for-retest]` and `[needs-info]` for tickets it
opened.

When fixing a ticket: include the commit SHA in the `[ready-for-retest]`
comment so cowork knows what build to verify against (Pages takes
~30–60s to rebuild after push).

Cowork checks `cowork/inbox.md` at the **start of every turn**, not only
on `/loop` ticks — replies from terminal should be picked up immediately
while cowork is mid-playtest.

## Workflow Rules

These are standing instructions from the repo owner:

- **Always update `CLAUDE.md` before committing** when the change affects
  mechanics, structure, or workflow. Keep this file a faithful mirror of
  the live game.
- **Atomic commits.** One logical change per commit. Prefer several small
  commits to one large one.
- **Work on `main` by default.** Only use a separate branch if explicitly
  told to (or when dispatching a worktree-isolated agent — see below).
- **Always push after a commit** so the GitHub Pages deploy stays current.
- Bump `CACHE` in `service-worker.js` AND `APP_VERSION` in `game.js`
  together whenever any shell file changes. They MUST stay in lock-step;
  drift means the on-page version label disagrees with the served code
  and players can't tell stale-cache from current-build (cowork ticket
  0030 documents the bug this prevents).

### Pre-commit guard: `APP_VERSION` ↔ `CACHE` lock-step

`.claude/settings.json` carries a `PreToolUse` hook on `Bash(git commit*)`
that greps both files and blocks the commit if they disagree. The block
exits 2 with a `BLOCKED:` stderr message naming both versions, so a
forgotten or silently-failed bump can't ship. The hook is committed and
travels with the repo — any Claude Code session in this worktree
inherits it.

If you ever need to bypass it (you almost never should — fix the
underlying drift instead), pass `--no-verify` only with the user's
explicit OK.

### Orchestrator + worktree-isolated agents

For tickets that are big enough to keep a Claude session productive in
parallel (≥15 min of focused work, touching a different file region than
what the orchestrator is editing on `main`), use this pattern:

1. **Orchestrator dispatches a coding agent with `Agent({ isolation:
   "worktree", ... })`.** The Agent tool creates a fresh worktree under
   `.claude/worktrees/agent-<id>/` on a new branch
   `worktree-agent-<id>`.
2. **Agent receives a self-contained prompt** that references
   `cowork/agent-template.md` (the standing rules) plus the specific
   ticket text and any implementation hints. The template carries the
   reusable rules so dispatch prompts stay short.
3. **Agent commits one atomic commit** to its branch and returns the
   SHA + a ≤200-word report. It does NOT push.
4. **Orchestrator merges the branch into `main`** with `git merge
   --squash <branch>`, bumps APP_VERSION + CACHE once for the combined
   delta, composes one commit on `main`, pushes. The squash gives clean
   linear history (one commit per ticket on main, no merge bubbles).
5. **Orchestrator updates `cowork/inbox.md`** with the ready-for-retest
   status + the SHA. Cowork retests the live build.
6. **Cleanup** — `git worktree remove <path>` and `git branch -D
   <branch>` are destructive; ask the user before running either.
   The `/cleanup-worktree` slash command (or
   `bash scripts/cleanup-worktree.sh`) lists all agent worktrees with
   merge status (`merged-ff` / `merged-squash` / `unmerged` / `killed`)
   in read-only preview mode by default; pass `--apply` only after the
   user confirms.

   **Windows file-lock gotcha (2026-05-01).** On Windows, running
   Claude Code processes hold open file handles inside their own
   worktrees, so `git worktree remove --force` succeeds in
   de-registering the worktree from git but fails to delete the
   on-disk directory with `Permission denied`. The same lock blocks
   `rm -rf` on the leftover dir. **Fix: reboot the computer** (or at
   minimum kill every Claude Code process holding the worktree open),
   then re-run cleanup — the locks release on logoff/restart and the
   dirs delete cleanly. Also, the cleanup script only matches
   `agent-*` worktrees; `claude/*` worktrees (created by other Claude
   sessions, named like `competent-swartz-c37526`) need manual
   `git worktree remove` per worktree, plus `git branch -D claude/<name>`
   per branch. Check with `git worktree list` and `git branch | grep claude`
   to enumerate.

Why the discipline:
- **Agents never bump APP_VERSION/CACHE.** Two agents bumping in
  parallel branches conflict on every merge. Orchestrator bumps once
  on merge.
- **Agents never touch `cowork/inbox.md`.** The inbox is gitignored, so
  its changes don't propagate via merge anyway. Orchestrator owns claim
  and ready-for-retest writes; agents own code only.
- **Domain-split prompts.** Tell agent A "you're in JS renderers" and
  agent B "you're in CSS." The further apart their territories, the
  fewer merge conflicts.

Skip this pattern for sub-5-min fixes — dispatch + merge overhead
exceeds the work. Skip it for serial single-agent runs — the win only
shows up when the orchestrator is committing in parallel on disjoint
surfaces.
