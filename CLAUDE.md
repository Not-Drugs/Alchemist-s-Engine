# Alchemist's Engine

An incremental/idle merge game with an ASCII terminal aesthetic.

**Primary target: mobile** (touch-first, installable as a PWA). The page also
runs in desktop browsers, but design decisions favor the mobile experience
— no keyboard shortcuts, touch-sized controls, portrait layout, drag-and-drop
that mirrors HTML5 drag for mouse users. When something has to choose, choose
the touch interaction.

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

- The `[~] Heat 470/1000` readout in the resource bar shows the target
  during Phase 1. Once `peakHeat >= PHASE_1_HEAT_TARGET` the `/1000`
  drops away and Heat is just an unbounded counter.
- Narration beats fire as `peakHeat` crosses 25, 50, 75, and 100% of
  the target (`sootBeat1`/`2`/`3` at 250/500/750 and the `mergeGrid`
  reveal at 1000). The 100% reveal triggers a `screenFlash` and
  `screenShake('big')` to mark the moment.

The engine ASCII visual progression (sooted → ornate restored form)
is currently TBD — first attempt was reverted. The engine renders the
existing temperature-driven animations regardless of phase.

`peakHeat` is monotonic — heat dips don't roll progress back. Existing
saves past Phase 1 are auto-migrated (`peakHeat = target`) on load.

- **Gather Stick** — 3-second progress-bar action that yields
  `bonuses.sticksPerGather` sticks (default 1). Always visible.
- **Feed Stick** — consumes 1 stick, adds `STICK_FUEL_VALUE` (3) fuel to the
  furnace. Shift-click (desktop) feeds every stored stick at once.
- Sticks are a counted resource (`game.resources.sticks`), not a grid item.

The Engine column lays out as: stick controls (top) → engine ASCII visual
with the temperature badge (top-right of the visual) and the fuel meter
baked in beneath the art → fuel drop zone → Burn All button. This
keeps the drop zone close to the merge grid in the right column so
fuel drags are short.

**Stick upgrades** (Furnace tab, costType `'sticks'`, top of list — appear
once the Upgrades panel reveals at `kindlingAdded >= 3`):

- **Stick Basket** (5 sticks) — `sticksPerGather = 4`, `stickGatherMs = 5000`.
  Trip is slower (3s → 5s) but yields 4 sticks instead of 1, so the rate
  goes from 0.33/s → 0.8/s (2.4× base) and the player taps half as often.
  Flavor text: "It takes sticks to make sticks." (the basket is woven
  from the resource it produces — explains the cost).

The Whittling Knife and Stick Cache upgrades were removed in v50.
Orphaned IDs in older saves are pruned silently by the upgrade
re-apply loop on load (no refund — game isn't live yet).

The merge grid reveal at `peakHeat >= PHASE_1_HEAT_TARGET` (1000) ends
the stick phase and seeds two Sparks on the grid as a tutorial nudge.

### Progression Tiers

1. **Alchemical Table + Furnace** (Unlocks at `peakHeat >= 1000`)
   - 6x4 drag-and-drop merge grid
   - 8 fuel tiers: Spark → Ember → Kindling → Coal → Charite → Blazite → Infernite → Solite
   - Each merge triples fuel value
   - Drop fuel into furnace to generate Heat
   - **Sparks cost 1 heat each** — the merge system runs on the heat the
     engine has produced. Auto-Sparkers (automation) bypass the heat cost.
   - **Bidirectional engine drag.** The ASCII pre `#furnace-ascii` is the
     interactive surface for both directions:
     - **Drop fuel onto it** to feed the furnace (replaces the old
       `#furnace-fuel-slot` zone). `applyFuelDropOnEngine()` handles
       capacity check + grid clear + flash + toast.
     - **Drag from it** onto a grid cell to spawn a fresh Spark (costs
       1 heat) or merge into an existing tier-1 Spark (costs 1 heat,
       counts as a real merge).
     - The drag uses a synthetic `draggedItem.fromEngine = true` flag so
       `handleDrop` and `dispatchTouchDropOnGrid` route to
       `engineDropOnCell()` and the engine drop handler explicitly
       rejects fromEngine drops (a Spark can't loop back into the
       furnace).
     - The touch surface is intentionally the ASCII region only — not
       the whole `#furnace-visual` container — so scrolling near the
       temp badge or fuel readout doesn't pick up phantom drags. Visual
       feedback (drag-over highlight, pulse) is bubbled up to
       `#furnace-visual` via CSS `:has()` so the cue is more visible
       than highlighting just the small ASCII region.
     - **Press-and-hold to start a spark drag (touch only).** The
       `handleEngineTouchStart` flow uses a 300ms hold timer — quick
       swipes through the engine area scroll the page normally, only a
       deliberate hold arms the drag. The engine border ramps to
       fire-orange via `.engine-charging` during the hold; if the
       finger moves past `ENGINE_HOLD_MOVE_TOLERANCE` (8px) before the
       timer fires, the hold is abandoned and the browser handles the
       gesture as scroll. On hold completion the device gives a short
       vibration cue (when supported) and the drag commits.
   - **Grid item drag is immediate (no hold).** `touch-action: none`
     is scoped to `.fuel-item` / `.ore-item` only. Touching a fuel
     tile commits to a drag instantly — no merge slowdown — while
     empty grid cells and drop zones keep the default `touch-action`
     so swipes over them scroll the page natively. On a partially-
     full grid the empty cells provide a scroll path; outside the
     grid (margins, other sections) is always scrollable.
   - **Convenience-button gating.** Three quick-action buttons are
     hidden by default and unlock by sacrificing a specific high-tier
     item dropped onto a slot:
     - `[+] Spark` (in merge section) — needs a **Blazite** (fuel
       tier 6).
     - `[»] Burn All Fuel` (engine column) — needs an **Infernite**
       (fuel tier 7).
     - `[»] Smelt All Ore` (smelter section) — needs a **Pure
       Crystal** (ore tier 5).
     Unlock state is recorded in `game.upgrades` (under
     `'sparkUnlock'`, `'burnAllUnlock'`, `'smeltAllUnlock'`) and
     replayed on load via `applyUnlocksFromSave()`. Manual drag from
     engine, drag fuel to engine, and drag ore to smelter remain
     available pre-unlock so the player is never blocked.

2. **Smelter** (Unlocks at 500 Heat)
   - Spawn ore for 10 Heat
   - 5 ore tiers that merge like fuel
   - Requires furnace temp ≥100° to smelt
   - Produces Metal

3. **Forge** (Unlocks at 100 Metal)
   - Convert 5 Metal → Alloy

4. **Workshop** (Unlocks at 50 Alloy)
   - Craft Gears from Alloy (3 Alloy → 1 Gear)
   - Build automation machines:
     - Auto-Sparker (10 Gears) - auto-spawns fuel
     - Auto-Miner (25 Gears) - auto-spawns ore
     - Heat Amplifier (50 Gears) - +50% heat generation each

5. **Sanctum** (Unlocks at 500 Gears + Essence Condenser upgrade)
   - Essence generates passively from furnace temperature
   - Prestige: spend 1000+ Essence to transmute Philosopher's Stones
   - Each stone gives +25% to all production permanently

### Heat Decay (idle)

Heat is no longer a permanent accumulator. When the furnace is idle
(`game.furnace.fuel === 0`), `game.resources.heat` decays exponentially:

- Base rate: `0.5% / sec` (`game.bonuses.heatDecayRate = 0.005`)
- Runs only in the foreground game loop; offline processing does NOT apply
  decay (the 8-hour cap + 50% efficiency are enough friction).
- Three furnace upgrades form the retention ladder:
  - **Thermal Mortar** (300 heat) — sets decay rate to `0.002` (60% slower)
  - **Sealed Crucible** (3000 heat, requires Mortar) — sets decay rate to `0`
  - **Ember Heart** (30000 heat, requires Crucible) — `heatPassiveGen = 0.5`
    heat/sec while idle (multiplied by wisdom)

### Key Game Constants (game.js)

- `FUEL_TIERS` - 8 tiers, values triple (1, 3, 9, 27, 81, 243, 729, 2187)
- `ORE_TIERS` - 5 tiers, same tripling pattern
- `GRID_SIZE` - 24 cells (6x4)
- `SPARK_HEAT_COST` - 1 (heat consumed per manual spark)
- `STICK_GATHER_MS` - 3000 (manual stick-gather duration)
- `STICK_FUEL_VALUE` - 3 (fuel granted per stick fed; ≈3s of burn)
- `UPGRADES` - Object with furnace/smelter/forge/workshop upgrade arrays
- `ACHIEVEMENTS` - 18 achievements with ASCII icons
- `SAVE_VERSION` - Integer version of the save-code envelope format

### ASCII Visual Style

- Fuel items: `*`, `**`, `~`, `#`, `##`, `^`, `^^`, `@`
- Ore items: `o`, `O`, `0`, `()`, `<>`
- Resource icons: `[~]` Heat, `[#]` Metal, `[%]` Alloy, `[*]` Gears, `[+]` Essence
- Buttons: `[+] Spark`, `[>] Forge Alloy`
- Animated ASCII art for furnace flames and smelter waves

### Save System

- Auto-saves every 30 seconds to localStorage under key `alchemistsEngine`
- Also saves on `visibilitychange → hidden` (mobile background / tab switch)
- No manual SAVE button — the auto-save covers tab close, app background,
  and SW upgrade reload. The export/import modal handles cross-device
  transfer.
- **Export**: opens a modal showing the save as text + a scannable QR code
- **Import**: paste a save code to restore state on another device
- Save codes use a versioned envelope `{ v, ts, game }` (base64 UTF-8 JSON)
  so future updates can migrate older codes. Legacy raw-object codes still
  decode for backward compatibility.

### Offline Progress

- On load (and on tab return), `processOfflineProgress()` runs if the player
  was away ≥60s.
- Capped at 8 hours, applied at 50% efficiency.
- Fuel burns, heat accrues, auto-sparkers/miners fill empty grid cells (capped
  by grid space), and essence generates from residual furnace temperature.

### Trial Location: The Dead Grove

A separate exploration mechanic, accessible from the **Explore** card
that sits below the Alchemical Table. The card renders a tiny world
map: a hollow box icon for the engine ("you are here", non-clickable)
linked by a horizontal line to a solid box icon for the grove
(the `#grove-enter` button). Future locations join this row as more
nodes. Tapping the grove icon opens a fullscreen modal containing
a hand-authored ASCII forest scene. The picture **is** the UI: items
embedded in the art (sticks, stones) are clickable and add to the
player's resources. Items don't respawn yet — this is a proof of
concept for the picture-as-UI approach.

**Scene composition.** 40 columns wide, sized for mobile portrait via
a `clamp()` font-size. Each scene row is a flexbox of three side-by-
side spans:

```
[ left near-tree (10c) | center depth band (20c) | right near-tree (10c) ]
```

The left and right spans render two huge framing trees (`LEFT_NEAR_TREE`
and `RIGHT_NEAR_TREE` in `game.js`) that run the full vertical of the
scene — gnarled bark `||` trunks with knot holes (`o`, `O`), branch
stubs (`-`, `,`), broken branches at the crown, and root flare at the
base. Inspired by the ejm winter and nabis gnarled-tree references on
ascii.co.uk, paraphrased not copied (per the Clean Room Protocol).

The center span rotates through depth bands as you read top to bottom:

| Scene rows | Center content                  | CSS class       |
|-----------:|----------------------------------|-----------------|
| 0          | horizon stipple `. , . , .`      | `.grove-horizon`|
| 1–2        | distant treeline (2 micro rows)  | `.grove-far`    |
| 3          | fog stipple (haze separator)     | `.grove-far`    |
| 4–6        | far mid-band (5 tiny trees A/B/C)| `.grove-midfar` |
| 7          | fog stipple                      | `.grove-midfar` |
| 8–11       | mid mid-band (4 small trees)     | `.grove-mid`    |
| 12         | fog stipple                      | `.grove-mid`    |
| 13–18      | near mid-band (3 detailed trees) | `.grove-midnear`|
| 19–34      | empty sky (only trunks visible)  | `.grove-sky`    |

Each band has THREE variants (A/B/C) cycling so adjacent trees don't
read as repeated stamps. Fog rows between bands sell atmospheric
depth — the eye reads horizontal haze between tree-mass bands as
distance.

Atmospheric perspective comes from per-cell CSS opacity + color
tinting only — `font-size` is intentionally NOT varied per cell
because differing cell sizes inside a flex row collapse the row's
total width and pull the framing trees inward, making trunks
zig-zag (caught and fixed in the v45 polish pass). The framing
trees stay full-bright at every height, anchoring the player's eye.

Modal lifecycle locks body scroll on open via `lockBodyScroll()` /
`unlockBodyScroll()` (saves and restores `window.scrollY`) so the
page underneath can't bleed-scroll on touch.

Below the scene, a ground row and three item rows sit at the bottom.
`$` placeholders in item rows are replaced at render with clickable
spans (`renderGrove()` in `game.js`). Item layout is versioned via
`game.locations.grove.layoutV` — bumping `GROVE_LAYOUT_V` in the save
migration resets `collected` for old saves whose indices no longer
point at the same items.

**Building blocks** (`game.js`):
- `LEFT_NEAR_TREE` / `RIGHT_NEAR_TREE` — 35-row framing trees
- `MID_FAR_*`, `MID_MID_*`, `MID_NEAR_*` — slot-width primitives for
  the three mid-bands; `buildBand()` concatenates them into rows
- `GROVE_SCENE_ROWS` — pre-computed array of `{left, center, right,
  centerCls}` consumed by `renderGrove()`
- `GROVE_ITEM_ROWS` + `GROVE_ITEMS` — placeholder rows + the
  positional item table

## Mobile & PWA

- Viewport locked (no pinch-zoom) with `viewport-fit=cover` for notched devices.
- Touch drag mirrors the HTML5 drag API: `touchstart` on a grid item begins a
  ghost-element drag that drops onto grid cells or furnace/smelter zones with
  the same merge logic as mouse drag. A 6px move threshold preserves double-
  tap and long-press as quick-send shortcuts.
- Responsive breakpoints at 900px, 600px, 380px, and landscape ≤500px tall
  adapt layout without removing desktop behavior. The 6x4 merge grid is
  preserved on phones by shrinking cells.
- `@media (hover: hover)` scoping and `(hover: none) and (pointer: coarse)`
  rules ensure hover states don't stick on touch and buttons meet the 44x44
  HIG minimum.
- `touch-action`, `overscroll-behavior`, `user-select`, and JS blockers
  prevent pull-to-refresh, iOS bounce, double-tap zoom, and long-press
  callouts on game surfaces (textareas/narration remain selectable).
- Portrait-preferred: a CSS rotate-hint covers small landscape viewports;
  `screen.orientation.lock('portrait')` is attempted in fullscreen/PWA.
- `safe-area-inset-*` padding keeps content clear of notches, rounded
  corners, and the home indicator.
- Game loop pauses on `visibilitychange → hidden` to save battery;
  resuming calls `processOfflineProgress()` to fast-forward.

## Development Notes

- Game loop runs at 10 ticks/second (100ms interval) via `setInterval`.
  Intervals are tracked in `_loopIntervals` so they can be stopped when the
  page is hidden.
- All UI updates happen in `updateUI()`.
- Drag-and-drop supports **both** HTML5 mouse drag (desktop) and a parallel
  touch-drag implementation (mobile). Both paths share `draggedItem` /
  `draggedIndex` / `draggedElement` state and reuse the same merge logic.
- QR encoder is a self-contained inline library (`qrcode.js`) exposing
  `window.QR.generate(text)` and `window.QR.toSvg(qr, cellSize, margin)`.
  No third-party runtime dependency.
- Service worker (`service-worker.js`) caches the shell
  (`index.html`, `style.css`, `game.js`, `qrcode.js`, `manifest.webmanifest`,
  `icon.svg`) with a stale-while-revalidate strategy. Bump the `CACHE`
  constant when the shell changes.
- Prestige resets everything except: Philosopher's Stones, prestige count,
  achievements, and cumulative stats.

## Future Ideas

- More automation buildings
- Research tree
- Multiple furnaces
- More prestige layers
- Richer SFX library (currently 9 synthesized sounds)
- Cloud save sync (currently portable save codes only)
- **Click-automation upgrades** — gate hold-to-fire / auto-click on
  spark, feed-stick, ore, and craft buttons behind upgrades (e.g. a
  workshop "Tireless Hands" line). Manual clicking stays the default
  early-game work; automation is something the player earns.
- **Revisit heat ↔ temperature coupling.** Current model treats them
  as parallel, independent outputs of the burning furnace: heat rate
  is flat (10/s × bonuses) and temperature is a separate state
  driven by fuel volume (target = `fuel × 5`, cap 1000). Scientifically
  defensible — temperature is intensive, heat is extensive — but
  there's room to make them feel more connected. Options to weigh
  later: temperature multiplier on heat rate (hotter → more heat/s),
  temperature decay during burn if fuel is too little to sustain it,
  or specific-heat-style ramp where the first seconds of a fresh
  burn deliver less heat until the furnace warms. Don't change
  without re-tuning the early economy; the current numbers are
  balanced around the flat-rate assumption.
- **Runic unlock slots.** Re-skin the convenience-button unlock slots
  (currently a plain dashed-border box reading "Drop a Blazite to
  forge [+] Spark") into something more thematic — engraved runic
  altars where the required symbol is etched faintly into the slot
  and lights up when the player places a matching item on it. Could
  use box-drawing characters for the frame, the FUEL_TIERS / ORE_TIERS
  ::before glyph as the placeholder rune, and a small flash + sigil
  burn-in animation when consumed. Mechanics are settled (one item,
  one unlock); this is purely a visual upgrade on top of the existing
  UNLOCK_SLOTS pipeline.
- **Environment / terraforming + buildings.** Reframe the game's
  setting: the player has woken in a magically blighted landscape
  and the engine's heat/output is what they use to slowly heal it.
  Each tier or milestone could unlock a piece of terrain that's
  currently dead — soil that becomes grass, a frozen river that
  thaws, a stand of charred trees that regrows — and let the player
  place buildings on the reclaimed land (shelter, well, kiln,
  greenhouse, etc.) that produce passive bonuses or new resources.
  This becomes the spatial/visible meta-layer on top of the existing
  engine/merge/prestige loop, giving heat a destination beyond pure
  numbers. Open questions when revisiting: tile-based map vs. a
  scrolling diorama of ASCII vignettes, whether buildings cost heat/
  alloy/essence/something new, and whether terraforming progress
  persists through prestige (probably yes — it's the meta layer).

## Clean Room Protocol — Reference Material

When taking inspiration from other open-source incremental games (Candy Box
2, A Dark Room, etc.) we observe a strict separation: **read for patterns,
implement in our own voice. Never copy code verbatim.**

- Upstream source is downloaded into `_research/<source-name>/repo/` (e.g.
  `_research/candybox2/repo/`, `_research/a-dark-room/repo/`).
- The entire `_research/` directory is gitignored, so cloned repos stay
  on the developer's machine and never enter our git history or shipped
  build.
- Use shallow clones (`git clone --depth 1 …`) — we only need the latest
  state to read.
- Analysis we write *ourselves* (notes, lessons, pattern summaries) lives
  in `docs/inspiration-notes.md` and is freely committable. That file is
  our own words, not copied prose.
- Both Candy Box 2 (GPLv3) and A Dark Room (MPL 2.0) are reciprocal
  licenses. Direct code copy would force our project to inherit those
  obligations. Reading and reimplementing is fine; copying is not.
- When adding a new source: `mkdir -p _research/<name>/`, clone into
  `repo/` underneath, and update `docs/inspiration-notes.md` with the
  patterns we plan to lift.

This rule applies even when "just borrowing a small function" looks
tempting. Always paraphrase by re-deriving the logic in our own style.

## Workflow Rules

These are standing instructions from the repo owner:

- **Always update `CLAUDE.md` before committing** when the change affects
  mechanics, structure, or workflow. Keep this file a faithful mirror of
  the live game.
- **Atomic commits.** One logical change per commit. Prefer several small
  commits to one large one.
- **Work on `main` by default.** Only use a separate branch if explicitly
  told to.
- **Always push after a commit** so the GitHub Pages deploy stays current.
- Bump `CACHE` in `service-worker.js` whenever any shell file changes so
  PWA installs pick up the update on next load.
