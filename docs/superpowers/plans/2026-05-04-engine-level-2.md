# Engine Level 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the engine render to the kinds + instances pattern (matching quarry v4 / grove v2), then ship a 4-upgrade incremental suite + capstone that visually transforms the engine for Level 2, with five layered CSS animations.

**Architecture:** New `ENGINE_KINDS` registry holds reusable visual definitions (frame, face, mouth variants, smokestack, vents, etched foundation, viewport, ember cluster). `renderEngine()` reads `game.engineUpgrades` (per-flag boolean record) and composes the active instance list. Cells are positionally rendered with `data-kind` / `data-instance` attributes for animation hooks and future graphics-tier swap. Animations are CSS-keyframe driven, scoped by `[data-kind=...]` selectors. The Level 2 suite plumbs 5 new `UPGRADES` entries (4 incrementals + gated capstone) that mutate `engineUpgrades` flags on apply.

**Tech Stack:** Vanilla JS (game.js), CSS (style.css), service-worker cache lockstep. No build step, no test framework — verification is via temp node scripts (mirrors `_check_v4.js` / `_check_grove_v2.js` patterns) plus manual playtest on Pixel.

---

## File Map

**Modified:**
- `game.js` — add `ENGINE_KINDS`, `buildEngineInstances`, `renderEngine`; modify `defaultGame` + `loadGame` migration; add 5 entries to `UPGRADES` array; replace `renderBareEngineAscii()` call site at ~line 5749. APP_VERSION bump per task.
- `style.css` — add `.engine-row-frame` / `.engine-cell-positional` CSS, brass-gold accents per kind, 5 keyframe animation rules.
- `service-worker.js` — bump `CACHE` in lockstep with APP_VERSION every commit (pre-commit hook enforces).
- `CLAUDE.md` — Visual Architecture section gains Engine kinds reference (final task).
- `docs/mechanics.md` — Progression Tiers section gains Level 2 mention (final task).

**Temp:**
- `_check_engine.js` — node verifier composing merged char grid for L1 / each-incremental-on / capstone states. Created task 4, evolved later, deleted before final commit. Uses regex matchAll (no eval).

---

## Task 1: Add `engineUpgrades` save schema

**Files:**
- Modify: `game.js` — find `defaultGame` declaration; find `loadGame` migration block.

- [ ] **Step 1: Find current `defaultGame` schema**

Run: `grep -n "defaultGame\s*=\s*{" game.js | head -3`
Note the line number for the next edit.

- [ ] **Step 2: Add `engineUpgrades` to defaultGame**

Add this field inside the `defaultGame` object (alongside other top-level state fields):

```js
engineUpgrades: {
    smokestack: false,
    vents: false,
    toothedMaw: false,
    etchedFoundation: false,
    capstone: false
},
```

- [ ] **Step 3: Add migration in `loadGame`**

Find `loadGame` and add after the existing migrations (look for similar `if (!game.X) game.X = ...` patterns):

```js
if (!game.engineUpgrades) {
    game.engineUpgrades = {
        smokestack: false,
        vents: false,
        toothedMaw: false,
        etchedFoundation: false,
        capstone: false
    };
}
```

- [ ] **Step 4: Bump version + commit**

```bash
# Update APP_VERSION in game.js (current → +1) and CACHE in service-worker.js to match.
git add game.js service-worker.js
git commit -m "feat(engine): add engineUpgrades save schema (no behaviour change)"
git push
```

Verify (browser): load existing save, open devtools console, check `game.engineUpgrades` exists and all flags are false. New saves: same.

---

## Task 2: Add `ENGINE_KINDS` registry — base L1 kinds only

**Files:**
- Modify: `game.js` — add new module-level constant near `ITEM_KINDS` / `KEY_ITEM_KINDS`.

- [ ] **Step 1: Add `ENGINE_KINDS` registry with L1-only kinds**

Place after `KEY_ITEM_KINDS` (around line ~85). This first pass only defines the kinds needed to recreate the current L1 engine — no upgrade kinds yet.

```js
// Engine visual kinds. Each kind has width × height + per-row content.
// L1 reproduces the current engine silhouette via three kinds:
// engine-frame-base (the surrounding silhouette), engine-face (the
// face row content placeholder — actual content rewritten per tick
// based on burn state), engine-mouth-slot (the L1 default mouth).
// Additional kinds (smokestack, vents, toothed maw, etched foundation,
// viewport, ember cluster) get added in later tasks alongside their
// gating upgrade.
const ENGINE_KINDS = {
    // The static silhouette. Face/mouth content is rendered separately
    // so this kind is just dome + body sides + body bottom + foundation.
    'engine-frame-base': {
        width: 13, height: 8,
        rows: [
            { content: '    _______  ' },
            { content: '   /       \\ ' },
            { content: '  |         |' },
            { content: '  |         |' },
            { content: '  |         |' },
            { content: '  |_________|' },
            { content: ' /___________\\' },
            { content: '|_____________|' }
        ]
    },
    // 5 chars wide × 1 row. Sits at row 2, col 4 of the frame-base.
    // Default content `.   .` (cold). Renderer overwrites per tick.
    'engine-face': {
        width: 5, height: 1,
        rows: [{ content: '.   .' }]
    },
    // L1 default mouth: 5 chars × 2 rows. Sits at rows 3-4, col 4.
    // Replaced by `engine-mouth-toothed` when that upgrade is purchased.
    'engine-mouth-slot': {
        width: 5, height: 2,
        rows: [
            { content: '  _  ' },
            { content: '\'---\'' }
        ]
    }
};
```

- [ ] **Step 2: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): seed ENGINE_KINDS registry with L1 base kinds"
git push
```

Verify: no visual change in the game (registry is data-only, not consumed yet).

---

## Task 3: Add `buildEngineInstances(state)` for L1

**Files:**
- Modify: `game.js` — add helper function after `ENGINE_KINDS`.

- [ ] **Step 1: Add `buildEngineInstances`**

This function reads game state (specifically `state.engineUpgrades`) and returns the ordered instance list to render. For now it only returns L1 composition since no upgrade kinds exist yet.

```js
// Compose the engine instance list from current state. Order is
// z-stacking — later instances paint over earlier at conflicting
// positions (mirrors quarry v4 / grove v2 eviction-map pattern).
//
// For L1 (no upgrades purchased): frame-base + face + mouth-slot.
// Upgrade-conditional instances get appended in later tasks.
function buildEngineInstances(state) {
    const u = (state && state.engineUpgrades) || {};
    const instances = [
        { name: 'frame', kind: 'engine-frame-base', row: 0, col: 0 },
        { name: 'mouth', kind: 'engine-mouth-slot', row: 3, col: 4 },
        { name: 'face',  kind: 'engine-face',       row: 2, col: 4 }
    ];
    // Future tasks: append smokestack / vents / etched-foundation / capstone instances
    // here based on `u.smokestack` etc. The `u` reference is reserved now.
    void u;
    return instances;
}
```

- [ ] **Step 2: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): add buildEngineInstances(state) — L1 composition only"
git push
```

Verify: no visual change (function is defined but not called yet).

---

## Task 4: Add `renderEngine` and verifier; switch L1 path over

**Files:**
- Modify: `game.js` — add `renderEngine`, replace `renderBareEngineAscii` call site at the cold/residual branch (~line 5813), keep burn-state branches calling renderEngine too.
- Modify: `style.css` — add `.engine-row-frame` / `.engine-cell-positional` rules (mirrors quarry equivalents).
- Create: `_check_engine.js` (temp verifier).

- [ ] **Step 1: Add `renderEngine` function**

Place near other render functions in game.js (e.g., before the existing `renderBareEngineAscii`).

```js
// Render the engine into `target` using the kinds + instances pattern.
// Mirrors renderQuarry's v4 path. Cells get positioned via `left: <col>ch`
// inside a per-row frame; `data-kind` + `data-instance` attached for
// CSS animation hooks and future graphics-tier swap.
//
// Burn-state animation: after composing static cells, the face cells
// get their content rewritten based on burn temperature. This preserves
// the 10Hz tick-driven flame animation that the legacy renderer did.
function renderEngine(target, state) {
    if (!target) return;
    // Don't mutate children mid-drag — Chrome cancels HTML5 drag the
    // instant the source's children change. Lifted from the legacy
    // renderer's logic (see CLAUDE.md crafting land-mines).
    if (target.classList.contains('engine-dragging')) return;

    target.textContent = '';
    const instances = buildEngineInstances(state);
    const MIN_ROW = -4;  // smokestack puff (added later) sits at row -4
    const MAX_ROW = 13;  // generous upper bound for all states
    const COLS = 17;     // biggest state is ~17 chars wide (with vents)
    const frames = {};
    for (let r = MIN_ROW; r < MAX_ROW; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'engine-row engine-layered-row';
        const frame = document.createElement('span');
        frame.className = 'engine-row-frame';
        frame.style.width = COLS + 'ch';
        rowDiv.appendChild(frame);
        target.appendChild(rowDiv);
        frames[r] = frame;
    }
    const occupied = Object.create(null);
    for (const inst of instances) {
        const kind = ENGINE_KINDS[inst.kind];
        if (!kind) continue;
        const baseRow = inst.row || 0;
        const baseCol = inst.col || 0;
        for (let kRow = 0; kRow < kind.rows.length; kRow++) {
            const kindRow = kind.rows[kRow];
            const sceneRow = baseRow + kRow;
            const frame = frames[sceneRow];
            if (!frame) continue;
            const cls = inst.cls || kindRow.cls || null;
            const content = kindRow.content;
            for (let kCol = 0; kCol < content.length; kCol++) {
                const ch = content[kCol];
                if (ch === ' ') continue;
                const sceneCol = baseCol + kCol;
                if (sceneCol < 0 || sceneCol >= COLS) continue;
                const key = sceneRow + ',' + sceneCol;
                const prior = occupied[key];
                if (prior) prior.remove();
                const cell = document.createElement('span');
                cell.className = 'engine-cell-positional' + (cls ? ' engine-' + cls : '');
                cell.dataset.kind = inst.kind;
                if (inst.name) cell.dataset.instance = inst.name;
                cell.style.left = sceneCol + 'ch';
                cell.textContent = ch;
                frame.appendChild(cell);
                occupied[key] = cell;
            }
        }
    }
    // After static composition, populate face cells based on burn state.
    updateEngineFaceCells(target, state);
}

// Rewrite the face cells' textContent based on current burn state,
// matching legacy behavior from renderBareEngineAscii + burn branches.
function updateEngineFaceCells(target, state) {
    const burning = state.furnace && state.furnace.fuel > 0;
    const temp = (state.furnace && state.furnace.temperature) || 0;
    const hasResidualHeat = !burning && (state.resources && state.resources.heat) > 0;
    const faceCells = target.querySelectorAll('[data-kind="engine-face"]');
    if (!faceCells.length) return;
    const t = Math.floor(Date.now() / 180);
    let chars;
    if (burning && temp >= 400) {
        chars = ['*^*^*', '^*^*^', '*^^*^', '^*^^*'][t % 4];
    } else if (burning && temp >= 100) {
        chars = ['  ^  ', ' ^^^ ', '^^^^^'][t % 3];
    } else {
        chars = '.   .';
    }
    faceCells.forEach((cell, i) => {
        cell.textContent = chars[i] || ' ';
        cell.classList.toggle('ember-core', hasResidualHeat);
    });
}
```

- [ ] **Step 2: Replace the engine render call site**

Find the existing block (~line 5749-5814) that does `furnaceAscii.classList.toggle(...)` then sets `furnaceAscii.textContent` based on burn state. Replace the entire block with:

```js
if (furnaceAscii) {
    const burning = game.furnace.fuel > 0;
    const temp = game.furnace.temperature;
    const cold = !burning && temp < 1 && game.stats.totalHeat === 0;
    furnaceAscii.classList.toggle('burning', burning);
    furnaceAscii.classList.toggle('cold', cold);
    furnaceAscii.classList.toggle('roaring', temp >= 400);
    renderEngine(furnaceAscii, game);
}
```

The legacy `renderBareEngineAscii` function can be left in place for safety (we'll remove it in Task 12) but it's no longer called.

- [ ] **Step 3: Add CSS for positional engine cells**

Open `style.css`, find the quarry layered-row rules. Add equivalent engine rules below them:

```css
/* Engine layered render — positional cells inside per-row frames.
   Mirrors the quarry/grove v2 layered-cell architecture. Each cell
   carries data-kind for animation hooks. */
.engine-row.engine-layered-row {
    height: 1em;
    line-height: 1.0;
    text-align: center;
    display: block;
}
.engine-row-frame {
    display: inline-block;
    position: relative;
    height: 1em;
}
.engine-cell-positional {
    position: absolute;
    top: 0;
    line-height: 1.0;
}
```

- [ ] **Step 4: Write the verifier**

Create `_check_engine.js` at the repo root. Uses `matchAll` (no eval).

```js
const fs = require('fs');
const src = fs.readFileSync('game.js', 'utf8');

// Parse the ENGINE_KINDS block via regex matchAll (mirrors _check_v4.js).
const kindsStart = src.indexOf('const ENGINE_KINDS = {');
const kindsEnd = src.indexOf('};', kindsStart);
const block = src.slice(kindsStart, kindsEnd);
const kindRegex = /'([\w-]+)':\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),\s*rows:\s*\[([\s\S]*?)\]\s*\}/g;
const kinds = {};
for (const m of block.matchAll(kindRegex)) {
    const [, name, , , rowsBlock] = m;
    const rowRe = /content:\s*'([^']*)'/g;
    const rows = [];
    for (const rm of rowsBlock.matchAll(rowRe)) {
        rows.push({ content: rm[1].replace(/\\\\/g, '\\').replace(/\\'/g, "'") });
    }
    kinds[name] = { rows };
}
console.log('Loaded kinds:', Object.keys(kinds).join(', '));

// Hardcoded L1 instance list (mirrors buildEngineInstances for u={}).
const instances = [
    { name: 'frame', kind: 'engine-frame-base', row: 0, col: 0 },
    { name: 'mouth', kind: 'engine-mouth-slot', row: 3, col: 4 },
    { name: 'face',  kind: 'engine-face',       row: 2, col: 4 }
];

// Compose the merged grid (eviction map: later wins).
const ROWS = 13, COLS = 17;
const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(' '));
for (const inst of instances) {
    const kind = kinds[inst.kind];
    if (!kind) { console.log('UNKNOWN KIND:', inst.kind); continue; }
    for (let kRow = 0; kRow < kind.rows.length; kRow++) {
        const content = kind.rows[kRow].content;
        for (let kCol = 0; kCol < content.length; kCol++) {
            const ch = content[kCol];
            if (ch === ' ') continue;
            const r = inst.row + kRow, c = inst.col + kCol;
            if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = ch;
        }
    }
}
console.log('--- engine L1 composed grid (cold state, before face mutation) ---');
grid.forEach((row, r) => console.log(String(r).padStart(2), '|' + row.join('') + '|'));
```

Run and inspect output:

```bash
node _check_engine.js
```

Expected: shows the L1 silhouette with `.   .` face placeholder (since face content is set by `updateEngineFaceCells` at runtime, the static composition shows the placeholder `.   .`).

- [ ] **Step 5: Manual playtest**

```bash
# Open index.html in browser. Verify:
# - Engine looks identical to before this commit
# - Face still animates when burning (^^^ at temp 100+, *^*^* at 400+)
# - .   . still shows when cold
# - .ember-core glow still pulses when residual heat (no burn but heat > 0)
# - Drag fuel onto engine — drop still works
# - Long-press engine on touch / drag-and-drop on desktop — spark spawn still works
```

- [ ] **Step 6: Bump version + commit**

```bash
git add game.js style.css service-worker.js
git commit -m "refactor(engine): kinds+instances render path; L1 visual unchanged"
git push
```

Keep `_check_engine.js` — used in later tasks. Check `git status` shouldn't include it (repo root JS files outside the shell may not be ignored; if it appears in `git status`, add `_check_engine.js` to .gitignore).

---

## Task 5: Add 5 UPGRADES entries (1 stick each)

**Files:**
- Modify: `game.js` — `UPGRADES` array (find via `grep -n "^const UPGRADES" game.js`).

- [ ] **Step 1: Locate UPGRADES array**

```bash
grep -n "^const UPGRADES" game.js
```

- [ ] **Step 2: Append 5 new entries (place at end of array)**

Each entry follows the existing UPGRADES shape. The `cost` is `1` stick for testing. The `apply` function flips an `engineUpgrades` flag. `prereq` is the `peakHeat >= 1000` check (Phase 1 complete) for the 4 incrementals; the capstone has all-incrementals as prereq.

```js
{
    id: 'engineSmokestack',
    name: 'Engine Smokestack',
    desc: 'A chimney crowns the dome — the engine breathes more freely.',
    costType: 'sticks',
    cost: 1,
    tab: 'furnace',
    prereq: () => (game.peakHeat || 0) >= PHASE_1_HEAT_TARGET,
    apply: () => { game.engineUpgrades.smokestack = true; }
},
{
    id: 'engineSideVents',
    name: 'Engine Side Vents',
    desc: 'Heat exchange ports pierce the engine\'s flanks.',
    costType: 'sticks',
    cost: 1,
    tab: 'furnace',
    prereq: () => (game.peakHeat || 0) >= PHASE_1_HEAT_TARGET,
    apply: () => { game.engineUpgrades.vents = true; }
},
{
    id: 'engineToothedMaw',
    name: 'Toothed Maw',
    desc: 'The fuel intake gains iron teeth — fuel feeds more cleanly.',
    costType: 'sticks',
    cost: 1,
    tab: 'furnace',
    prereq: () => (game.peakHeat || 0) >= PHASE_1_HEAT_TARGET,
    apply: () => { game.engineUpgrades.toothedMaw = true; }
},
{
    id: 'engineEtchedFoundation',
    name: 'Etched Foundation',
    desc: 'Runic etchings ring the engine\'s base. Whatever they are, they pulse.',
    costType: 'sticks',
    cost: 1,
    tab: 'furnace',
    prereq: () => (game.peakHeat || 0) >= PHASE_1_HEAT_TARGET,
    apply: () => { game.engineUpgrades.etchedFoundation = true; }
},
{
    id: 'engineCapstone',
    name: 'Engine Tier 2 — Capstone',
    desc: 'All four upgrades sing in unison. The engine wakes fully.',
    costType: 'sticks',
    cost: 1,
    tab: 'furnace',
    prereq: () => game.engineUpgrades && game.engineUpgrades.smokestack
                  && game.engineUpgrades.vents
                  && game.engineUpgrades.toothedMaw
                  && game.engineUpgrades.etchedFoundation,
    apply: () => {
        game.engineUpgrades.capstone = true;
        if (typeof screenFlash === 'function') screenFlash();
        if (typeof screenShake === 'function') screenShake('big');
        if (typeof setNarration === 'function') setNarration('The engine wakes. The work is no longer manual.');
    }
}
```

If the existing `UPGRADES` entries use a different shape (different field names, applyOnce vs apply, etc.), match the existing pattern. Search for an existing entry like `efficiency1` or similar and mirror its keys.

- [ ] **Step 3: Manual playtest**

Reach Phase 1 (gather sticks, feed engine, hit 1000 heat). Open the Furnace tab in upgrades panel. Verify:
- Four new upgrades visible (Smokestack, Side Vents, Toothed Maw, Etched Foundation)
- Capstone NOT visible (prereqs not met)
- Each costs 1 stick
- Buying one: stick deducted, flag set in `game.engineUpgrades.<key>` (verify in devtools console)
- After all 4 bought: Capstone appears
- Buying Capstone: flash + shake fire, narration appears, `game.engineUpgrades.capstone === true`

- [ ] **Step 4: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): 5 upgrade entries (1 stick each, no visual effect yet)"
git push
```

---

## Task 6: Smokestack visual

**Files:**
- Modify: `game.js` — add `engine-smokestack` + `engine-smokestack-puff` kinds; append conditional instances in `buildEngineInstances`.

- [ ] **Step 1: Add kinds to ENGINE_KINDS**

```js
'engine-smokestack': {
    width: 5, height: 3,
    rows: [
        { content: ' ||| ' },
        { content: ' ||| ' },
        { content: '_|||_' }
    ]
},
'engine-smokestack-puff': {
    width: 1, height: 1,
    rows: [{ content: '~' }]
}
```

- [ ] **Step 2: Add conditional append to `buildEngineInstances`**

Before the `void u;` line (or replacing it):

```js
if (u.smokestack) {
    instances.push({ name: 'smokestack', kind: 'engine-smokestack', row: -3, col: 4 });
    instances.push({ name: 'smokestack-puff', kind: 'engine-smokestack-puff', row: -4, col: 6 });
}
```

The negative row indices place the smokestack ABOVE row 0 of the engine. `renderEngine` already creates frames from MIN_ROW=-4 (added in Task 4), so this works.

- [ ] **Step 3: Manual playtest**

Buy the Smokestack upgrade. Engine should grow a 3-row chimney above the dome. Old engine should still render correctly when smokestack flag is false.

- [ ] **Step 4: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): smokestack upgrade visual"
git push
```

---

## Task 7: Side vents visual

**Files:**
- Modify: `game.js` — add 2 vent kinds; append conditional instances.

- [ ] **Step 1: Add kinds**

```js
'engine-side-vent-left': {
    width: 2, height: 3,
    rows: [
        { content: '=[' },
        { content: '=[' },
        { content: '=[' }
    ]
},
'engine-side-vent-right': {
    width: 2, height: 3,
    rows: [
        { content: ']=' },
        { content: ']=' },
        { content: ']=' }
    ]
}
```

- [ ] **Step 2: Conditional append in `buildEngineInstances`**

```js
if (u.vents) {
    instances.push({ name: 'vent-left',  kind: 'engine-side-vent-left',  row: 2, col: 0 });
    instances.push({ name: 'vent-right', kind: 'engine-side-vent-right', row: 2, col: 13 });
}
```

The vents render at cols 0-1 (left) and cols 13-14 (right) for rows 2-4 (face + mouth). Frame width COLS=17 (set in Task 4) accommodates this.

- [ ] **Step 3: Manual playtest**

Buy Side Vents. `=[` and `]=` flank the face + mouth rows. Right vent stays aligned across face + mouth rows (no drift).

- [ ] **Step 4: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): side vents upgrade visual"
git push
```

---

## Task 8: Toothed maw visual

**Files:**
- Modify: `game.js` — add `engine-mouth-toothed` kind; conditional swap in `buildEngineInstances`.

- [ ] **Step 1: Add kind**

```js
'engine-mouth-toothed': {
    width: 5, height: 2,
    rows: [
        { content: '▽▽▽▽▽' },
        { content: '△△△△△' }
    ]
}
```

- [ ] **Step 2: Conditional swap**

In `buildEngineInstances`, REPLACE the unconditional `engine-mouth-slot` push with:

```js
if (u.toothedMaw) {
    instances.push({ name: 'mouth', kind: 'engine-mouth-toothed', row: 3, col: 4 });
} else {
    instances.push({ name: 'mouth', kind: 'engine-mouth-slot', row: 3, col: 4 });
}
```

- [ ] **Step 3: Manual playtest**

Buy Toothed Maw. The simple `_` / `'---'` slot is replaced by `▽▽▽▽▽` / `△△△△△`. Body alignment preserved (right `|` doesn't drift).

- [ ] **Step 4: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): toothed maw upgrade visual"
git push
```

---

## Task 9: Etched foundation visual

**Files:**
- Modify: `game.js` — add `engine-foundation-etched` kind; conditional append + per-cell rune class.

- [ ] **Step 1: Add kind**

```js
'engine-foundation-etched': {
    width: 15, height: 2,
    rows: [
        { content: ' /───────────\\ ' },
        { content: '|*===========*|' }
    ]
}
```

- [ ] **Step 2: Conditional append**

Append after the frame instance push:

```js
if (u.etchedFoundation) {
    instances.push({ name: 'foundation-etched', kind: 'engine-foundation-etched', row: 6, col: 0 });
}
```

The eviction map handles the overlay — etched cells overpaint the frame's underscore foundation cells.

- [ ] **Step 3: Tag corner runes for the heartbeat animation**

The `*` chars at the etched foundation's row 1 cols 1 and 13 need a `.engine-rune` class so CSS can target them for the heartbeat pulse. Add this just before `updateEngineFaceCells(target, state);` at the end of `renderEngine`:

```js
target.querySelectorAll('[data-kind="engine-foundation-etched"]').forEach(cell => {
    if (cell.textContent === '*') cell.classList.add('engine-rune');
});
```

- [ ] **Step 4: Manual playtest**

Buy Etched Foundation. Bottom of engine changes from `_` underscores to `─` (slope) and the base from `_____` to `*===*` with star-corners.

- [ ] **Step 5: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): etched foundation upgrade visual"
git push
```

---

## Task 10: Capstone visuals — ember cluster + viewport + widened maw

**Files:**
- Modify: `game.js` — add capstone-only kinds; conditional swaps and appends.

- [ ] **Step 1: Add capstone kinds**

```js
// Replaces engine-face when capstone purchased. 9 cells wide, 3 embers
// at cols 1, 4, 7 (positions within the kind's footprint).
'engine-ember-cluster': {
    width: 9, height: 1,
    rows: [{ content: ' ◊  ◊  ◊ ' }]
},
// Internal viewport — the rotating mechanism. Sits at row 5 col 8.
'engine-viewport': {
    width: 1, height: 1,
    rows: [{ content: '╳' }]
},
// Widened toothed maw — 7 chars wide. Used at capstone instead of
// engine-mouth-toothed.
'engine-mouth-toothed-wide': {
    width: 7, height: 2,
    rows: [
        { content: '▽▽▽▽▽▽▽' },
        { content: '△△△△△△△' }
    ]
}
```

- [ ] **Step 2: Update `buildEngineInstances` for capstone**

Replace the maw block with:

```js
let mouthKind = 'engine-mouth-slot';
let mouthCol = 4;
if (u.capstone) {
    mouthKind = 'engine-mouth-toothed-wide';
    mouthCol = 3;  // 7 wide, body interior 9 wide → start at col 3 to centre
} else if (u.toothedMaw) {
    mouthKind = 'engine-mouth-toothed';
}
instances.push({ name: 'mouth', kind: mouthKind, row: 3, col: mouthCol });
```

Replace the face block with:

```js
if (u.capstone) {
    instances.push({ name: 'ember-cluster', kind: 'engine-ember-cluster', row: 2, col: 2 });
} else {
    instances.push({ name: 'face', kind: 'engine-face', row: 2, col: 4 });
}
```

Append viewport instance:

```js
if (u.capstone) {
    instances.push({ name: 'viewport', kind: 'engine-viewport', row: 5, col: 8 });
}
```

- [ ] **Step 3: `updateEngineFaceCells` already handles ember cluster correctly**

`updateEngineFaceCells` queries `[data-kind="engine-face"]`. When capstone is active there are no engine-face cells (replaced by ember-cluster), so the function early-returns at the empty querySelectorAll result. No change needed.

- [ ] **Step 4: Manual playtest**

After capstone purchase: face changes from `.   .` to `◊  ◊  ◊` (3 embers). Maw widens from 5 to 7 teeth. New `╳` viewport appears below maw, centered. Body alignment still clean (no drift).

- [ ] **Step 5: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "feat(engine): capstone visuals — ember cluster, viewport, widened maw"
git push
```

---

## Task 11: CSS animations — 5 keyframes + brass-gold accents

**Files:**
- Modify: `style.css` — add accent colors + 5 keyframe rules.

- [ ] **Step 1: Add brass-gold accent colors**

Add near other engine CSS:

```css
/* Engine L2 brass-gold accent — applied to upgrade kinds via data-kind selector. */
.engine-cell-positional[data-kind="engine-smokestack"],
.engine-cell-positional[data-kind="engine-side-vent-left"],
.engine-cell-positional[data-kind="engine-side-vent-right"],
.engine-cell-positional[data-kind="engine-mouth-toothed"],
.engine-cell-positional[data-kind="engine-mouth-toothed-wide"],
.engine-cell-positional[data-kind="engine-foundation-etched"] {
    color: #c9a05a;
}
.engine-cell-positional[data-kind="engine-ember-cluster"] {
    color: #ff9a4a;
    text-shadow: 0 0 4px rgba(255, 154, 74, 0.6);
}
.engine-cell-positional[data-kind="engine-viewport"] {
    color: #e8c060;
    text-shadow: 0 0 6px rgba(232, 192, 96, 0.7);
}
```

- [ ] **Step 2: Add keyframe animations**

```css
/* 1. Smokestack puff — fades in/out. */
@keyframes engine-smokestack-puff {
    0%   { opacity: 0.0; }
    20%  { opacity: 1.0; }
    60%  { opacity: 0.6; }
    100% { opacity: 0.0; }
}
.engine-cell-positional[data-kind="engine-smokestack-puff"] {
    animation: engine-smokestack-puff 1.5s ease-out infinite;
}
#furnace-ascii:not(.burning) .engine-cell-positional[data-kind="engine-smokestack-puff"] {
    animation: none;
    opacity: 0;
}

/* 2. Ember pulse — each ember in the cluster brightens/dims. */
@keyframes engine-ember-pulse {
    0%, 100% { opacity: 0.6; text-shadow: 0 0 2px rgba(255, 154, 74, 0.4); }
    50%      { opacity: 1.0; text-shadow: 0 0 6px rgba(255, 154, 74, 0.9); }
}
.engine-cell-positional[data-kind="engine-ember-cluster"] {
    animation: engine-ember-pulse 1.4s ease-in-out infinite;
}
.engine-cell-positional[data-kind="engine-ember-cluster"]:nth-child(2n) {
    animation-delay: 0.4s;
}

/* 3. Tooth shimmer — only when engine is roaring. */
@keyframes engine-tooth-shimmer {
    0%, 100% { color: #c9a05a; }
    50%      { color: #f0d080; }
}
#furnace-ascii.roaring .engine-cell-positional[data-kind="engine-mouth-toothed"],
#furnace-ascii.roaring .engine-cell-positional[data-kind="engine-mouth-toothed-wide"] {
    animation: engine-tooth-shimmer 0.6s ease-in-out infinite;
}

/* 4. Viewport spin — fake rotation via transform (CSS can't change content
      text directly across keyframes for non-pseudo-element cells). */
@keyframes engine-viewport-spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.engine-cell-positional[data-kind="engine-viewport"] {
    display: inline-block;
    animation: engine-viewport-spin 1.5s linear infinite;
}

/* 5. Foundation rune heartbeat — corner * cells pulse. */
@keyframes engine-rune-heartbeat {
    0%, 100% { opacity: 0.4; color: #c9a05a; }
    50%      { opacity: 1.0; color: #e8c060; text-shadow: 0 0 4px rgba(232, 192, 96, 0.6); }
}
.engine-cell-positional.engine-rune {
    animation: engine-rune-heartbeat 3s ease-in-out infinite;
}
```

- [ ] **Step 3: Manual playtest**

Reach each upgrade state and verify the animation:
- Burning + smokestack: puff `~` fades in/out above stack
- Capstone + cold: ember cluster pulses brighter/dimmer, runes pulse heartbeat
- Capstone + roaring: teeth shimmer color
- Capstone always: viewport `╳` rotates

Animations should layer independently (no interference).

- [ ] **Step 4: Bump version + commit**

```bash
git add style.css service-worker.js game.js
git commit -m "feat(engine): 5 CSS animations + brass-gold accents for L2 parts"
git push
```

(`game.js` is in the add list because APP_VERSION must bump in lockstep.)

---

## Task 12: Cleanup — remove legacy `renderBareEngineAscii`

**Files:**
- Modify: `game.js` — remove the legacy function (no longer called).

- [ ] **Step 1: Verify no callers**

```bash
grep -n "renderBareEngineAscii" game.js
```

Should only show the function definition itself.

- [ ] **Step 2: Delete the function definition**

Find `function renderBareEngineAscii(target, glowCore) {` and delete the entire function body. Also remove the comment block above it that introduces the function.

- [ ] **Step 3: Manual playtest**

Run through all engine states (cold, burning, roaring) at multiple upgrade levels. Every state should still render correctly via the new path.

- [ ] **Step 4: Bump version + commit**

```bash
git add game.js service-worker.js
git commit -m "refactor(engine): remove legacy renderBareEngineAscii (unused)"
git push
```

---

## Task 13: Update docs + delete verifier

**Files:**
- Modify: `CLAUDE.md` — Visual Architecture section gains Engine kinds reference.
- Modify: `docs/mechanics.md` — Progression Tiers section gains Level 2 mention.
- Modify: `.claude/skills/ascii-scenes/SKILL.md` — note the engine pattern.
- Delete: `_check_engine.js`.

- [ ] **Step 1: Update CLAUDE.md**

Find the "Visual Architecture" section. Add to the registry list:

```
- `ENGINE_KINDS` — engine silhouette kinds (frame, face, mouth variants,
  smokestack, vents, etched foundation, viewport, ember cluster). Engine
  kinds support state-driven instance composition: `buildEngineInstances`
  reads `game.engineUpgrades` to decide which kinds to render.
```

- [ ] **Step 2: Update docs/mechanics.md**

Find the Progression Tiers section. Insert between item 1 and item 2:

```
**Engine Tier 2 Suite** — once Phase 1 is complete the player can buy a
4-upgrade incremental suite (Smokestack, Side Vents, Toothed Maw,
Etched Foundation), each adding a visible part to the engine. After
all 4 are bought a Capstone unlocks that triggers the Level 2 visual
transformation: the engine grows a third ember cluster, widens the
maw, gains an internal viewport, and gains 5 layered CSS animations.
Costs and mechanical bonuses are placeholder for now (1 stick each,
visual-only); balance pass to come.
```

- [ ] **Step 3: Update ascii-scenes skill**

Find the "Live examples" list near the top of the kinds + instances section. Add:

```
- **`ENGINE_KINDS` + `buildEngineInstances(state)`** — engine silhouette
  with state-driven composition. Demonstrates: dynamic content cells
  (face animation per tick), conditional kinds (smokestack appears
  only if upgrade purchased), capstone variant kinds (ember cluster
  replaces face).
```

- [ ] **Step 4: Delete the verifier**

```bash
rm _check_engine.js
```

- [ ] **Step 5: Bump version + commit**

```bash
git add CLAUDE.md docs/mechanics.md .claude/skills/ascii-scenes/SKILL.md game.js service-worker.js
git rm _check_engine.js
git commit -m "docs(engine): document level-2 architecture; remove temp verifier"
git push
```

---

## Final manual playtest checklist

Run through all of these on the Pixel before declaring done:

- [ ] Fresh save: engine renders identical to pre-refactor
- [ ] Phase 1 complete (1000 heat): four incremental upgrades visible in Furnace tab
- [ ] Buy Smokestack: chimney appears above dome, no other change
- [ ] Buy Side Vents: =[ ]= flank face + maw rows; right vent aligned across rows
- [ ] Buy Toothed Maw: ▽▽▽▽▽ / △△△△△ replaces simple slot; alignment clean
- [ ] Buy Etched Foundation: ─ slope + *===* base
- [ ] All 4 bought: composite matches pre-capstone sketch (11 rows × 15 chars)
- [ ] Capstone now visible in upgrades panel
- [ ] Buy Capstone: flash + shake fire; narration appears; engine transforms
- [ ] Capstone state matches L2 sketch (12 rows × 17 chars; 3 embers; 7 teeth; viewport)
- [ ] All 5 animations run (smokestack puff cycles when burning; ember pulse always; tooth shimmer when roaring; viewport rotates always; rune heartbeat always)
- [ ] Animations don't interfere with each other
- [ ] Save → reload preserves all upgrade flags + visual state
- [ ] Engine fuel-drag drop target still works at every upgrade level
- [ ] Engine spark drag (long-press / desktop drag) still works at every upgrade level
- [ ] Existing pre-refactor save (no `engineUpgrades` field) loads cleanly with all flags false

---

## Self-review notes

**Spec coverage** — every section of the spec maps to a task above:
- Three-level model → Task 5 (UPGRADES + flags) + Task 10 (capstone visual swap)
- Architecture (kinds + instances) → Tasks 2, 3, 4
- Components (kind registry) → Tasks 2, 6, 7, 8, 9, 10
- Visual specs (composite + capstone) → Tasks 6-10
- Animation hooks (5) → Task 11
- Persistence (save schema) → Task 1
- UI / purchase flow → Task 5
- Costs (1 stick placeholder) → Task 5
- Color palette (brass-gold accent) → Task 11
- Touch / drag targets (preserved) → Tasks 4, 12 verification
- Testing (verifier + manual checklist) → Task 4 (verifier), final checklist

**No placeholders** — verified. Every code block contains the actual code; no "TBD" / "implement later" / "add appropriate handling".

**Type consistency** — `game.engineUpgrades` field names (`smokestack`, `vents`, `toothedMaw`, `etchedFoundation`, `capstone`) used consistently across save schema, UPGRADES `apply` hooks, and `buildEngineInstances` checks. Kind names (`engine-frame-base`, `engine-face`, `engine-mouth-slot`, `engine-mouth-toothed`, `engine-mouth-toothed-wide`, `engine-smokestack`, `engine-smokestack-puff`, `engine-side-vent-left`, `engine-side-vent-right`, `engine-foundation-etched`, `engine-ember-cluster`, `engine-viewport`) used consistently across kind definitions, instance pushes, and CSS selectors.
