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

### Stick Phase (opening — kindlingAdded < 20)

The game opens as a manual labor loop. The merge grid, sparks, and the rest
of the engine are hidden until the player has fed enough sticks (`kindlingAdded
>= 20`).

- **Gather Stick** — 3-second progress-bar action that yields
  `bonuses.sticksPerGather` sticks (default 1). Always visible.
- **Feed Stick** — consumes 1 stick, adds `STICK_FUEL_VALUE` (3) fuel to the
  furnace. Shift-click (desktop) feeds every stored stick at once.
- Sticks are a counted resource (`game.resources.sticks`), not a grid item.

**Stick upgrades** (Furnace tab, costType `'sticks'`, top of list — appear
once the Upgrades panel reveals at `kindlingAdded >= 3`):

- **Stick Bundle** (10 sticks) — `sticksPerGather = 2`
- **Whittling Knife** (40 sticks, requires Bundle) — `stickGatherSpeed = 1.25`
  (gather time becomes `STICK_GATHER_MS / stickGatherSpeed` ≈ 2.4s)
- **Stick Cache** (200 sticks, requires Bundle) — `sticksPerGather = 3`

The merge grid reveal at `kindlingAdded >= 20` ends the stick phase and
seeds two Sparks on the grid as a tutorial nudge.

### Progression Tiers

1. **Alchemical Table + Furnace** (Unlocks at `kindlingAdded >= 20`)
   - 6x4 drag-and-drop merge grid
   - 8 fuel tiers: Spark → Ember → Kindling → Coal → Charite → Blazite → Infernite → Solite
   - Each merge triples fuel value
   - Drop fuel into furnace to generate Heat
   - **Sparks cost 1 heat each** — the merge system runs on the heat the
     engine has produced. Auto-Sparkers (automation) bypass the heat cost.

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
- Buttons: `[SAVE]`, `[+] Spark`, `[>] Forge Alloy`
- Animated ASCII art for furnace flames and smelter waves

### Save System

- Auto-saves every 30 seconds to localStorage under key `alchemistsEngine`
- Also saves on `visibilitychange → hidden` (mobile background / tab switch)
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
