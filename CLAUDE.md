# Alchemist's Engine

An incremental/idle merge game with an ASCII terminal aesthetic.

**Primary target: mobile** (touch-first, installable as a PWA). Desktop
runs too, but design decisions favor touch — no keyboard shortcuts,
touch-sized controls, portrait layout, drag-and-drop that mirrors HTML5
drag for mouse users. When something has to choose, choose touch.

**Primary playtest device: Chrome on Google Pixel.** Address bar
shrinks/grows the visible viewport, so use `100dvh` (not `100vh`) for
full-bleed layouts. Cowork runs DOM-measurement verification in browser
emulation, but Nicholas's playtest is the canonical visual check.

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
├── docs/                   # Detailed reference (see "Detailed Docs" below)
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
- **Mobile / PWA**: Serve over http(s) and "Add to Home Screen". The
  service worker registers on http(s) only and is skipped for `file://`.

## Game Mechanics — Top Level

The game opens as a **Stick Phase** (manual labor: gather sticks, feed
furnace) until `peakHeat >= PHASE_1_HEAT_TARGET` (1000), at which point
the merge grid reveals.

**Progression tiers** (full detail in `docs/mechanics.md`):

1. **Alchemical Table + Furnace** — 6×4 merge grid; 8 fuel tiers (Spark
   → Solite, triple per merge); spark costs 1 heat
2. **Smelter** (500 Heat) — ore tiers, produces Metal
3. **Forge** (100 Metal) — Metal → Alloy
4. **Workshop** (50 Alloy) — Alloy → Gears + automation
5. **Sanctum** (500 Gears) — Essence + Philosopher's Stone prestige

**Heat decays when idle** (exponential + linear floor), with a three-tier
upgrade ladder (Thermal Mortar → Sealed Crucible → Ember Heart). Full
formula in `docs/mechanics.md`.

**Crafting (v1)** — Three storages: Inventory rail (sticks/stones),
Alchemy Satchel (8 slots, fuel/ore stash), Key Items Bag. Pattern matcher
runs anywhere on the grid. Recipes shipped: **Stick Golem**, **Wooden
Axe**, **Pickaxe**. Functional Stick Golems are workstation-assigned via
`game.golems.assignments`. Full detail + land-mines in `docs/crafting.md`.

**Trial Locations** — Accessible via the Explore card (world map). Modal
scenes where the picture *is* the UI: tap embedded items to harvest.
Locations: **Dead Grove** (sticks/stones, gated at 50 sticks gathered)
and **Abandoned Quarry** (stones + iron ore, gated by logs gathered;
ore mining requires a Pickaxe). Full detail (scene composition, walker
cosmetic, walker lab, respawn) in `docs/locations.md`.

**Save**: auto-saves every 30s + on `visibilitychange → hidden`. Export/
import via text + scannable QR. **Offline progress**: capped at 8h, 50%
efficiency. Details in `docs/mechanics.md`.

## Mobile & PWA

- Viewport locked (no pinch-zoom), `viewport-fit=cover` for notched devices
- Touch drag mirrors the HTML5 drag API: `touchstart` on a grid item
  begins a ghost-element drag with the same merge logic. 6px threshold
  preserves double-tap and long-press as quick-send shortcuts
- Responsive breakpoints at 900px, 600px, 380px, and landscape ≤500px tall.
  6×4 merge grid is preserved on phones by shrinking cells
- `@media (hover: hover)` / `(hover: none) and (pointer: coarse)` keep
  hover from sticking on touch; buttons meet the 44×44 HIG minimum
- `touch-action`, `overscroll-behavior`, `user-select`, JS blockers
  prevent pull-to-refresh, iOS bounce, double-tap zoom, and long-press
  callouts on game surfaces (textareas/narration remain selectable)
- Portrait-preferred: CSS rotate-hint for small landscape;
  `screen.orientation.lock('portrait')` attempted in fullscreen/PWA
- `safe-area-inset-*` padding clears notches and home indicator
- **Use `100dvh` / `100dvw` on full-bleed elements**, not `100vh` /
  `100vw`. Static `vh` overshoots when Chrome's address bar is showing
- Game loop pauses on `visibilitychange → hidden`; resuming calls
  `processOfflineProgress()` to fast-forward
- `#furnace-ascii` has `touch-action: none` so the 300ms hold→spark-drag
  flow stays reliable (trade-off: can't scroll by starting on the engine)
- `hapticTap(ms)` is the centralized vibration helper — defensively
  wraps `navigator.vibrate` (no-op on iOS Safari)

## Development Notes

- Game loop: 10 ticks/sec (100ms `setInterval`). Intervals tracked in
  `_loopIntervals` so they can stop on tab hide
- All UI updates happen in `updateUI()`
- Drag-and-drop supports HTML5 mouse drag (desktop) and a parallel touch
  implementation (mobile). Both share `draggedItem` / `draggedIndex` /
  `draggedElement` and reuse the same merge logic
- QR encoder is self-contained (`qrcode.js`) exposing `window.QR.generate`
  and `window.QR.toSvg`
- Service worker caches the shell with stale-while-revalidate. Bump
  `CACHE` AND `APP_VERSION` together when the shell changes
- A `[↻]` refresh button next to the version tag self-serves out of any
  stuck-SW state (`forceRefresh()`)
- Prestige resets everything except: Philosopher's Stones, prestige
  count, achievements, cumulative stats

## Cowork Playtest Channel

A file-based ticketing channel for browser-automated playtesting lives
under `cowork/`. **cowork-Claude** plays the game in a browser session,
files tickets, and visually verifies fixes. **terminal-Claude** (this
session) claims tickets, fixes them in code, pushes, marks
`[ready-for-retest]`.

**Quick start.** If the user says **"/cowork"**, **"enter cowork mode"**,
**"cowork mode"**, **"enter ticket mode"**, or **"ticket mode"**, read
`cowork/PROTOCOL.md` and `cowork/README.md`, identify which side this
session is (ask if unsure), and start the appropriate `/loop`.

Status lifecycle: `[new]` → `[claimed]` → `[ready-for-retest]` →
`[verified]`, with `[needs-info]` and `[reopened]` as branches.
`[needs-human]` is the escape hatch — both loops skip it until the user
flips it back. The terminal loop only acts on `[new]` and `[reopened]`;
the cowork loop only on `[ready-for-retest]` and `[needs-info]` for its
own tickets.

When fixing a ticket: include the commit SHA in the
`[ready-for-retest]` comment so cowork knows what build to verify
against (Pages takes ~30–60s to rebuild after push). Cowork checks
`cowork/inbox.md` at the start of every turn, not just on `/loop` ticks.

Files: `PROTOCOL.md`, `README.md`, `agent-template.md` (rules for
dispatched agents), `BACKLOG.md` (deferred design ideas),
`PRE_PROD_CHECKLIST.md` (pre-launch hardening), `FEEDBACK.md` (design
observations), `TEST_LOG.md` (coverage map), `inbox.md` and `archive.md`
(gitignored runtime state), `attachments/` (gitignored).

## Workflow Rules

Standing instructions from the repo owner:

- **Always update `CLAUDE.md` before committing** when the change affects
  mechanics, structure, or workflow. Keep it a faithful mirror of the
  live game.
- **Atomic commits.** One logical change per commit.
- **Work on `main` by default.** Use a separate branch only if explicitly
  told to (or for worktree-isolated agent dispatch).
- **Always push after a commit** so GitHub Pages stays current.
- **Bump `CACHE` (`service-worker.js`) AND `APP_VERSION` (`game.js`)
  together** whenever any shell file changes. They MUST stay in
  lock-step (a pre-commit hook in `.claude/settings.json` enforces this).

For the orchestrator + worktree-isolated-agent pattern (parallel
dispatch for ≥15min tickets), the pre-commit hook details, the Windows
file-lock gotcha during cleanup, and the Clean Room Protocol for
external inspiration sources, see `docs/workflow.md`.

## Detailed Docs

- `docs/mechanics.md` — stick phase, progression tiers, heat decay,
  game constants, ASCII style, save & offline progress
- `docs/crafting.md` — recipes, golem assignments, save state, v60–v70
  land-mines (must-read before touching satchel/inventory/drag code)
- `docs/locations.md` — Grove + Quarry scene composition, walker
  cosmetic, walker lab, respawn
- `docs/workflow.md` — orchestrator/worktree pattern, pre-commit hook,
  Clean Room Protocol
- `docs/inspiration-notes.md` — patterns lifted from upstream incrementals
- `cowork/BACKLOG.md` — deferred design ideas
