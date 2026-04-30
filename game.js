// Alchemist's Engine - Core Game Logic

// ============================================
// CONSTANTS
// ============================================

const FUEL_TIERS = [
    { name: 'Spark', value: 1, color: 'fuel-tier-1' },
    { name: 'Ember', value: 3, color: 'fuel-tier-2' },
    { name: 'Kindling', value: 9, color: 'fuel-tier-3' },
    { name: 'Coal', value: 27, color: 'fuel-tier-4' },
    { name: 'Charite', value: 81, color: 'fuel-tier-5' },
    { name: 'Blazite', value: 243, color: 'fuel-tier-6' },
    { name: 'Infernite', value: 729, color: 'fuel-tier-7' },
    { name: 'Solite', value: 2187, color: 'fuel-tier-8' }
];

const ORE_TIERS = [
    { name: 'Raw Ore', value: 1, color: 'ore-tier-1' },
    { name: 'Iron Chunk', value: 3, color: 'ore-tier-2' },
    { name: 'Dense Ore', value: 9, color: 'ore-tier-3' },
    { name: 'Rich Vein', value: 27, color: 'ore-tier-4' },
    { name: 'Pure Crystal', value: 81, color: 'ore-tier-5' }
];

const GRID_SIZE = 24; // 6x4 grid
const GRID_W = 6;
const GRID_H = 4;

const KEYITEMS_CAP = 8;

const RECIPES = [
    {
        id: 'stickGolem',
        name: 'Stick Golem',
        output: { type: 'golem' },   // template; craft flow expands with a fresh id
        pattern: {
            shape: 'plus',
            center: { type: 'fuel', tier: 1 },
            arms: { type: 'ingredient', kind: 'stick' },
        },
    },
];

function matchesSpec(cell, spec) {
    if (!cell || !spec) return false;
    if (cell.type !== spec.type) return false;
    if (spec.tier !== undefined && cell.tier !== spec.tier) return false;
    if (spec.kind !== undefined && cell.kind !== spec.kind) return false;
    return true;
}

function matchPlus(grid, centerSpec, armSpec) {
    for (let y = 1; y < GRID_H - 1; y++) {
        for (let x = 1; x < GRID_W - 1; x++) {
            const ci = y * GRID_W + x;
            if (!matchesSpec(grid[ci], centerSpec)) continue;
            const arms = [
                (y - 1) * GRID_W + x,
                (y + 1) * GRID_W + x,
                y * GRID_W + (x - 1),
                y * GRID_W + (x + 1),
            ];
            if (arms.every(i => matchesSpec(grid[i], armSpec))) {
                return [ci, ...arms];
            }
        }
    }
    return null;
}

function findRecipeMatch(grid) {
    for (const recipe of RECIPES) {
        if (recipe.pattern.shape === 'plus') {
            const cells = matchPlus(grid, recipe.pattern.center, recipe.pattern.arms);
            if (cells) return { recipe, cells };
        }
    }
    return null;
}

function hasTier1FuelOnGrid(g) {
    return Array.isArray(g.grid) && g.grid.some(c => c && c.type === 'fuel' && c.tier === 1);
}

// Keep this in sync with `CACHE` in service-worker.js. Rendered into the
// version tag at the bottom of the page so a stale build is easy to spot.
// **WORKFLOW**: bump BOTH on every shell change. Drifting the two means the
// player sees a "v43" tag while actually running v47 (or vice versa) and
// can't tell whether their cache is stale.
const APP_VERSION = 'v92';

// ============================================
// DEBUG TOUCH LOG  (set false to ship clean)
// ============================================
// Set to true to show an in-page touch-event overlay — useful on mobile
// where devtools aren't available. All instrumentation is gated behind this
// flag; the production path is completely untouched when it's false.
const DEBUG_TOUCH_LOG = false;

(function initDebugTouchLog() {
    if (!DEBUG_TOUCH_LOG) return;

    const MAX_LINES = 20;
    const LOG_LINES = [];

    // Create the fixed overlay panel
    const panel = document.createElement('div');
    panel.id = 'dbg-touch-panel';
    panel.style.cssText = [
        'position:fixed',
        'top:8px',
        'right:8px',
        'width:220px',
        'max-height:260px',
        'overflow-y:auto',
        'background:rgba(10,10,10,0.88)',
        'color:#b8ffb8',
        'font:10px/1.35 monospace',
        'padding:4px 6px',
        'border:1px solid #444',
        'z-index:99999',
        'pointer-events:auto',
        'user-select:text',
        '-webkit-user-select:text',
        'word-break:break-all',
        'border-radius:4px',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;border-bottom:1px solid #333;padding-bottom:2px;';
    const title = document.createElement('span');
    title.textContent = 'DBG:touch (newest↓)';
    title.style.cssText = 'color:#ffff88;font-weight:bold;';
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'background:#222;color:#ffaa44;border:1px solid #555;font:9px monospace;padding:1px 4px;cursor:pointer;border-radius:2px;';
    clearBtn.addEventListener('click', () => { LOG_LINES.length = 0; renderLines(); });
    header.appendChild(title);
    header.appendChild(clearBtn);
    panel.appendChild(header);

    const logEl = document.createElement('div');
    logEl.id = 'dbg-touch-log';
    panel.appendChild(logEl);

    // Wait for body to be available (DOMContentLoaded may not have fired yet)
    function attachPanel() {
        if (document.body) {
            document.body.appendChild(panel);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));
        }
    }
    attachPanel();

    function renderLines() {
        logEl.innerHTML = '';
        LOG_LINES.forEach((line, i) => {
            const row = document.createElement('div');
            row.style.cssText = i % 2 === 0
                ? 'color:#b8ffb8;padding:1px 0;'
                : 'color:#88ddff;padding:1px 0;';
            row.textContent = line;
            logEl.appendChild(row);
        });
        // Scroll to bottom so newest is always visible
        panel.scrollTop = panel.scrollHeight;
    }

    // The global helper — called from instrumentation hooks
    window._dbgLog = function dbgLog(line) {
        if (!DEBUG_TOUCH_LOG) return;
        // Truncate to ~78 chars for readability on small screens
        if (line.length > 78) line = line.slice(0, 75) + '…';
        LOG_LINES.push(line);
        if (LOG_LINES.length > MAX_LINES) LOG_LINES.shift();
        renderLines();
    };
}());
// Fallback no-op so instrumentation calls are safe when the flag is off.
if (!window._dbgLog) window._dbgLog = function () {};

// Phase 1 ends when the player has pushed heat to this level once. The
// peakHeat stat tracks the all-time max so progress is monotonic. The
// phase transition is currently signalled to the player via the
// "Heat 47/100" target readout in the resource bar plus the narration
// beats wired up in REVEAL_STAGES (sootBeat1/2/3 and mergeGrid). The
// engine ASCII visual progression was reverted — it's a TBD redesign.
const PHASE_1_HEAT_TARGET = 1000;

// The Explore card (world map) is gated behind cumulative sticks gathered.
// Until the player has hand-gathered this many sticks, the locked
// placeholder shows in its place. Tracked via game.stats.sticksGathered
// (monotonic — feeding sticks does NOT roll progress back).
const EXPLORE_UNLOCK_STICKS = 50;

const UPGRADES = {
    furnace: [
        { id: 'stickBundle',    name: 'Stick Basket',    desc: 'Gather 4 sticks per trip (slower)', flavor: 'It takes sticks to make sticks.', cost: 5, costType: 'sticks', effect: () => { game.bonuses.sticksPerGather = Math.max(game.bonuses.sticksPerGather, 4); game.bonuses.stickGatherMs = 5000; } },
        { id: 'efficiency1', name: 'Better Bellows', desc: '+25% furnace efficiency', cost: 50, costType: 'heat', effect: () => { game.bonuses.furnaceEfficiency += 0.25; } },
        { id: 'efficiency2', name: 'Insulated Walls', desc: '+25% furnace efficiency', cost: 200, costType: 'heat', requires: 'efficiency1', effect: () => { game.bonuses.furnaceEfficiency += 0.25; } },
        { id: 'efficiency3', name: 'Arcane Vents', desc: '+50% furnace efficiency', cost: 1000, costType: 'heat', requires: 'efficiency2', effect: () => { game.bonuses.furnaceEfficiency += 0.5; } },
        { id: 'capacity1', name: 'Fuel Chamber', desc: 'Furnace holds +100 fuel', cost: 100, costType: 'heat', effect: () => { game.bonuses.furnaceCapacity += 100; } },
        { id: 'capacity2', name: 'Deep Hearth', desc: 'Furnace holds +500 fuel', cost: 500, costType: 'heat', requires: 'capacity1', effect: () => { game.bonuses.furnaceCapacity += 500; } },
        { id: 'heatMult1', name: 'Heat Resonance', desc: '2x heat generation', cost: 2000, costType: 'heat', effect: () => { game.bonuses.heatMultiplier *= 2; } },
        { id: 'heatMult2', name: 'Thermal Mastery', desc: '2x heat generation', cost: 10000, costType: 'heat', requires: 'heatMult1', effect: () => { game.bonuses.heatMultiplier *= 2; } },
        { id: 'heatRetention1', name: 'Thermal Mortar', desc: 'Heat decays 60% slower when idle', cost: 300, costType: 'heat', effect: () => { game.bonuses.heatDecayRate = 0.002; } },
        { id: 'heatRetention2', name: 'Sealed Crucible', desc: 'Heat no longer decays when idle', cost: 3000, costType: 'heat', requires: 'heatRetention1', effect: () => { game.bonuses.heatDecayRate = 0; } },
        { id: 'heatRetention3', name: 'Ember Heart', desc: 'Generate +0.5 heat/s while idle', cost: 30000, costType: 'heat', requires: 'heatRetention2', effect: () => { game.bonuses.heatPassiveGen = 0.5; } },
        { id: 'unlockSmelter', name: 'Unlock Smelter', desc: 'Enables ore processing', cost: 500, costType: 'heat', effect: () => { unlockTier('smelter'); } }
    ],
    smelter: [
        { id: 'smeltSpeed1', name: 'Quick Smelt', desc: '+50% smelting speed', cost: 50, costType: 'metal', effect: () => { game.bonuses.smeltSpeed += 0.5; } },
        { id: 'smeltSpeed2', name: 'Rapid Refining', desc: '+50% smelting speed', cost: 200, costType: 'metal', requires: 'smeltSpeed1', effect: () => { game.bonuses.smeltSpeed += 0.5; } },
        { id: 'metalYield1', name: 'Ore Purity', desc: '+50% metal yield', cost: 100, costType: 'metal', effect: () => { game.bonuses.metalYield += 0.5; } },
        { id: 'metalYield2', name: 'Master Extraction', desc: '+100% metal yield', cost: 500, costType: 'metal', requires: 'metalYield1', effect: () => { game.bonuses.metalYield += 1; } },
        { id: 'unlockForge', name: 'Unlock Forge', desc: 'Enables alloy crafting', cost: 100, costType: 'metal', effect: () => { unlockTier('forge'); } }
    ],
    forge: [
        { id: 'forgeSpeed1', name: 'Hot Hammer', desc: '+50% forging speed', cost: 20, costType: 'alloy', effect: () => { game.bonuses.forgeSpeed += 0.5; } },
        { id: 'alloyQuality1', name: 'Refined Mixture', desc: '+25% alloy output', cost: 50, costType: 'alloy', effect: () => { game.bonuses.alloyYield += 0.25; } },
        { id: 'alloyQuality2', name: 'Perfect Blend', desc: '+50% alloy output', cost: 150, costType: 'alloy', requires: 'alloyQuality1', effect: () => { game.bonuses.alloyYield += 0.5; } },
        { id: 'unlockWorkshop', name: 'Unlock Workshop', desc: 'Enables automation', cost: 50, costType: 'alloy', effect: () => { unlockTier('workshop'); } }
    ],
    workshop: [
        { id: 'gearEfficiency1', name: 'Precision Gears', desc: 'Automation 25% more effective', cost: 20, costType: 'gear', effect: () => { game.bonuses.automationEfficiency += 0.25; } },
        { id: 'gearEfficiency2', name: 'Clockwork Mastery', desc: 'Automation 50% more effective', cost: 100, costType: 'gear', requires: 'gearEfficiency1', effect: () => { game.bonuses.automationEfficiency += 0.5; } },
        { id: 'essenceGen', name: 'Essence Condenser', desc: 'Generate essence from heat', cost: 200, costType: 'gear', effect: () => { game.unlockedTiers.essence = true; updateUI(); } },
        { id: 'unlockSanctum', name: 'Unlock Sanctum', desc: 'Access prestige mechanics', cost: 500, costType: 'gear', requires: 'essenceGen', effect: () => { unlockTier('sanctum'); } }
    ]
};

const ACHIEVEMENTS = [
    { id: 'firstMerge', name: 'First Combination', desc: 'Perform your first merge', icon: '[+]', check: () => game.stats.totalMerges >= 1 },
    { id: 'tenMerges', name: 'Apprentice Alchemist', desc: 'Perform 10 merges', icon: '[&]', check: () => game.stats.totalMerges >= 10 },
    { id: 'hundredMerges', name: 'Journeyman Alchemist', desc: 'Perform 100 merges', icon: '[%]', check: () => game.stats.totalMerges >= 100 },
    { id: 'thousandMerges', name: 'Master Alchemist', desc: 'Perform 1000 merges', icon: '[@]', check: () => game.stats.totalMerges >= 1000 },
    { id: 'firstHeat', name: 'Warmth', desc: 'Generate your first heat', icon: '[~]', check: () => game.stats.totalHeat >= 1 },
    { id: 'thousandHeat', name: 'Getting Warmer', desc: 'Generate 1,000 heat', icon: '[^]', check: () => game.stats.totalHeat >= 1000 },
    { id: 'millionHeat', name: 'Inferno', desc: 'Generate 1,000,000 heat', icon: '[!]', check: () => game.stats.totalHeat >= 1000000 },
    { id: 'tier3Fuel', name: 'Kindled Spirit', desc: 'Create Kindling', icon: '[=]', check: () => game.stats.highestFuelTier >= 3 },
    { id: 'tier5Fuel', name: 'Coal Miner', desc: 'Create Charite', icon: '[#]', check: () => game.stats.highestFuelTier >= 5 },
    { id: 'tier8Fuel', name: 'Solar Power', desc: 'Create Solite', icon: '[*]', check: () => game.stats.highestFuelTier >= 8 },
    { id: 'unlockSmelter', name: 'Metal Worker', desc: 'Unlock the Smelter', icon: '[S]', check: () => game.unlockedTiers.smelter },
    { id: 'unlockForge', name: 'Forge Master', desc: 'Unlock the Forge', icon: '[F]', check: () => game.unlockedTiers.forge },
    { id: 'unlockWorkshop', name: 'Inventor', desc: 'Unlock the Workshop', icon: '[W]', check: () => game.unlockedTiers.workshop },
    { id: 'unlockSanctum', name: 'Seeker of Truth', desc: 'Unlock the Sanctum', icon: '[?]', check: () => game.unlockedTiers.sanctum },
    { id: 'firstPrestige', name: 'Transmutation', desc: 'Create your first Philosopher\'s Stone', icon: '<>', check: () => game.prestigeCount >= 1 },
    { id: 'tenPrestige', name: 'Enlightened', desc: 'Create 10 Philosopher\'s Stones', icon: '<<>>', check: () => game.prestigeCount >= 10 },
    { id: 'autoSparker', name: 'Automation Begins', desc: 'Build an Auto-Sparker', icon: '[>]', check: () => game.automation.sparkers >= 1 },
    { id: 'fullAuto', name: 'Full Automation', desc: 'Own 10 of each automation', icon: '[>>]', check: () => game.automation.sparkers >= 10 && game.automation.miners >= 10 && game.automation.amplifiers >= 10 }
];

// ============================================
// GAME STATE
// ============================================

const REVEAL_STAGES = [
    { id: 'firstStick',    cond: g => g.stats.kindlingAdded >= 1,  narrate: 'A stick catches. The engine stirs.' },
    { id: 'heatMeter',     cond: g => g.stats.totalHeat >= 1,      narrate: 'A faint warmth rises from the iron.',         targets: ['#resources', '#engine-heat-readout', '#furnace-temp'] },
    { id: 'furnaceStats',  cond: g => g.stats.totalHeat >= 8,      narrate: 'You begin to notice the rhythm of the burn.', targets: ['#fuel-readout'] },
    { id: 'upgrades',      cond: g => g.stats.kindlingAdded >= 3,  narrate: 'The engine responds to your attention. Tools take shape.', targets: ['#upgrades-section'] },
    // Soot-burn-off narration beats fire as peakHeat climbs the Phase 1 target.
    { id: 'sootBeat1',     cond: g => (g.stats.peakHeat || 0) >= PHASE_1_HEAT_TARGET * 0.25, narrate: 'Grime cracks. Something underneath shifts.' },
    { id: 'sootBeat2',     cond: g => (g.stats.peakHeat || 0) >= PHASE_1_HEAT_TARGET * 0.5,  narrate: 'Symbols rise from the soot. Half-remembered.' },
    { id: 'sootBeat3',     cond: g => (g.stats.peakHeat || 0) >= PHASE_1_HEAT_TARGET * 0.75, narrate: 'The engine is almost itself again.' },
    { id: 'mergeGrid',     cond: g => (g.stats.peakHeat || 0) >= PHASE_1_HEAT_TARGET,
        targets: ['#merge-section', '#inventory-rail', '#satchel-rail'],
        onReveal: () => {
            hideIntroControls();
            screenFlash('var(--accent-fire)');
            screenShake('big');
            // Phase 2 awakening modal — interrupts the moment so the
            // narration lands. Honors the Story Prompts toggle.
            if (_narrationsEnabled) {
                const modal = document.getElementById('phase2-modal');
                if (modal) modal.classList.remove('hidden');
            }
        } },
    // Explore card unlocks once the player has gathered EXPLORE_UNLOCK_STICKS
    // sticks cumulatively. Until then, #location-grove-locked shows the
    // narrative prompt + progress; reveal hides it and surfaces the real
    // world-map card (#location-grove).
    { id: 'exploreUnlock', cond: g => (g.stats.sticksGathered || 0) >= EXPLORE_UNLOCK_STICKS,
        narrate: 'Far beyond the engine, brittle trees hold what little kindling remains. The path opens.',
        targets: ['#location-grove'],
        onReveal: () => {
            const locked = document.getElementById('location-grove-locked');
            if (locked) locked.classList.add('hidden');
            screenFlash('var(--accent-essence)');
        } },
    // First-recipe hint: fires once the player has 4 sticks and a Spark on the
    // grid — teaches the golem plus-pattern before they stumble on it by chance.
    { id: 'golemRecipeHint',
        cond: g => !g.flags?.golemRecipeTaught
                && (g.inventory?.sticks || 0) >= 4
                && hasTier1FuelOnGrid(g),
        narrate: 'Four sticks crossed about a single spark... place them on the table.',
        targets: ['#recipes-panel'],
        onReveal: () => { game.flags.golemRecipeTaught = true; } },
    // Achievements stage intentionally omitted while the achievements UI is
    // disabled (see SHOW_ACHIEVEMENTS_UI). Re-add to surface the section.
    { id: 'stats',         cond: g => g.stats.totalHeat >= 150,    narrate: 'Numbers accrue. The work leaves a trace.',    targets: ['#stats-section'] }
];

const defaultGame = {
    resources: {
        heat: 0,
        metal: 0,
        metalFrac: 0,
        alloy: 0,
        alloyFrac: 0,
        gears: 0,
        essence: 0
    },
    inventory: {
        sticks: 0,
        stones: 0
    },
    satchel: [],          // [{type:'fuel'|'ore', tier:1..N, count:1+}, ...] — soft cap 8 stacks
    keyItems: [],         // [{type:'golem', id:'<uuid>'}, ...] — soft cap 8 items
    flags: {
        discoveredRecipes: {},
        golemRecipeTaught: false
    },
    revealed: {},
    grid: Array(GRID_SIZE).fill(null),
    furnace: {
        fuel: 0,
        temperature: 0
    },
    smelter: {
        ore: 0,
        progress: 0
    },
    forge: {
        count: 0
    },
    automation: {
        sparkers: 0,
        miners: 0,
        amplifiers: 0
    },
    upgrades: [],
    achievements: [],
    unlockedTiers: {
        smelter: false,
        forge: false,
        workshop: false,
        sanctum: false,
        essence: false
    },
    bonuses: {
        furnaceEfficiency: 1,
        furnaceCapacity: 100,
        heatMultiplier: 1,
        smeltSpeed: 1,
        metalYield: 1,
        forgeSpeed: 1,
        alloyYield: 1,
        automationEfficiency: 1,
        heatDecayRate: 0.005,
        heatPassiveGen: 0,
        sticksPerGather: 1,
        stickGatherMs: 3000
    },
    stats: {
        totalHeat: 0,
        totalMerges: 0,
        highestFuelTier: 1,
        startTime: Date.now(),
        playTime: 0,
        kindlingAdded: 0,
        sticksGathered: 0,
        peakHeat: 0,
        firstEngineSpark: false
    },
    philosopherStones: 0,
    prestigeCount: 0,
    introSeen: false,
    locations: {
        grove: { collected: [], layoutV: 2 }
    },
    lastUpdate: Date.now()
};

let game = JSON.parse(JSON.stringify(defaultGame));

// ============================================
// DRAG AND DROP STATE
// ============================================

let draggedItem = null;
let draggedIndex = null;
let draggedElement = null;

// ============================================
// INITIALIZATION
// ============================================

let _loopIntervals = [];

function startLoops() {
    if (_loopIntervals.length) return;
    _loopIntervals.push(setInterval(gameLoop, 100));
    _loopIntervals.push(setInterval(saveGame, 30000));
    _loopIntervals.push(setInterval(() => { checkAchievements(); checkReveals(); }, 500));
}

function stopLoops() {
    for (const id of _loopIntervals) clearInterval(id);
    _loopIntervals = [];
}

function init() {
    loadGame();
    processOfflineProgress();
    createGrid();
    setupEventListeners();
    renderUpgrades();
    renderAchievements();
    applyRevealedFlags();
    applyUnlocksFromSave();
    renderGrove();
    const versionText = document.getElementById('version-text');
    if (versionText) versionText.textContent = APP_VERSION;
    updateUI();

    startLoops();

    // Run reveal check immediately so returning players see their state
    checkReveals();

    // Pause simulation when the tab/app is hidden to save battery. The
    // offline processor fast-forwards progress (at 50% efficiency) when
    // the player returns, so the world stays consistent without burning
    // CPU in the background.
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Nautilus WebView and some PWAs use pagehide/pageshow instead.
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
}

function handleVisibilityChange() {
    if (document.hidden) onPageHide();
    else onPageShow();
}

function onPageHide() {
    if (!_loopIntervals.length) return;
    // Freeze the clock so the next resume can compute away-time correctly.
    game.lastUpdate = Date.now();
    saveGame();
    stopLoops();
    // Abort in-flight stick gathering so background tab throttling doesn't
    // leave the button stuck in a half-gathered state on return.
    cancelStickGather(/*deliver=*/false);
}

function onPageShow() {
    if (_loopIntervals.length) return;
    processOfflineProgress();
    // Reset timer after offline processing so gameLoop doesn't double-count.
    game.lastUpdate = Date.now();
    startLoops();
    updateUI();
}

// ============================================
// GRID CREATION
// ============================================

function createGrid() {
    const grid = document.getElementById('merge-grid');
    grid.innerHTML = '';

    for (let i = 0; i < GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.index = i;

        // Drop zone events
        cell.addEventListener('dragover', handleDragOver);
        cell.addEventListener('dragleave', handleDragLeave);
        cell.addEventListener('drop', handleDrop);

        grid.appendChild(cell);

        // Render item if exists
        if (game.grid[i]) {
            renderGridItem(i);
        }
    }

    // Inventory rail listeners: drag/touch from rail → grid (place ingredient),
    // or drag ingredient from grid back onto its rail tile (return it).
    ['inv-tile-stick', 'inv-tile-stone'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        // Mouse drag-over / drop for drop-back-to-rail
        el.addEventListener('dragover', e => {
            if (draggedItem && draggedItem.type === 'ingredient' && draggedItem.kind === el.dataset.kind) {
                e.preventDefault();
                el.classList.add('drag-over');
            }
        });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop', e => {
            e.preventDefault();
            el.classList.remove('drag-over');
            if (!draggedItem || draggedItem.type !== 'ingredient' || draggedItem.kind !== el.dataset.kind) return;
            if (draggedIndex === null) return;
            game.grid[draggedIndex] = null;
            renderGridItem(draggedIndex);
            const ik = invKeyForKind(el.dataset.kind);
            game.inventory[ik] = (game.inventory[ik] || 0) + 1;
            sfx('kindle');
            updateUI();
            saveGame();
            draggedItem = null;
            draggedIndex = null;
        });
        // Mouse drag (HTML5): the early branch in handleDragStart routes to inventory logic.
        el.addEventListener('dragstart', handleDragStart);
        el.addEventListener('dragend', handleDragEnd);
        // Touch drag-start: immediate drag (no hold needed for inv tiles).
        el.addEventListener('touchstart', handleInvTileTouchStart, { passive: false });
    });

    // Satchel rail: mouse drag-over/drop for stash (grid → satchel).
    // The sat-slot drag-start (satchel → grid deploy) is handled by
    // handleDragStart via the .sat-slot[draggable="true"] branch, and
    // touch is handled by handleSatSlotTouchStart wired up in renderSatchelRail
    // via event delegation on #sat-slots.
    const satRailEl = document.getElementById('satchel-rail');
    if (satRailEl) {
        satRailEl.addEventListener('dragover', e => {
            if (draggedItem && (draggedItem.type === 'fuel' || draggedItem.type === 'ore') && !draggedItem.fromEngine && !draggedItem.fromSatchel) {
                e.preventDefault();
                satRailEl.classList.add('drag-over');
            }
        });
        satRailEl.addEventListener('dragleave', () => satRailEl.classList.remove('drag-over'));
        satRailEl.addEventListener('drop', e => {
            e.preventDefault();
            satRailEl.classList.remove('drag-over');
            if (!draggedItem || (draggedItem.type !== 'fuel' && draggedItem.type !== 'ore')) return;
            if (draggedItem.fromEngine || draggedItem.fromSatchel) return;
            if (draggedIndex === null) return;
            const item = game.grid[draggedIndex];
            if (!item || (item.type !== 'fuel' && item.type !== 'ore')) return;
            const ok = stashIntoSatchel(item);
            if (!ok) {
                showToast('Satchel full', 'error');
            } else {
                game.grid[draggedIndex] = null;
                renderGridItem(draggedIndex);
                sfx('kindle');
                updateUI();
                saveGame();
            }
            draggedItem = null;
            draggedIndex = null;
        });
        // Sat-slot drag-start (deploy): delegate from #sat-slots container.
        satRailEl.addEventListener('dragstart', handleDragStart);
        satRailEl.addEventListener('dragend', handleDragEnd);
        // Touch start for deploy (sat-slot → grid): delegate via event bubbling.
        const satSlotsEl = document.getElementById('sat-slots');
        if (satSlotsEl) {
            satSlotsEl.addEventListener('touchstart', handleSatSlotTouchStart, { passive: false });
            // Debug capture: fires before handleSatSlotTouchStart so we see raw bubbling
            if (DEBUG_TOUCH_LOG) {
                satSlotsEl.addEventListener('touchstart', (e) => {
                    _dbgLog(`[capture] touchstart bubbled to #sat-slots | tgt=${e.target.nodeName}#${e.target.id||''} draggable=${e.target.getAttribute('draggable')}`);
                }, { capture: true, passive: true });
            }
        }
    }
}

function renderGridItem(index) {
    const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
    if (!cell) return;

    while (cell.firstChild) cell.removeChild(cell.firstChild);
    const item = game.grid[index];

    if (!item) return;

    const itemEl = document.createElement('div');
    itemEl.dataset.index = index;
    itemEl.dataset.type = item.type;

    if (item.type === 'ingredient') {
        // Ingredient tiles: raw materials from the grove (sticks, stones).
        // They never auto-merge; they sit on the grid waiting for recipes.
        itemEl.className = `ingredient-item ingredient-${item.kind}`;
        itemEl.draggable = true;
        itemEl.dataset.kind = item.kind;
        itemEl.textContent = item.kind === 'stick' ? '/' : '#';
        itemEl.title = item.kind === 'stick'
            ? 'Stick — drag back to Inventory rail to return'
            : 'Stone — drag back to Inventory rail to return';
    } else {
        // Fuel or ore tile
        itemEl.className = `${item.type}-item ${item.type === 'fuel' ? FUEL_TIERS[item.tier - 1].color : ORE_TIERS[item.tier - 1].color}`;
        itemEl.draggable = true;
        itemEl.dataset.tier = item.tier;

        const tierLabel = document.createElement('span');
        tierLabel.className = 'item-tier-label';
        tierLabel.textContent = item.type === 'fuel' ? FUEL_TIERS[item.tier - 1].name : ORE_TIERS[item.tier - 1].name;
        itemEl.appendChild(tierLabel);

        // Value badge — temporary debug aid showing how much fuel/ore the tile
        // is worth. Search "ITEM-VALUE-BADGE" in style.css + game.js to remove.
        const valueBadge = document.createElement('span');
        valueBadge.className = 'item-value';
        valueBadge.textContent = item.type === 'fuel' ? FUEL_TIERS[item.tier - 1].value : ORE_TIERS[item.tier - 1].value;
        itemEl.appendChild(valueBadge);

        itemEl.title = item.type === 'fuel'
            ? `${FUEL_TIERS[item.tier - 1].name} (${FUEL_TIERS[item.tier - 1].value} fuel) — dbl-click or right-click to burn`
            : `${ORE_TIERS[item.tier - 1].name} (${ORE_TIERS[item.tier - 1].value} ore) — dbl-click or right-click to smelt`;
    }

    // Drag events (desktop HTML5 drag API)
    itemEl.addEventListener('dragstart', handleDragStart);
    itemEl.addEventListener('dragend', handleDragEnd);

    // Touch-based drag for mobile (parallels desktop drag)
    itemEl.addEventListener('touchstart', handleTouchStart, { passive: false });

    // Quick-send: double-click sends fuel to furnace, ore to smelter
    // (ingredient tiles have no quick-send target, so this is a no-op for them)
    itemEl.addEventListener('dblclick', (e) => {
        e.preventDefault();
        quickSendItem(index);
    });

    // Right-click also sends to respective processor (faster than double-click)
    itemEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        quickSendItem(index);
    });

    cell.appendChild(itemEl);
}

function burnAllFuel() {
    const maxFuel = game.bonuses.furnaceCapacity;
    let burned = 0;
    for (let i = 0; i < game.grid.length; i++) {
        const item = game.grid[i];
        if (!item || item.type !== 'fuel') continue;
        const value = FUEL_TIERS[item.tier - 1].value;
        if (game.furnace.fuel >= maxFuel) break;
        const added = Math.min(value, maxFuel - game.furnace.fuel);
        game.furnace.fuel += added;
        burned += added;
        game.grid[i] = null;
        renderGridItem(i);
        if (game.furnace.fuel >= maxFuel) break;
    }
    if (burned > 0) {
        flashDropZone('furnace-visual');
        floatPopup(document.getElementById('furnace-visual'), `+${formatNumber(burned)} fuel`, 'heat');
    } else {
        showToast(game.furnace.fuel >= maxFuel ? 'Furnace is full!' : 'No fuel on the grid.', 'error');
    }
}

function smeltAllOre() {
    if (!game.unlockedTiers.smelter) return;
    let added = 0;
    for (let i = 0; i < game.grid.length; i++) {
        const item = game.grid[i];
        if (!item || item.type !== 'ore') continue;
        const value = ORE_TIERS[item.tier - 1].value;
        game.smelter.ore += value;
        added += value;
        game.grid[i] = null;
        renderGridItem(i);
    }
    if (added > 0) {
        flashDropZone('smelter-ore-slot');
        floatPopup(document.getElementById('smelter-visual'), `+${formatNumber(added)} ore`, 'metal');
    } else {
        showToast('No ore on the grid.', 'error');
    }
}

function quickSendItem(index) {
    const item = game.grid[index];
    if (!item) return;

    if (item.type === 'fuel') {
        const fuelValue = FUEL_TIERS[item.tier - 1].value;
        const maxFuel = game.bonuses.furnaceCapacity;
        if (game.furnace.fuel >= maxFuel) {
            showToast('Furnace is full!', 'error');
            return;
        }
        game.furnace.fuel = Math.min(game.furnace.fuel + fuelValue, maxFuel);
        game.grid[index] = null;
        renderGridItem(index);
        flashDropZone('furnace-visual');
    } else if (item.type === 'ore' && game.unlockedTiers.smelter) {
        const oreValue = ORE_TIERS[item.tier - 1].value;
        game.smelter.ore += oreValue;
        game.grid[index] = null;
        renderGridItem(index);
        flashDropZone('smelter-ore-slot');
    }
}

function flashDropZone(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('pulse');
    setTimeout(() => el.classList.remove('pulse'), 300);
}

// Floating popup anchored to an element (shown just above it)
function floatPopup(anchor, text, variant = '') {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `float-popup ${variant}`;
    el.textContent = text;
    el.style.left = (rect.left + rect.width / 2 + window.scrollX) + 'px';
    el.style.top  = (rect.top  + window.scrollY) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1050);
}

function squish(el) {
    if (!el) return;
    el.classList.remove('click-squish');
    // Force reflow so the animation can restart
    void el.offsetWidth;
    el.classList.add('click-squish');
}

// ============================================
// AUDIO (Web Audio API — no assets required)
// ============================================

let _audioCtx = null;
let _audioEnabled = true;
let _volume = 0.8;

function getAudioCtx() {
    if (_audioCtx) {
        if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
        return _audioCtx;
    }
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _audioCtx = new Ctx();
    } catch (e) { return null; }
    return _audioCtx;
}

// Small haptic pulse — used for merge feedback and the engine-drag commit.
// No-op on browsers without the Vibration API (notably iOS Safari).
function hapticTap(ms = 12) {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (_) {}
}

function tone(freq, duration = 0.15, type = 'triangle', volume = 0.15, attackTime = 0.005, delay = 0) {
    if (!_audioEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    const peak = Math.max(0.0001, volume * _volume);
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + delay + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
}

function sfx(kind, tier = 1) {
    switch (kind) {
        case 'merge':
            // Pitch rises with tier for a sense of progress
            tone(440 * Math.pow(1.12, tier - 1), 0.1, 'triangle', 0.12);
            tone(660 * Math.pow(1.12, tier - 1), 0.12, 'sine', 0.08, 0.005, 0.03);
            break;
        case 'kindle':
            tone(180, 0.08, 'square', 0.08);
            break;
        case 'feed':
            tone(320, 0.08, 'triangle', 0.1);
            break;
        case 'purchase':
            tone(523, 0.1, 'triangle', 0.12);
            tone(784, 0.12, 'triangle', 0.1, 0.005, 0.05);
            break;
        case 'craft':
            tone(392, 0.08, 'square', 0.08);
            tone(587, 0.1, 'triangle', 0.08, 0.005, 0.04);
            break;
        case 'smelt':
            tone(220, 0.2, 'sawtooth', 0.05);
            tone(330, 0.15, 'triangle', 0.08, 0.005, 0.08);
            break;
        case 'achievement':
            // Major triad arpeggio
            tone(523, 0.12, 'triangle', 0.12);
            tone(659, 0.12, 'triangle', 0.12, 0.005, 0.08);
            tone(784, 0.2, 'triangle', 0.14, 0.005, 0.16);
            break;
        case 'reveal':
            tone(294, 0.15, 'sine', 0.1);
            tone(440, 0.2, 'sine', 0.12, 0.005, 0.08);
            break;
        case 'prestige':
            tone(130, 0.4, 'sawtooth', 0.1);
            tone(260, 0.4, 'triangle', 0.12, 0.005, 0.1);
            tone(523, 0.6, 'sine', 0.14, 0.005, 0.2);
            break;
        case 'error':
            tone(150, 0.1, 'square', 0.1);
            break;
    }
}

// ============================================
// SCREEN EFFECTS
// ============================================

function screenShake(intensity = 'small') {
    const el = document.getElementById('game-container');
    if (!el) return;
    el.classList.remove('shake-small', 'shake-big');
    void el.offsetWidth;
    el.classList.add(intensity === 'big' ? 'shake-big' : 'shake-small');
    setTimeout(() => el.classList.remove('shake-small', 'shake-big'), 600);
}

function screenFlash(color = 'var(--accent-essence)') {
    const flash = document.createElement('div');
    flash.className = 'screen-flash';
    flash.style.background = color;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
}

// ============================================
// DRAG AND DROP HANDLERS
// ============================================

function handleDragStart(e) {
    _dbgLog(`dragstart | tgt=${e.target.nodeName}#${e.target.id||''}.${[...e.target.classList].slice(0,2).join('.')}`);
    // Satchel rail drag: pull a stashed fuel/ore stack onto the grid.
    const satSlot = e.target.closest && e.target.closest('.sat-slot[draggable="true"]');
    if (satSlot) {
        const slotIndex = parseInt(satSlot.dataset.slotIndex);
        const item = game.satchel[slotIndex];
        if (!item) { e.preventDefault(); return; }
        draggedItem = { type: item.type, tier: item.tier, fromSatchel: true, satchelIndex: slotIndex };
        draggedIndex = null;
        draggedElement = satSlot;
        satSlot.classList.add('dragging');
        _dbgLog(`  set: from=sat ${item.type}/t${item.tier} slot=${slotIndex}`);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `sat:${slotIndex}`);
        }
        return;
    }

    // Inventory rail drag: pull a stick or stone onto the grid.
    const invTile = e.target.closest && e.target.closest('.inv-tile');
    if (invTile) {
        const kind = invTile.dataset.kind;
        const count = (game.inventory[invKeyForKind(kind)] || 0);
        if (count <= 0) { e.preventDefault(); return; }
        draggedItem = { type: 'ingredient', kind, fromInventory: true };
        draggedIndex = null;
        draggedElement = invTile;
        invTile.classList.add('dragging');
        _dbgLog(`  set: from=inv kind=${kind} count=${count}`);
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `inv:${kind}`);
        }
        return;
    }

    draggedIndex = parseInt(e.target.dataset.index);
    draggedItem = game.grid[draggedIndex];
    draggedElement = e.target;
    _dbgLog(`  set: from=grid idx=${draggedIndex} item=${draggedItem ? draggedItem.type+'/t'+draggedItem.tier : 'null'}`);

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex);

    // Ingredient tiles have no tier-based merge targets; skip highlight.
    if (draggedItem.type === 'ingredient') return;

    // Highlight cells with matching same-tier items as valid merge targets
    const maxTier = draggedItem.type === 'fuel' ? FUEL_TIERS.length : ORE_TIERS.length;
    if (draggedItem.tier < maxTier) {
        game.grid.forEach((cell, i) => {
            if (i === draggedIndex) return;
            if (cell && cell.type === draggedItem.type && cell.tier === draggedItem.tier) {
                const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
                if (el) el.classList.add('merge-target');
            }
        });
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItem = null;
    draggedIndex = null;
    draggedElement = null;

    // Remove all drag-over and merge-target states
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.merge-target').forEach(el => el.classList.remove('merge-target'));
}

// Engine-as-source drag: pull a fresh Spark out of the furnace and drop it
// on a grid cell. The synthetic dragged item carries fromEngine=true so the
// drop handlers can branch to engineDropOnCell instead of trying to move a
// non-existent source cell.
function canDragSparkFromEngine() {
    return !!game.revealed.mergeGrid && game.resources.heat >= SPARK_HEAT_COST;
}

function handleEngineDragStart(e) {
    // Mobile browsers can fire a synthetic HTML5 dragstart from their own
    // long-press a few hundred ms after our touch drag has already
    // committed. If we let it run, it sets engine-dragging on the ASCII
    // and the :has() rule pulls the orange highlight off the grid and
    // back onto the engine block. Bail before any state changes.
    if (touchDragState) {
        e.preventDefault();
        return;
    }
    if (!game.revealed.mergeGrid) {
        e.preventDefault();
        return;
    }
    if (game.resources.heat < SPARK_HEAT_COST) {
        e.preventDefault();
        showToast('Not enough heat — gather sticks to rekindle.', 'error');
        return;
    }
    draggedItem = { type: 'fuel', tier: 1, fromEngine: true };
    draggedIndex = -1;
    draggedElement = e.currentTarget;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', 'engine-spark');
        // Custom drag image: a small Spark tile instead of a snapshot of
        // the engine ASCII (which the browser would otherwise capture
        // along with whitespace and look like "the whole engine box").
        const tierInfo = FUEL_TIERS[0];
        const ghost = document.createElement('div');
        ghost.className = `fuel-item ${tierInfo.color}`;
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.left = '-1000px';
        ghost.style.width = '52px';
        ghost.style.height = '52px';
        const label = document.createElement('span');
        label.className = 'item-tier-label';
        label.textContent = tierInfo.name;
        ghost.appendChild(label);
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 26, 26);
        // The browser snapshots the element synchronously for the drag
        // image, so we can remove the source on the next tick.
        setTimeout(() => ghost.remove(), 0);
    }
    e.currentTarget.classList.add('engine-dragging');
    highlightEngineDropTargets();
}

// Light up the merge grid as the player begins drawing a spark out of the
// engine. Empty cells get a soft beacon (.empty-target) so the player
// sees where they can drop; existing tier-1 sparks get a pulse hint
// (.merge-target) since dropping on one merges into an Ember.
function highlightEngineDropTargets() {
    game.grid.forEach((cell, i) => {
        const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
        if (!el) return;
        if (cell && cell.type === 'fuel' && cell.tier === 1) {
            el.classList.add('merge-target');
        } else if (!cell) {
            el.classList.add('empty-target');
        }
    });
}

function clearEngineDropTargets() {
    document.querySelectorAll('.grid-cell.empty-target').forEach(el => el.classList.remove('empty-target'));
}

function handleEngineDragEnd() {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.merge-target').forEach(el => el.classList.remove('merge-target'));
    clearEngineDropTargets();
    const ascii = document.getElementById('furnace-ascii');
    if (ascii) ascii.classList.remove('engine-dragging');
    draggedItem = null;
    draggedIndex = null;
    draggedElement = null;
}

function engineDropOnCell(targetIndex) {
    if (game.resources.heat < SPARK_HEAT_COST) {
        showToast('Not enough heat — gather sticks to rekindle.', 'error');
        sfx('error');
        return;
    }
    const targetItem = game.grid[targetIndex];

    if (!targetItem) {
        // Empty cell: place a fresh Spark
        game.grid[targetIndex] = { type: 'fuel', tier: 1 };
        game.resources.heat -= SPARK_HEAT_COST;
        renderGridItem(targetIndex);
        sfx('kindle');
        game.stats.firstEngineSpark = true;
        updateUI();
        return;
    }

    if (targetItem.type === 'fuel' && targetItem.tier === 1) {
        // Merge fresh Spark into existing tier-1 fuel → Ember (tier 2)
        const newTier = 2;
        game.grid[targetIndex] = { type: 'fuel', tier: newTier };
        game.resources.heat -= SPARK_HEAT_COST;
        game.stats.totalMerges++;
        if (newTier > game.stats.highestFuelTier) game.stats.highestFuelTier = newTier;
        if (game.stats.totalMerges === 1) {
            setNarration('The substances have fused. Bigger embers burn hotter, longer.');
        }
        renderGridItem(targetIndex);
        const newItem = document.querySelector(`.grid-cell[data-index="${targetIndex}"] > div`);
        if (newItem) {
            newItem.classList.add('merge-flash');
            setTimeout(() => newItem.classList.remove('merge-flash'), 300);
            const tierInfo = FUEL_TIERS[newTier - 1];
            if (tierInfo) floatPopup(newItem, `+${tierInfo.name}`, 'merge');
        }
        sfx('merge', newTier);
        hapticTap(15);
        game.stats.firstEngineSpark = true;
        updateUI();
        return;
    }

    // Mismatched cell — fail gracefully
    showToast('Drop on an empty cell or another Spark.', 'error');
}

// Inventory rail → grid: decrement the ingredient count and place a tile.
function inventoryDropOnCell(targetIndex) {
    const kind = draggedItem && draggedItem.kind;
    if (!kind) return;
    if (game.grid[targetIndex] !== null) {
        showToast('Cell is occupied.', 'error');
        return;
    }
    const ik = invKeyForKind(kind);
    if ((game.inventory[ik] || 0) <= 0) return;
    game.inventory[ik] -= 1;
    game.grid[targetIndex] = { type: 'ingredient', kind };
    renderGridItem(targetIndex);
    sfx('kindle');
    updateUI();
    saveGame();
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const targetIndex = parseInt(e.currentTarget.dataset.index);

    // Drag from engine — branch to engineDropOnCell, no source cell to clear.
    if (draggedItem && draggedItem.fromEngine) {
        engineDropOnCell(targetIndex);
        return;
    }

    // Drag from inventory rail — place a fresh ingredient tile on the grid.
    if (draggedItem && draggedItem.fromInventory) {
        inventoryDropOnCell(targetIndex);
        if (draggedElement) draggedElement.classList.remove('dragging');
        draggedItem = null;
        draggedIndex = null;
        draggedElement = null;
        return;
    }

    // Drag from satchel rail — deploy a stashed tile onto the grid.
    if (draggedItem && draggedItem.fromSatchel) {
        satchelDropOnCell(targetIndex);
        if (draggedElement) draggedElement.classList.remove('dragging');
        draggedItem = null;
        draggedIndex = null;
        draggedElement = null;
        return;
    }

    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const targetItem = game.grid[targetIndex];

    // Check if we can merge (ingredients never auto-merge)
    if (targetItem && draggedItem.type !== 'ingredient' &&
        targetItem.type === draggedItem.type &&
        targetItem.tier === draggedItem.tier) {

        const maxTier = draggedItem.type === 'fuel' ? FUEL_TIERS.length : ORE_TIERS.length;

        if (draggedItem.tier < maxTier) {
            // Merge!
            game.grid[draggedIndex] = null;
            game.grid[targetIndex] = {
                type: draggedItem.type,
                tier: draggedItem.tier + 1
            };

            game.stats.totalMerges++;
            if (draggedItem.type === 'fuel' && draggedItem.tier + 1 > game.stats.highestFuelTier) {
                game.stats.highestFuelTier = draggedItem.tier + 1;
            }

            // First-merge and milestone hints
            if (game.stats.totalMerges === 1) {
                setNarration('The substances have fused. Bigger embers burn hotter, longer.');
            } else if (draggedItem.type === 'fuel' && draggedItem.tier + 1 === FUEL_TIERS.length) {
                setNarration('Solite. The pinnacle of the ember path.');
            }

            // Flash animation + SFX + subtle shake on higher tiers
            renderGridItem(targetIndex);
            const newItem = document.querySelector(`.grid-cell[data-index="${targetIndex}"] > div`);
            const newTier = draggedItem.tier + 1;
            if (newItem) {
                newItem.classList.add('merge-flash');
                setTimeout(() => newItem.classList.remove('merge-flash'), 300);
                const mergedTierInfo = (draggedItem.type === 'fuel' ? FUEL_TIERS : ORE_TIERS)[draggedItem.tier];
                if (mergedTierInfo) floatPopup(newItem, `+${mergedTierInfo.name}`, 'merge');
            }
            sfx('merge', newTier);
            hapticTap(15);
            if (newTier >= 4) screenShake('small');
            if (newTier >= 6) screenFlash('var(--accent-fire)');

            renderGridItem(draggedIndex);
        }
    } else if (!targetItem) {
        // Move to empty cell
        game.grid[targetIndex] = draggedItem;
        game.grid[draggedIndex] = null;
        renderGridItem(targetIndex);
        renderGridItem(draggedIndex);
    }
    // If items don't match and cell isn't empty, do nothing (swap could be added)
}

// ============================================
// TOUCH DRAG (mobile) — mirrors desktop drag API
// ============================================

let touchDragState = null; // { ghost, startX, startY, lastTarget, moved, longPressTimer }
const TOUCH_MOVE_THRESHOLD = 6; // px before a touch is considered a drag

// Grid items use immediate drag (no hold) so merging stays snappy. The
// items themselves keep `touch-action: none` so quick swipes on them
// engage the drag without browser scroll competing. Empty grid cells and
// the area around the table keep `touch-action: auto`, so users scroll
// the page by swiping anywhere that isn't a draggable item.
function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    const itemEl = e.currentTarget;
    const index = parseInt(itemEl.dataset.index);
    const item = game.grid[index];
    if (!item) return;

    _dbgLog(`touchstart@grid[${index}] | tgt=${e.target.nodeName}.${[...e.target.classList].join('.')}`);

    const t = e.touches[0];
    touchDragState = {
        itemEl,
        index,
        item,
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        ghost: null,
        lastTarget: null
    };
    _dbgLog(`set: from=grid kind/tier=${item.type}/${item.tier}`);

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function beginTouchDrag() {
    if (!touchDragState || touchDragState.moved) return;
    const { itemEl, index, item } = touchDragState;
    const fromEngine = !!item.fromEngine;
    const fromInventory = !!item.fromInventory;
    const fromSatchel = !!item.fromSatchel;

    const src = fromEngine ? 'engine' : fromInventory ? 'inv' : fromSatchel ? 'sat' : 'grid';
    const desc = fromInventory ? `ingredient/${item.kind}` : `${item.type}/${item.tier !== undefined ? 't' + item.tier : '?'}`;
    _dbgLog(`BEGIN: ghost=${src} item=${desc}`);

    draggedIndex = index;
    draggedItem = item;
    draggedElement = itemEl;

    if (!fromEngine) itemEl.classList.add('dragging');

    let ghost;
    if (fromEngine) {
        // Synthetic Spark ghost (don't clone the whole engine visual)
        ghost = document.createElement('div');
        const tierInfo = FUEL_TIERS[0];
        ghost.className = `fuel-item ${tierInfo.color} touch-ghost`;
        const label = document.createElement('span');
        label.className = 'item-tier-label';
        label.textContent = tierInfo.name;
        ghost.appendChild(label);
        const size = 56;
        ghost.style.left = (touchDragState.startX - size / 2) + 'px';
        ghost.style.top = (touchDragState.startY - size / 2) + 'px';
        ghost.style.width = size + 'px';
        ghost.style.height = size + 'px';
    } else if (fromInventory) {
        // Ingredient ghost: show the glyph character so the player sees what they're dragging.
        ghost = document.createElement('div');
        ghost.className = `ingredient-item ingredient-${item.kind} touch-ghost`;
        ghost.textContent = item.kind === 'stick' ? '/' : '#';
        const size = 52;
        ghost.style.left = (touchDragState.startX - size / 2) + 'px';
        ghost.style.top = (touchDragState.startY - size / 2) + 'px';
        ghost.style.width = size + 'px';
        ghost.style.height = size + 'px';
    } else if (fromSatchel) {
        // Satchel ghost: show the fuel/ore glyph so the player sees what they're deploying.
        ghost = document.createElement('div');
        ghost.className = 'sat-slot touch-ghost';
        ghost.style.color = 'var(--accent-essence)';
        ghost.textContent = satchelGlyph(item);
        const size = 52;
        ghost.style.left = (touchDragState.startX - size / 2) + 'px';
        ghost.style.top = (touchDragState.startY - size / 2) + 'px';
        ghost.style.width = size + 'px';
        ghost.style.height = size + 'px';
    } else {
        // Clone the source grid item so the ghost matches what was picked up
        const rect = itemEl.getBoundingClientRect();
        ghost = itemEl.cloneNode(true);
        ghost.classList.add('touch-ghost');
        ghost.style.left = rect.left + 'px';
        ghost.style.top = rect.top + 'px';
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
    }
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9998';
    ghost.style.opacity = '0.85';
    ghost.style.transform = 'scale(1.15)';
    document.body.appendChild(ghost);
    touchDragState.ghost = ghost;
    touchDragState.moved = true;

    // Highlight merge targets — ingredients have no merge targets so skip.
    if (fromEngine) {
        // Tier-1 sparks merge with the engine spark; empty cells become
        // beacons so the player sees where the spark can land.
        highlightEngineDropTargets();
    } else if (!fromInventory) {
        const maxTier = item.type === 'fuel' ? FUEL_TIERS.length : ORE_TIERS.length;
        if (item.tier < maxTier) {
            game.grid.forEach((cell, i) => {
                if (i === index) return;
                if (cell && cell.type === item.type && cell.tier === item.tier) {
                    const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
                    if (el) el.classList.add('merge-target');
                }
            });
        }
    }
}

// Touch entry point for "drag a Spark out of the engine" flow.
//
// Uses press-and-hold rather than immediate drag so a quick swipe over the
// engine reads as page scroll, not a drag. The flow:
//   1. Touch starts → start a 300ms hold timer + a small movement watcher.
//   2. If finger moves > ENGINE_HOLD_MOVE_TOLERANCE before the timer fires,
//      the hold is abandoned (no preventDefault — browser scrolls normally).
//   3. If 300ms passes with the finger still mostly stationary, commit to
//      a drag: vibrate, set touchDragState, and hand off to the standard
//      touchmove/touchend handlers (which DO preventDefault to block scroll).
let _engineHoldState = null;
const ENGINE_HOLD_MS = 300;
const ENGINE_HOLD_MOVE_TOLERANCE = 8; // px

function clearEngineHoldState() {
    if (!_engineHoldState) return;
    clearTimeout(_engineHoldState.timer);
    document.removeEventListener('touchmove', _engineHoldState.onMove);
    document.removeEventListener('touchend', _engineHoldState.onEnd);
    document.removeEventListener('touchcancel', _engineHoldState.onEnd);
    const ascii = document.getElementById('furnace-ascii');
    if (ascii) ascii.classList.remove('engine-charging');
    _engineHoldState = null;
}

function commitEngineDrag(startX, startY, itemEl) {
    clearEngineHoldState();
    if (game.resources.heat < SPARK_HEAT_COST) {
        _dbgLog(`commitEngineDrag BLOCKED: heat=${Math.floor(game.resources.heat)} < ${SPARK_HEAT_COST}`);
        showToast('Not enough heat — gather sticks to rekindle.', 'error');
        return;
    }
    _dbgLog(`commitEngineDrag → set: from=engine fuel/t1`);
    hapticTap(25);

    touchDragState = {
        itemEl,
        index: -1,
        item: { type: 'fuel', tier: 1, fromEngine: true },
        startX,
        startY,
        moved: false,
        ghost: null,
        lastTarget: null
    };
    // Begin the visible drag immediately — the user is already holding.
    beginTouchDrag();

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleEngineTouchStart(e) {
    if (e.touches.length !== 1) return;
    if (!game.revealed.mergeGrid) return;
    if (game.resources.heat < SPARK_HEAT_COST) return; // silent — quick taps shouldn't toast

    if (_engineHoldState) clearEngineHoldState();

    const t = e.touches[0];
    const startX = t.clientX;
    const startY = t.clientY;
    const itemEl = e.currentTarget;

    const onMove = (me) => {
        if (!_engineHoldState) return;
        const mt = me.touches[0];
        if (!mt) return;
        const dx = mt.clientX - startX;
        const dy = mt.clientY - startY;
        if (Math.hypot(dx, dy) > ENGINE_HOLD_MOVE_TOLERANCE) {
            // Movement before the hold completed — treat as scroll attempt.
            clearEngineHoldState();
        }
    };
    const onEnd = () => clearEngineHoldState();

    const timer = setTimeout(() => commitEngineDrag(startX, startY, itemEl), ENGINE_HOLD_MS);

    _engineHoldState = { timer, onMove, onEnd };
    // passive: false so the browser knows the page may control the gesture.
    // Without this, iOS Safari can commit to scroll on the first touchmove
    // and ignore the post-commit preventDefault — the "first spark didn't
    // disable scroll" bug.
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);

    // Visual cue: the engine border ramps to fire-orange over the hold
    // duration so the user can see they're priming a drag.
    itemEl.classList.add('engine-charging');
}

// Touch drag from the inventory rail: immediate drag (like grid items,
// no hold required). Creates an ingredient ghost tied to the item's glyph.
function handleInvTileTouchStart(e) {
    if (e.touches.length !== 1) return;
    const invTile = e.currentTarget;
    const kind = invTile.dataset.kind;
    const count = (game.inventory[invKeyForKind(kind)] || 0);
    _dbgLog(`touchstart@inv-tile#${invTile.id} kind=${kind} count=${count} | tgt=${e.target.nodeName}#${e.target.id||''}.${[...e.target.classList].slice(0,2).join('.')}`);
    if (count <= 0) { _dbgLog(`  → BLOCKED: count=0`); return; }

    e.preventDefault(); // suppress iOS tap/scroll hijack so the drag commits cleanly

    const t = e.touches[0];
    touchDragState = {
        itemEl: invTile,
        index: null,
        item: { type: 'ingredient', kind, fromInventory: true },
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        ghost: null,
        lastTarget: null
    };
    _dbgLog(`  set: from=inv kind=${kind}`);

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

// Touch drag from the satchel rail: immediate drag (no hold required).
// Delegates via the #sat-slots container so we only need one listener.
function handleSatSlotTouchStart(e) {
    if (e.touches.length !== 1) return;
    _dbgLog(`touchstart@sat-slots | tgt=${e.target.nodeName}#${e.target.id||''}.${[...e.target.classList].slice(0,2).join('.')}`);
    const satSlot = e.target.closest && e.target.closest('.sat-slot[draggable="true"]');
    if (!satSlot) { _dbgLog(`  → closest .sat-slot[draggable] = null (no match)`); return; }
    const slotIndex = parseInt(satSlot.dataset.slotIndex);
    const item = game.satchel[slotIndex];
    _dbgLog(`  → satSlot[${slotIndex}] item=${item ? item.type+'/t'+item.tier : 'null'}`);
    if (!item) return;

    e.preventDefault(); // prevent scroll hijack when starting a drag

    const t = e.touches[0];
    touchDragState = {
        itemEl: satSlot,
        index: null,
        item: { type: item.type, tier: item.tier, fromSatchel: true, satchelIndex: slotIndex },
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        ghost: null,
        lastTarget: null
    };
    _dbgLog(`  set: from=sat ${item.type}/t${item.tier} slot=${slotIndex}`);

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function handleTouchMove(e) {
    if (!touchDragState || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - touchDragState.startX;
    const dy = t.clientY - touchDragState.startY;

    if (!touchDragState.moved) {
        if (Math.hypot(dx, dy) < TOUCH_MOVE_THRESHOLD) return;
        beginTouchDrag();
    }

    // Prevent page scroll while dragging
    e.preventDefault();

    const ghost = touchDragState.ghost;
    if (ghost) {
        ghost.style.left = (t.clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (t.clientY - ghost.offsetHeight / 2) + 'px';
    }

    // Hit-test under the finger (temporarily hide ghost so it isn't picked)
    if (ghost) ghost.style.display = 'none';
    const under = document.elementFromPoint(t.clientX, t.clientY);
    if (ghost) ghost.style.display = '';

    const target = under && under.closest('.grid-cell, .drop-zone, #furnace-ascii, .inv-tile, #satchel-rail');

    if (touchDragState.lastTarget && touchDragState.lastTarget !== target) {
        touchDragState.lastTarget.classList.remove('drag-over');
    }
    if (target && target !== touchDragState.lastTarget) {
        if (target.id === 'furnace-ascii') {
            // Engine ASCII accepts only non-engine fuel drops (a Spark from
            // the engine itself can't be re-fed back into the furnace).
            if (!draggedItem.fromEngine && draggedItem.type === 'fuel') {
                target.classList.add('drag-over');
            }
        } else if (target.classList.contains('drop-zone')) {
            // Other drop zones (smelter ore slot) — engine drags reject all.
            const accepts = !draggedItem.fromEngine && (
                target.id === 'smelter-ore-slot' && draggedItem.type === 'ore'
            );
            if (accepts) target.classList.add('drag-over');
        } else if (target.classList.contains('inv-tile')) {
            // Inventory rail tile accepts ingredient-kind drops for return.
            if (draggedItem && draggedItem.type === 'ingredient' && draggedItem.kind === target.dataset.kind) {
                target.classList.add('drag-over');
            }
        } else if (target.id === 'satchel-rail') {
            // Satchel rail accepts fuel/ore stash drops (not from engine or satchel itself).
            if (draggedItem && (draggedItem.type === 'fuel' || draggedItem.type === 'ore') && !draggedItem.fromEngine && !draggedItem.fromSatchel) {
                target.classList.add('drag-over');
            }
        } else {
            target.classList.add('drag-over');
        }
    }
    touchDragState.lastTarget = target;
}

function handleTouchEnd(e) {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchEnd);

    if (!touchDragState) return;

    // If the user never crossed the drag threshold, let tap/dblclick run — bail.
    if (!touchDragState.moved) {
        touchDragState = null;
        return;
    }

    e.preventDefault();

    const ghost = touchDragState.ghost;
    const changedTouch = (e.changedTouches && e.changedTouches[0]) || null;
    let target = null;
    if (changedTouch) {
        if (ghost) ghost.style.display = 'none';
        const under = document.elementFromPoint(changedTouch.clientX, changedTouch.clientY);
        target = under && under.closest('.grid-cell, .drop-zone, #furnace-ascii, .inv-tile, #satchel-rail');
    }

    _dbgLog(`touchend | draggedItem=${draggedItem ? (draggedItem.fromInventory?'inv/'+draggedItem.kind:draggedItem.fromSatchel?'sat/t'+draggedItem.tier:draggedItem.fromEngine?'engine':'grid/t'+draggedItem.tier) : 'null'} target=${target ? (target.id||target.className.split(' ')[0]) : 'null'}`);

    if (target) {
        if (target.id === 'furnace-ascii') {
            // Drop fuel onto the engine. Engine-source drags are rejected
            // here so a Spark dragged out can't loop back into the furnace.
            if (!draggedItem || !draggedItem.fromEngine) {
                _dbgLog(`DROP: fuel-on-engine`);
                applyFuelDropOnEngine();
            } else {
                _dbgLog(`DROP: fuel-on-engine BLOCKED (fromEngine)`);
            }
        } else if (target.classList.contains('inv-tile')) {
            // Return an ingredient tile from the grid back to the inventory rail.
            _dbgLog(`DROP: inv-tile-return kind=${target.dataset.kind} dragKind=${draggedItem&&draggedItem.kind} dragIdx=${draggedIndex}`);
            if (draggedItem && draggedItem.type === 'ingredient' && draggedItem.kind === target.dataset.kind && draggedIndex !== null) {
                game.grid[draggedIndex] = null;
                const ik = invKeyForKind(target.dataset.kind);
                game.inventory[ik] = (game.inventory[ik] || 0) + 1;
                renderGridItem(draggedIndex);
                sfx('kindle');
                updateUI();
                saveGame();
            }
        } else if (target.id === 'satchel-rail') {
            // Stash a fuel/ore tile from the grid into the satchel.
            _dbgLog(`DROP: satchel-stash dragType=${draggedItem&&draggedItem.type} fromSat=${draggedItem&&draggedItem.fromSatchel} fromEng=${draggedItem&&draggedItem.fromEngine} dragIdx=${draggedIndex}`);
            if (draggedItem && (draggedItem.type === 'fuel' || draggedItem.type === 'ore') && !draggedItem.fromEngine && !draggedItem.fromSatchel && draggedIndex !== null) {
                const item = game.grid[draggedIndex];
                if (item && (item.type === 'fuel' || item.type === 'ore')) {
                    const ok = stashIntoSatchel(item);
                    if (!ok) {
                        showToast('Satchel full', 'error');
                    } else {
                        game.grid[draggedIndex] = null;
                        renderGridItem(draggedIndex);
                        sfx('kindle');
                        updateUI();
                        saveGame();
                    }
                }
            }
        } else if (target.classList.contains('drop-zone')) {
            // Engine-source drag releasing on a drop zone is a no-op —
            // sparks only place on grid cells, not back into the furnace.
            _dbgLog(`DROP: drop-zone id=${target.id}`);
            if (!draggedItem || !draggedItem.fromEngine) {
                dispatchTouchDropOnZone(target);
            }
        } else {
            _dbgLog(`DROP: grid-cell idx=${target.dataset&&target.dataset.index}`);
            dispatchTouchDropOnGrid(target);
        }
    } else {
        _dbgLog(`DROP: no-target (dropped in void)`);
    }

    // Cleanup
    if (ghost) ghost.remove();
    if (touchDragState.itemEl) touchDragState.itemEl.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.merge-target').forEach(el => el.classList.remove('merge-target'));
    clearEngineDropTargets();

    draggedItem = null;
    draggedIndex = null;
    draggedElement = null;
    touchDragState = null;
}

function dispatchTouchDropOnGrid(cell) {
    const targetIndex = parseInt(cell.dataset.index);

    // Drag from engine — branch to engineDropOnCell.
    if (draggedItem && draggedItem.fromEngine) {
        engineDropOnCell(targetIndex);
        return;
    }

    // Drag from inventory rail — place an ingredient tile.
    if (draggedItem && draggedItem.fromInventory) {
        inventoryDropOnCell(targetIndex);
        return;
    }

    // Drag from satchel rail — deploy a stashed tile onto the grid.
    if (draggedItem && draggedItem.fromSatchel) {
        satchelDropOnCell(targetIndex);
        return;
    }

    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const targetItem = game.grid[targetIndex];

    // Ingredients never auto-merge
    if (targetItem && draggedItem.type !== 'ingredient' &&
        targetItem.type === draggedItem.type &&
        targetItem.tier === draggedItem.tier) {
        const maxTier = draggedItem.type === 'fuel' ? FUEL_TIERS.length : ORE_TIERS.length;
        if (draggedItem.tier < maxTier) {
            game.grid[draggedIndex] = null;
            game.grid[targetIndex] = { type: draggedItem.type, tier: draggedItem.tier + 1 };

            game.stats.totalMerges++;
            if (draggedItem.type === 'fuel' && draggedItem.tier + 1 > game.stats.highestFuelTier) {
                game.stats.highestFuelTier = draggedItem.tier + 1;
            }

            if (game.stats.totalMerges === 1) {
                setNarration('The substances have fused. Bigger embers burn hotter, longer.');
            } else if (draggedItem.type === 'fuel' && draggedItem.tier + 1 === FUEL_TIERS.length) {
                setNarration('Solite. The pinnacle of the ember path.');
            }

            renderGridItem(targetIndex);
            const newItem = document.querySelector(`.grid-cell[data-index="${targetIndex}"] > div`);
            const newTier = draggedItem.tier + 1;
            if (newItem) {
                newItem.classList.add('merge-flash');
                setTimeout(() => newItem.classList.remove('merge-flash'), 300);
                const mergedTierInfo = (draggedItem.type === 'fuel' ? FUEL_TIERS : ORE_TIERS)[draggedItem.tier];
                if (mergedTierInfo) floatPopup(newItem, `+${mergedTierInfo.name}`, 'merge');
            }
            sfx('merge', newTier);
            hapticTap(15);
            if (newTier >= 4) screenShake('small');
            if (newTier >= 6) screenFlash('var(--accent-fire)');

            renderGridItem(draggedIndex);
        }
    } else if (!targetItem) {
        game.grid[targetIndex] = draggedItem;
        game.grid[draggedIndex] = null;
        renderGridItem(targetIndex);
        renderGridItem(draggedIndex);
    }
}

function dispatchTouchDropOnZone(zone) {
    if (zone.id === 'smelter-ore-slot' && draggedItem.type === 'ore' && game.unlockedTiers.smelter) {
        const oreValue = ORE_TIERS[draggedItem.tier - 1].value;
        game.smelter.ore += oreValue;

        if (draggedItem.fromSatchel) {
            const slotIdx = draggedItem.satchelIndex;
            const slot = game.satchel[slotIdx];
            if (slot) {
                slot.count -= 1;
                if (slot.count <= 0) game.satchel.splice(slotIdx, 1);
            }
        } else if (draggedIndex !== null && draggedIndex !== undefined) {
            game.grid[draggedIndex] = null;
            renderGridItem(draggedIndex);
        }

        flashDropZone('smelter-ore-slot');
        showToast(`Added ${ORE_TIERS[draggedItem.tier - 1].name} to smelter!`);
        return;
    }

    // Unlock slots: drop a specific high-tier fuel to forge a convenience button
    const unlockCfg = UNLOCK_SLOTS.find(s => s.slotId === zone.id);
    if (unlockCfg && unlockAcceptsDrag(unlockCfg)) {
        consumeItemAndUnlock(unlockCfg);
    }
}

// ============================================
// FURNACE DROP ZONE
// ============================================

// ============================================
// UNLOCK SLOTS — Spark + Burn-All gated behind merge milestones
// ============================================
//
// Two convenience buttons (the [+] Spark spawner and the [»] Burn All
// fuel dump) are hidden by default. To unlock each, the player drops a
// specific high-tier fuel item onto its slot in the Alchemical Table:
//   - Drop a Blazite (tier 6) → unlocks [+] Spark
//   - Drop an Infernite (tier 7) → unlocks [»] Burn All Fuel
// The dropped item is consumed. Unlock state lives in `game.upgrades`
// (under 'sparkUnlock' / 'burnAllUnlock') so it persists with the save.

const UNLOCK_SLOTS = [
    { slotId: 'unlock-spark',     upgradeId: 'sparkUnlock',    requiredType: 'fuel', requiredTier: 6, label: '[+] Spark',          buttonId: 'spawn-fuel'   },
    { slotId: 'unlock-burn-all',  upgradeId: 'burnAllUnlock',  requiredType: 'fuel', requiredTier: 7, label: '[»] Burn All Fuel', buttonId: 'burn-all-btn'  },
    { slotId: 'unlock-smelt-all', upgradeId: 'smeltAllUnlock', requiredType: 'ore',  requiredTier: 5, label: '[»] Smelt All Ore', buttonId: 'smelt-all-btn' }
];

function unlockAcceptsDrag(slotConfig) {
    return draggedItem
        && draggedItem.type === slotConfig.requiredType
        && draggedItem.tier === slotConfig.requiredTier
        && !draggedItem.fromEngine;
}

function applyUnlock(upgradeId) {
    const cfg = UNLOCK_SLOTS.find(s => s.upgradeId === upgradeId);
    if (!cfg) return;
    const slot = document.getElementById(cfg.slotId);
    if (slot) slot.style.display = 'none';
    const btn = document.getElementById(cfg.buttonId);
    if (btn) btn.classList.remove('reveal-hidden');
}

function consumeItemAndUnlock(slotConfig) {
    if (game.upgrades.includes(slotConfig.upgradeId)) return;
    if (draggedIndex === null || draggedIndex < 0) return;

    game.grid[draggedIndex] = null;
    renderGridItem(draggedIndex);
    game.upgrades.push(slotConfig.upgradeId);
    applyUnlock(slotConfig.upgradeId);

    showToast(`${slotConfig.label} unlocked!`, 'success');
    sfx('purchase');
    saveGame();
    updateUI();
}

function setupUnlockSlots() {
    UNLOCK_SLOTS.forEach((cfg) => {
        const slot = document.getElementById(cfg.slotId);
        if (!slot) return;
        slot.addEventListener('dragover', (e) => {
            if (unlockAcceptsDrag(cfg)) {
                e.preventDefault();
                slot.classList.add('drag-over');
            }
        });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            if (unlockAcceptsDrag(cfg)) consumeItemAndUnlock(cfg);
        });
    });
}

function applyUnlocksFromSave() {
    UNLOCK_SLOTS.forEach((cfg) => {
        if (game.upgrades.includes(cfg.upgradeId)) applyUnlock(cfg.upgradeId);
    });
}

// The engine ASCII art (#furnace-ascii) is the fuel drop target — drop fuel
// items dragged from the grid directly onto the engine to feed the
// furnace. Drag-over and pulse styling apply to the whole #furnace-visual
// container via CSS :has() for a more visible flash, but the *touch
// surface* is the small ASCII region only so scrolling near the temp
// badge or fuel readout doesn't pick up phantom drags.
// Engine-source drags (fromEngine = true) are explicitly rejected so a
// Spark dragged out can't loop back into the furnace as input.
function setupFurnaceDropZone() {
    const target = document.getElementById('furnace-ascii');
    if (!target) return;

    target.addEventListener('dragover', (e) => {
        if (!draggedItem) return;
        const isFuel = draggedItem.type === 'fuel';
        const isStickIngredient = draggedItem.type === 'ingredient' && draggedItem.kind === 'stick';
        if (!isFuel && !isStickIngredient) return;
        if (draggedItem.fromEngine) return;
        e.preventDefault(); // permit the drop
        target.classList.add('drag-over');
    });

    target.addEventListener('dragleave', () => {
        target.classList.remove('drag-over');
    });

    target.addEventListener('drop', (e) => {
        e.preventDefault();
        target.classList.remove('drag-over');
        applyFuelDropOnEngine();
    });
}

// Shared fuel-drop logic for the engine, used by both desktop drop and
// the touch dispatch path.
function applyFuelDropOnEngine() {
    if (!draggedItem || draggedItem.fromEngine) return;

    // Stick ingredients (from inventory rail or grid cell) burn just like
    // the [Feed Stick] button — anything burnable is accepted regardless
    // of source. Stones / non-stick ingredients still reject below.
    if (draggedItem.type === 'ingredient' && draggedItem.kind === 'stick') {
        const maxFuel = game.bonuses.furnaceCapacity;
        if (game.furnace.fuel >= maxFuel) {
            showToast('Furnace is full!', 'error');
            return;
        }
        const added = Math.min(STICK_FUEL_VALUE, maxFuel - game.furnace.fuel);
        if (added <= 0) {
            showToast('Furnace is full!', 'error');
            return;
        }
        game.furnace.fuel += added;
        game.stats.kindlingAdded++;

        if (draggedItem.fromInventory) {
            game.inventory.sticks = (game.inventory.sticks || 0) - 1;
        } else if (draggedIndex !== null && draggedIndex !== undefined) {
            game.grid[draggedIndex] = null;
            renderGridItem(draggedIndex);
        }

        floatPopup(document.getElementById('furnace-visual'), '+stick', 'heat');
        flashDropZone('furnace-visual');
        sfx('feed');
        updateUI();
        return;
    }

    if (draggedItem.type !== 'fuel') return;
    const fuelValue = FUEL_TIERS[draggedItem.tier - 1].value;
    const maxFuel = game.bonuses.furnaceCapacity;

    if (game.furnace.fuel >= maxFuel) {
        showToast('Furnace is full!', 'error');
        return;
    }
    game.furnace.fuel = Math.min(game.furnace.fuel + fuelValue, maxFuel);

    // Consume the source. Satchel and grid drags need different bookkeeping.
    if (draggedItem.fromSatchel) {
        const slotIdx = draggedItem.satchelIndex;
        const slot = game.satchel[slotIdx];
        if (slot) {
            slot.count -= 1;
            if (slot.count <= 0) game.satchel.splice(slotIdx, 1);
        }
    } else if (draggedIndex !== null && draggedIndex !== undefined) {
        game.grid[draggedIndex] = null;
        renderGridItem(draggedIndex);
    }

    flashDropZone('furnace-visual');
    showToast(`Added ${FUEL_TIERS[draggedItem.tier - 1].name} to furnace!`);
    updateUI();
}

// ============================================
// SMELTER DROP ZONE
// ============================================

function setupSmelterDropZone() {
    const smelterSlot = document.getElementById('smelter-ore-slot');

    smelterSlot.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem.type === 'ore') {
            smelterSlot.classList.add('drag-over');
        }
    });

    smelterSlot.addEventListener('dragleave', () => {
        smelterSlot.classList.remove('drag-over');
    });

    smelterSlot.addEventListener('drop', (e) => {
        e.preventDefault();
        smelterSlot.classList.remove('drag-over');

        if (draggedItem && draggedItem.type === 'ore') {
            const oreValue = ORE_TIERS[draggedItem.tier - 1].value;
            game.smelter.ore += oreValue;

            if (draggedItem.fromSatchel) {
                const slotIdx = draggedItem.satchelIndex;
                const slot = game.satchel[slotIdx];
                if (slot) {
                    slot.count -= 1;
                    if (slot.count <= 0) game.satchel.splice(slotIdx, 1);
                }
            } else if (draggedIndex !== null && draggedIndex !== undefined) {
                game.grid[draggedIndex] = null;
                renderGridItem(draggedIndex);
            }
            showToast(`Added ${ORE_TIERS[draggedItem.tier - 1].name} to smelter!`);
        }
    });
}

// ============================================
// GAME LOOP
// ============================================

function gameLoop() {
    const now = Date.now();
    const delta = (now - game.lastUpdate) / 1000; // Convert to seconds
    game.lastUpdate = now;
    game.stats.playTime += delta * 1000;

    // Furnace processing
    processFurnace(delta);

    // Smelter processing
    if (game.unlockedTiers.smelter) {
        processSmelter(delta);
    }

    // Essence generation
    if (game.unlockedTiers.essence && game.furnace.temperature > 0) {
        const essenceRate = game.furnace.temperature * 0.001 * getWisdomMultiplier();
        game.resources.essence += essenceRate * delta;
    }

    // Automation
    processAutomation(delta);

    // Phase 1 progress: peakHeat is monotonic, the soot stages key off it
    if (game.resources.heat > (game.stats.peakHeat || 0)) {
        game.stats.peakHeat = game.resources.heat;
    }

    updateUI();
}

function processFurnace(delta) {
    if (game.furnace.fuel > 0) {
        // Burn fuel
        const burnRate = 1 * delta; // 1 fuel per second base
        const burned = Math.min(game.furnace.fuel, burnRate);
        game.furnace.fuel -= burned;

        // Generate heat
        const efficiency = game.bonuses.furnaceEfficiency;
        const heatMult = game.bonuses.heatMultiplier * getWisdomMultiplier();
        const amplifierBonus = 1 + ((game.automation.amplifiers || 0) * 0.5 * game.bonuses.automationEfficiency);
        const heat = burned * 10 * efficiency * heatMult * amplifierBonus;

        game.resources.heat += heat;
        game.stats.totalHeat += heat;

        // Periodic floating heat number (once per second of accumulated heat)
        game._heatAccum = (game._heatAccum || 0) + heat;
        game._heatTimer = (game._heatTimer || 0) + delta;
        if (game._heatTimer >= 1 && game._heatAccum >= 1) {
            const anchor = document.getElementById('furnace-visual');
            if (anchor) floatPopup(anchor, `+${formatNumber(game._heatAccum)} heat`, 'heat');
            game._heatAccum = 0;
            game._heatTimer = 0;
        }

        // Update temperature (approaches fuel level)
        const targetTemp = Math.min(game.furnace.fuel * 5, 1000);
        game.furnace.temperature += (targetTemp - game.furnace.temperature) * 0.1 * delta;
    } else {
        // Cool down
        game.furnace.temperature *= Math.pow(0.95, delta);
        if (game.furnace.temperature < 1) game.furnace.temperature = 0;
        game._heatAccum = 0;
        game._heatTimer = 0;

        // Heat decay while idle. Exponential (0.5% of current heat per
        // second by default) so large stockpiles aren't wiped — but
        // floored at MIN_HEAT_DECAY_PER_SEC so small pools don't
        // linger near-forever (10 heat used to take ~30+ minutes to
        // clear; with the floor it's ~100 seconds). The Sealed
        // Crucible upgrade (decayRate = 0) bypasses both.
        const decayRate = game.bonuses.heatDecayRate || 0;
        if (decayRate > 0 && game.resources.heat > 0) {
            const expLoss   = game.resources.heat * (1 - Math.pow(1 - decayRate, delta));
            const floorLoss = MIN_HEAT_DECAY_PER_SEC * delta;
            game.resources.heat -= Math.max(expLoss, floorLoss);
            if (game.resources.heat < 0.01) game.resources.heat = 0;
        }

        // Passive heat generation (Ember Heart upgrade) — only while idle.
        const passiveGen = game.bonuses.heatPassiveGen || 0;
        if (passiveGen > 0) {
            const gen = passiveGen * delta * getWisdomMultiplier();
            game.resources.heat += gen;
            game.stats.totalHeat += gen;
        }
    }
}

function processSmelter(delta) {
    if (game.smelter.ore > 0 && game.furnace.temperature >= 100) {
        // Smelt ore
        const smeltRate = 10 * game.bonuses.smeltSpeed * delta; // 10% per second base
        game.smelter.progress += smeltRate;

        if (game.smelter.progress >= 100) {
            // Complete smelting. metalYield is a multiplier (default 1 = baseline);
            // upgrade descs say "+50%/+100%" so they shift it to 1.5/2.5. The
            // earlier formula used (1 + metalYield), double-counting the base
            // and making the upgrade text dishonest. Fractional remainder is
            // accumulated in metalFrac so percentage gains never get truncated.
            const expected = game.smelter.ore * game.bonuses.metalYield * getWisdomMultiplier();
            game.resources.metalFrac = (game.resources.metalFrac || 0) + expected;
            const metalGain = Math.floor(game.resources.metalFrac);
            game.resources.metalFrac -= metalGain;
            game.resources.metal += metalGain;
            game.smelter.ore = 0;
            game.smelter.progress = 0;
            showToast(`Smelted ${metalGain} metal!`, 'success');
            floatPopup(document.getElementById('smelter-visual'), `+${formatNumber(metalGain)} metal`, 'metal');
            sfx('smelt');
        }
    } else if (game.furnace.temperature < 100) {
        // Can't smelt without heat
        game.smelter.progress = Math.max(0, game.smelter.progress - 5 * delta);
    }
}

function processAutomation(delta) {
    const efficiency = game.bonuses.automationEfficiency;

    // Auto-sparkers create sparks
    if (game.automation.sparkers > 0) {
        const sparksPerSecond = game.automation.sparkers * 0.5 * efficiency;
        const sparksToAdd = sparksPerSecond * delta;

        // Accumulate fractional sparks
        if (!game._sparkAccum) game._sparkAccum = 0;
        game._sparkAccum += sparksToAdd;

        while (game._sparkAccum >= 1) {
            spawnItem('fuel', false);
            game._sparkAccum -= 1;
        }
    }

    // Auto-miners create ore
    if (game.automation.miners > 0 && game.unlockedTiers.smelter) {
        const orePerSecond = game.automation.miners * 0.3 * efficiency;
        const oreToAdd = orePerSecond * delta;

        if (!game._oreAccum) game._oreAccum = 0;
        game._oreAccum += oreToAdd;

        while (game._oreAccum >= 1) {
            spawnItem('ore', false);
            game._oreAccum -= 1;
        }
    }
}

// ============================================
// ITEM SPAWNING
// ============================================

function spawnItem(type, showMessage = true) {
    // Find empty cell
    const emptyIndex = game.grid.findIndex(cell => cell === null);

    if (emptyIndex === -1) {
        if (showMessage) showToast('Grid is full!', 'error');
        return false;
    }

    game.grid[emptyIndex] = { type, tier: 1 };
    renderGridItem(emptyIndex);
    return true;
}

const SPARK_HEAT_COST = 1;

function spawnFuel() {
    if (game.resources.heat < SPARK_HEAT_COST) {
        showToast('Not enough heat — gather sticks to rekindle.', 'error');
        sfx('error');
        return;
    }
    if (spawnItem('fuel')) {
        game.resources.heat -= SPARK_HEAT_COST;
        updateUI();
    }
}

function spawnOre() {
    const cost = 10;
    if (game.resources.heat >= cost) {
        if (spawnItem('ore')) {
            game.resources.heat -= cost;
            updateUI();
        }
    } else {
        showToast('Not enough heat!', 'error');
    }
}

// ============================================
// CRAFTING
// ============================================

function craftAlloy() {
    const cost = 5;
    if (game.resources.metal >= cost) {
        game.resources.metal -= cost;
        // alloyYield is a multiplier (default 1 = baseline). Upgrade descs say
        // "+25%/+50%" so they push it to 1.25/1.75. The earlier formula used
        // (1 + alloyYield), giving 2x baseline AND making the +25% upgrade
        // produce zero observable effect at base wisdom (floor 2.25 = 2).
        // Carry fractional remainder in alloyFrac so percentage gains roll
        // forward instead of being floored away.
        const expected = game.bonuses.alloyYield * getWisdomMultiplier();
        game.resources.alloyFrac = (game.resources.alloyFrac || 0) + expected;
        const yield_ = Math.floor(game.resources.alloyFrac);
        game.resources.alloyFrac -= yield_;
        game.resources.alloy += yield_;
        game.forge.count++;
        showToast(`Forged ${yield_} alloy!`, 'success');
        floatPopup(document.getElementById('forge-visual'), `+${yield_} alloy`, 'alloy');
        sfx('craft');
    }
}

function craftGear() {
    const cost = 3;
    if (game.resources.alloy >= cost) {
        game.resources.alloy -= cost;
        const yield_ = Math.ceil(getWisdomMultiplier());
        game.resources.gears += yield_;
        showToast(`Crafted ${yield_} gear(s)!`, 'success');
        floatPopup(document.getElementById('workshop-visual'), `+${yield_} gear`, 'gear');
        sfx('craft');
    }
}

function craftAutoSparker() {
    const cost = 10;
    if (game.resources.gears >= cost) {
        game.resources.gears -= cost;
        game.automation.sparkers++;
        showToast('Built Auto-Sparker!', 'success');
    }
}

function craftAutoMiner() {
    const cost = 25;
    if (game.resources.gears >= cost) {
        game.resources.gears -= cost;
        game.automation.miners++;
        showToast('Built Auto-Miner!', 'success');
    }
}

function craftHeatAmplifier() {
    const cost = 50;
    if (game.resources.gears >= cost) {
        game.resources.gears -= cost;
        game.automation.amplifiers++;
        showToast('Built Heat Amplifier!', 'success');
    }
}

// ============================================
// PRESTIGE
// ============================================

function getWisdomMultiplier() {
    return 1 + (game.philosopherStones * 0.25);
}

function getStonesOnReset() {
    const essence = game.resources.essence;
    if (essence < 1000) return 0;
    return Math.floor(Math.sqrt(essence / 1000));
}

function prestige() {
    const stones = getStonesOnReset();
    if (stones <= 0) {
        showToast('Need at least 1000 essence!', 'error');
        return;
    }

    if (!confirm(`Transmute for ${stones} Philosopher's Stone(s)? This will reset your progress but keep your stones.`)) {
        return;
    }

    game.philosopherStones += stones;
    game.prestigeCount++;

    // Reset game state but keep prestige
    const keepStones = game.philosopherStones;
    const keepPrestigeCount = game.prestigeCount;
    const keepStats = {
        totalHeat: game.stats.totalHeat,
        totalMerges: game.stats.totalMerges,
        highestFuelTier: game.stats.highestFuelTier,
        startTime: game.stats.startTime,
        playTime: game.stats.playTime
    };
    const keepAchievements = [...game.achievements];

    game = JSON.parse(JSON.stringify(defaultGame));
    game.philosopherStones = keepStones;
    game.prestigeCount = keepPrestigeCount;
    game.stats = keepStats;
    game.achievements = keepAchievements;
    game.lastUpdate = Date.now();

    createGrid();
    renderUpgrades();
    updateUI();

    showToast(`Transmuted ${stones} Philosopher's Stone(s)!`, 'achievement');
    sfx('prestige');
    screenFlash('var(--accent-prestige)');
    screenShake('big');
    saveGame();
}

// ============================================
// UPGRADES
// ============================================

// Trial location: The Dead Grove. The scene is a hand-authored ASCII
// landscape rendered as a layered, depth-cued composite. Each scene row
// is built from three side-by-side spans:
//
//   [ left near-tree | center mid/far content | right near-tree ]
//
// The left and right spans render the two huge framing trees that run
// the full vertical of the scene. The center span shows whatever depth
// band lives at that y coordinate — distant horizon stipple at the top,
// receding bands of mid-trees in the middle, empty space toward the
// bottom (just trunks visible). Per-span CSS opacity + font-size sells
// the atmospheric perspective: distant content is dim and small, near
// content is bright and large.
//
// `$` placeholders in items rows are replaced at render time by
// clickable item spans (or blank space if that item has already been
// picked). Items don't respawn yet — this is a proof of concept for
// the picture-as-the-UI approach, not a balanced location.
//
// Layout choices come from the brainstorm: A2 atmospheric depth +
// T1 symmetric framing trees, sized for mobile portrait (40 cols
// wide so phones can render at a readable font size). Bark and
// branch detail draws from the ejm winter tree and nabis gnarled
// references on ascii.co.uk (paraphrased, not copied).

const GROVE_SCENE_W = 40;
const GROVE_SIDE_W  = 10;  // each near-tree column
const GROVE_CTR_W   = 20;  // center band width
const GROVE_CTR_OFF = GROVE_SIDE_W;

// ----- Foreground trees: full-height, gnarled bark, knot holes ------

// LEFT framing tree. Trunk centered around col 4-5. Crown branches
// reach inward (to the right) so it visually "leans" toward the
// scene. Bottom flares into roots that meet the ground row.
const LEFT_NEAR_TREE = [
    '    \\|/   ', // 0  crown apex (10c)
    ' \\\\\\|/_/  ', // 1  tangled top branches (10c)
    '  \\\\|//   ', // 2  (10c)
    '\\__\\|//__ ', // 3  broken-branch stub flung left, stub right (10c)
    '    || /  ', // 4  trunk emerges, side branch right
    '    ||/   ', // 5
    '    O|    ', // 6  big knot ON trunk (left side)
    '    ||    ', // 7
    '    ||,   ', // 8  branch stub
    '    (|    ', // 9  small knot left side
    '    ||    ', // 10
    '    ||-   ', // 11 broken stub
    '    ||    ', // 12
    '    |O    ', // 13 big knot ON trunk (right side)
    '    ||    ', // 14
    '    ||    ', // 15
    '    |)    ', // 16 small knot right side
    '    ||,   ', // 17 stub
    '    ||    ', // 18
    '    ||    ', // 19
    '    O|    ', // 20 big knot left
    '    ||    ', // 21
    '    ||    ', // 22
    '    ||,   ', // 23 stub
    '    (|    ', // 24 small knot left
    '    ||    ', // 25
    '    O|    ', // 26 big knot left
    '    ||    ', // 27
    '   -||    ', // 28 broken stub (outside trunk — branch, not knot)
    '    ||    ', // 29
    '    |O    ', // 30 big knot right
    '    ||    ', // 31
    '   /||\\   ', // 32 base flare
    '  /_||_\\  ', // 33
    '_/  ||  \\_'  // 34 root spread
];

// RIGHT framing tree. Mirror of LEFT — trunk col shifted, branches
// reach inward (to the left), with its own knot/stub variation so it
// doesn't read as a flipped copy.
const RIGHT_NEAR_TREE = [
    '   \\|/    ', // 0  (10c)
    ' \\_\\|///  ', // 1  (10c)
    '  \\\\|//   ', // 2  (10c)
    '__\\\\|//__ ', // 3  (10c)
    '  \\ ||    ', // 4
    '   \\||    ', // 5
    '    |O    ', // 6  big knot ON trunk (right side — mirror)
    '    ||    ', // 7
    '   ,||    ', // 8  branch stub
    '    |)    ', // 9  small knot right
    '    ||    ', // 10
    '    ||-   ', // 11 broken stub
    '    ||    ', // 12
    '    O|    ', // 13 big knot left side (variation)
    '    ||    ', // 14
    '    ||    ', // 15
    '    (|    ', // 16 small knot left (variation)
    '   ,||    ', // 17 stub
    '    ||    ', // 18
    '    ||    ', // 19
    '    |O    ', // 20 big knot right
    '    ||    ', // 21
    '    ||    ', // 22
    '   ,||    ', // 23 stub
    '    |)    ', // 24 small knot right
    '    ||    ', // 25
    '    |O    ', // 26 big knot right
    '    ||    ', // 27
    '    ||-   ', // 28 broken stub (outside — branch)
    '    ||    ', // 29
    '    O|    ', // 30 big knot left
    '    ||    ', // 31
    '   /||\\   ', // 32
    '  /_||_\\  ', // 33
    '_/  ||  \\_'  // 34
];

// ----- Mid/far center-band trees -------------------------------------
// Three size tiers, used to populate three receding mid-bands inside
// the 20-char center area. Each band has THREE variants (A/B/C) that
// alternate so the row doesn't read as repeated stamps.

// FAR mid-tree: 4 cols wide, trunk col 1-2. Just a silhouette.
const MID_FAR_A = [' /^\\', '  | ', '  | '];
const MID_FAR_B = [' /|\\', '  | ', '  | '];
const MID_FAR_C = [' ^^ ', '  | ', ' _|_'];
const MID_FAR_D = ['    ', '    ', ' _|_'];          // stump only — open sky above
const MID_FAR_E = [' .  ', ' |  ', ' |_ '];          // half-canopy snag

// MID mid-tree: 5 cols wide, 7 rows tall, trunk col 2.
// Bumped 4→7 rows so they read as a distinct depth from the FAR band
// (which stays at 3 rows). At 7 rows they're ~20% of framing-tree
// height — clearly mid-distance, not "tiny background tree."
const MID_MID_A = [
    '     ',
    ' /^\\ ',
    ' \\|/ ',
    '  |  ',
    '  |  ',
    '  |  ',
    '__|__'
];
const MID_MID_B = [
    '  ^  ',
    ' /|\\ ',
    '  |  ',
    ' /|\\ ',
    '  |  ',
    '  |  ',
    ' _|_ '
];
const MID_MID_C = [
    ' /^\\ ',
    ' /|\\ ',
    ' \\|/ ',
    '  |  ',
    '  |  ',
    '  |  ',
    '__|__'
];
const MID_MID_D = [
    ' /\\/ ',  // forked top
    '  V  ',
    '  |  ',
    '  |  ',
    '  |  ',
    '  |  ',
    ' _|_ '
];
const MID_MID_E = [
    '     ',
    '     ',
    '     ',
    '     ',
    '  ^  ',  // tall skeleton, mostly open sky above
    '  |  ',
    '  |  '
];
const MID_MID_F = [
    '     ',
    '     ',
    '     ',
    '     ',
    '     ',
    '     ',
    ' _|_ '   // pure stump
];

// NEAR mid-tree: 7 cols wide, 11 rows tall, trunk col 3, more branching detail.
// Bumped 6→11 rows. ~30% of framing-tree height — clearly the closest
// "mid-distance" tree before the foreground framing trees take over.
// These are the closest mid-trees, so they get a hint of bark texture.
const MID_NEAR_A = [
    '  /^\\  ',
    ' /^|^\\ ',
    '  \\|/  ',
    ' \\\\|// ',
    '   |   ',
    '   |   ',
    '   O   ',  // knot ON trunk (matches framing-tree style)
    '   |   ',
    '   |   ',
    '  /|\\  ',
    ' _/|\\_ '
];
const MID_NEAR_B = [
    '   ^   ',
    '  \\|/  ',
    ' /\\|/\\ ',
    '   |   ',
    '   |   ',
    '   (   ',  // small knot
    '   |   ',
    '   |   ',
    '   |   ',
    '  /|\\  ',
    '  /|\\  '
];
const MID_NEAR_C = [
    '  /^\\  ',
    ' / | \\ ',
    '  \\|/  ',
    '  /|\\  ',
    '   |   ',
    '   |   ',
    '   |   ',
    '   |   ',
    '   |   ',
    '   |   ',
    ' _/|\\_ '
];
const MID_NEAR_D = [
    '       ',
    '       ',
    '       ',
    '       ',
    '       ',
    '       ',
    '       ',
    '   ^   ',
    '   |   ',
    '   |   ',
    '  _|_  '
];                              // sapling — mostly open sky above
const MID_NEAR_E = [
    '  /^\\  ',
    ' /^|^\\ ',
    ' \\\\|// ',
    '  /|\\  ',
    '   |   ',
    '   |   ',
    '   |   ',
    '   Y   ',  // visible fork in trunk
    '  / \\  ',
    ' /   \\ ',
    '/     \\'
];                              // forked, splayed roots

// ----- Distant horizon ----------------------------------------------
// HORIZON_STIPPLE — single faintest row at the very top.
// DISTANT_TREELINE — two rows just under it, micro-silhouettes.
// FOG_ROW — sparse stipple used between bands to suggest atmospheric
// haze (the eye reads this as distance because real distant forests
// fade into hazy negative space between tree-mass bands).
//
// At the top of the scene (rows 0-3) the framing trees' canopy is
// hidden so distant content can span the full 40-col width — those
// rows use the 20-char constants below mirrored to 40 by helper code
// in buildGroveScene. The 20-char center versions are also still used
// for the inter-band fog rows where framing-tree trunks own the sides.
const HORIZON_STIPPLE  = '. , . , . , . , . ,';
const DISTANT_TREELINE = [
    '. ^ . /\\ . ^ /^\\ . ',
    '^ /\\^./\\^^/\\.^/\\^.'
];
const FOG_ROW          = '  .  ,  \'  .  ,  \'  ';

// ----- Helpers -------------------------------------------------------
function padTo(s, w) {
    if (s.length >= w) return s.slice(0, w);
    return s + ' '.repeat(w - s.length);
}

function buildBand(slotPrim, pattern, totalWidth) {
    // slotPrim: { A: [...], B: [...] } — each slot same height, fixed width
    const slotW = slotPrim[pattern[0]][0].length;
    const h = slotPrim[pattern[0]].length;
    const rows = [];
    for (let r = 0; r < h; r++) {
        let line = '';
        for (const key of pattern) line += slotPrim[key][r];
        rows.push(padTo(line, totalWidth));
    }
    return rows;
}

// ----- Scene composition --------------------------------------------
// Build the SCENE_ROWS structure: an array where each entry describes
// one rendered row as { left, center, right, centerCls }. The left
// and right spans use 'near' styling (full opacity); the center span
// uses whatever depth class the band dictates ('horizon', 'far',
// 'midfar', 'midnear', or 'sky' for empty trunk-only rows).

function buildGroveScene() {
    const rows = [];

    // The left/right framing trees are LEFT_NEAR_TREE.length rows tall
    // and start at row 0. We pre-compute every row's left and right
    // columns, then fill in the center per scene row.
    const leftCol  = (i) => LEFT_NEAR_TREE[i]  || ' '.repeat(GROVE_SIDE_W);
    const rightCol = (i) => RIGHT_NEAR_TREE[i] || ' '.repeat(GROVE_SIDE_W);
    const blankCtr = ' '.repeat(GROVE_CTR_W);

    // Pre-build the three mid-bands. Three variants (A/B/C) cycle so
    // adjacent trees don't look identical.
    // Pass-A irregularity: rotate D/E (and F for mid) variants alongside A/B/C
    // so adjacent slots break the matching-stamps look. Slot count per band
    // unchanged — the center-band stays exactly GROVE_CTR_W (20) cols wide,
    // so the framing trees can't zig-zag.
    const farBand  = buildBand({ A: MID_FAR_A,  B: MID_FAR_B,  C: MID_FAR_C,  D: MID_FAR_D,  E: MID_FAR_E  }, ['A','D','B','E','C'], GROVE_CTR_W);
    const midBand  = buildBand({ A: MID_MID_A,  B: MID_MID_B,  C: MID_MID_C,  D: MID_MID_D,  E: MID_MID_E,  F: MID_MID_F  }, ['A','F','D','B'],     GROVE_CTR_W);
    const nearBand = buildBand({ A: MID_NEAR_A, B: MID_NEAR_B, C: MID_NEAR_C, D: MID_NEAR_D, E: MID_NEAR_E }, ['E','A','D'],         GROVE_CTR_W);

    // Layout of center per scene row index:
    //   0:     horizon stipple                  (.grove-horizon)
    //   1-2:   distant treeline (2 rows)        (.grove-far)
    //   3:     fog row                          (.grove-far)
    //   4-6:   far mid-band (3 rows)            (.grove-midfar)
    //   7:     fog row                          (.grove-midfar)
    //   8-11:  mid mid-band (4 rows)            (.grove-mid)
    //   12:    fog row                          (.grove-mid)
    //   13-18: near mid-band (6 rows)           (.grove-midnear)
    //   19+:   empty sky (trunks only)          (.grove-sky)
    //
    // Total bands = 19 rows. Framing trees are 35 rows, so 16 rows of
    // empty sky/trunks-only at the bottom — gives the eye breathing
    // room and lets the framing trees dominate the lower half.

    function pushRow(left, center, right, centerCls, leftCls, rightCls) {
        // leftCls/rightCls default to 'near' (full-bright framing trees).
        // Full-width-distant rows at the top override all three so the
        // skyline reads continuously edge-to-edge.
        rows.push({
            left, center, right,
            leftCls:   leftCls   || 'near',
            centerCls,
            rightCls:  rightCls  || 'near'
        });
    }

    // Full-width distant row: mirror a 20-char distant constant to 40
    // chars, then OVERLAY the framing-tree canopy chars (LEFT/RIGHT_NEAR_TREE
    // rows 0-3) onto the side spans. Both the canopy chars and the
    // distant content render at the same depthCls — the canopy
    // silhouette is visible (you can see the framing-tree shape) but
    // it BLENDS with the distant treeline rather than standing out at
    // stark near-opacity. Whitespace in the canopy lets distant content
    // peek through, so the distant horizon still spans 40 cols visually.
    function pushFullWidthRow(content20, depthCls, sceneR) {
        const padded = padTo(content20, GROVE_CTR_W);
        const full = padded + padded;  // 40 chars, mirrored
        const leftDistant  = full.slice(0, GROVE_SIDE_W);
        const centerDist   = full.slice(GROVE_SIDE_W, GROVE_SIDE_W + GROVE_CTR_W);
        const rightDistant = full.slice(GROVE_SIDE_W + GROVE_CTR_W);
        const leftCanopy   = LEFT_NEAR_TREE[sceneR]  || ' '.repeat(GROVE_SIDE_W);
        const rightCanopy  = RIGHT_NEAR_TREE[sceneR] || ' '.repeat(GROVE_SIDE_W);
        // Overlay: where canopy has a non-space char, use it; else fall
        // through to the distant content. Both at the same depth class
        // so they blend.
        function overlay(distant, canopy) {
            let out = '';
            for (let c = 0; c < GROVE_SIDE_W; c++) {
                const cChar = canopy[c];
                out += (cChar && cChar !== ' ') ? cChar : (distant[c] || ' ');
            }
            return out;
        }
        pushRow(
            overlay(leftDistant, leftCanopy),
            centerDist,
            overlay(rightDistant, rightCanopy),
            depthCls, depthCls, depthCls
        );
    }

    // Top of scene: distant content edge-to-edge with framing-tree canopy
    // overlaid onto the side spans (blended at the same depth class —
    // see pushFullWidthRow comment above). The framing-tree array's
    // rows 0-3 are now USED for the overlay rather than hidden.
    let r = 0;
    pushFullWidthRow(HORIZON_STIPPLE, 'horizon', r); r++;
    for (const line of DISTANT_TREELINE) { pushFullWidthRow(line, 'far', r); r++; }
    pushFullWidthRow(FOG_ROW, 'far', r); r++;
    // r is now 4. From here, scene rows reach into the framing trees
    // for the regular rendering path (canopy already consumed for r=0..3).

    for (const line of farBand)  { pushRow(leftCol(r), line, rightCol(r), 'midfar');  r++; }
    pushRow(leftCol(r), padTo(FOG_ROW, GROVE_CTR_W), rightCol(r), 'midfar'); r++;
    for (const line of midBand)  { pushRow(leftCol(r), line, rightCol(r), 'mid');     r++; }
    pushRow(leftCol(r), padTo(FOG_ROW, GROVE_CTR_W), rightCol(r), 'mid'); r++;
    for (const line of nearBand) { pushRow(leftCol(r), line, rightCol(r), 'midnear'); r++; }
    while (r < LEFT_NEAR_TREE.length) {
        pushRow(leftCol(r), blankCtr, rightCol(r), 'sky'); r++;
    }

    return rows;
}

const GROVE_SCENE_ROWS = buildGroveScene();

// Ground + items rows live below the framing trees' roots. Items are
// rendered as a single row each (full-width) so the placeholder $/#
// system continues to work as before.
const GROVE_GROUND_ROW = '. , ~ . , ~ . , ~ . , ~ . , ~ . , ~ . , ';
const GROVE_ITEM_ROWS = [
    '   $    $        $         $   $       ',
    '       $    $        $        $    $   ',
    '   $        $    $        $        $   '
];

// One entry per `$` in GROVE_ITEM_ROWS, in left-to-right / top-to-bottom
// order. The 3rd $ in row 1 and 4th $ in row 2 used to be literal `#`
// characters — they looked like stones but weren't clickable. Now they
// are real stone items, so 4 stones / 11 sticks visible. Existing saves
// auto-reset grove.collected on load via GROVE_LAYOUT_V bump.
const GROVE_ITEMS = [
    { type: 'stick' }, { type: 'stick' }, { type: 'stone' }, { type: 'stone' }, { type: 'stick' },
    { type: 'stick' }, { type: 'stick' }, { type: 'stick' }, { type: 'stone' }, { type: 'stone' },
    { type: 'stick' }, { type: 'stick' }, { type: 'stick' }, { type: 'stick' }, { type: 'stick' }
];

function ensureGroveState() {
    if (!game.locations) game.locations = JSON.parse(JSON.stringify(defaultGame.locations));
    if (!game.locations.grove) game.locations.grove = { collected: [] };
    if (!Array.isArray(game.locations.grove.collected)) {
        game.locations.grove.collected = [];
    }
}

function renderGrove() {
    const scene = document.getElementById('grove-scene');
    if (!scene) return;
    ensureGroveState();
    scene.textContent = '';

    const collected = game.locations.grove.collected;
    let itemIdx = 0;

    // Helper: build a clickable item button (or a blank space if
    // already picked) for a single $ placeholder.
    function makeItemNode() {
        const id = itemIdx++;
        if (collected.includes(id)) return document.createTextNode(' ');
        const item = GROVE_ITEMS[id];
        if (!item) return document.createTextNode(' ');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `grove-item grove-${item.type}`;
        btn.setAttribute('aria-label', item.type === 'stick' ? 'Pick up a stick' : 'Pick up a stone');
        btn.textContent = item.type === 'stick' ? '/' : '()';
        btn.addEventListener('click', () => collectGroveItem(id));
        return btn;
    }

    // Helper: produce a span containing this string. If the string has
    // $ characters they become clickable item buttons inline.
    function buildSpan(text, depthCls) {
        const span = document.createElement('span');
        span.className = `grove-cell grove-${depthCls}`;
        for (const ch of text) {
            if (ch === '$') span.appendChild(makeItemNode());
            else span.appendChild(document.createTextNode(ch));
        }
        return span;
    }

    // Compose each scene row from three side-by-side spans:
    // [ left near-tree | center depth band | right near-tree ].
    // The center span carries the row's depth class (horizon / far /
    // midfar / mid / midnear / sky) so atmospheric perspective comes
    // through CSS opacity + size on the center span only. The framing
    // trees stay full-bright and full-size at all heights.
    GROVE_SCENE_ROWS.forEach((rowSpec) => {
        const row = document.createElement('div');
        row.className = 'grove-row grove-scene-row';
        row.appendChild(buildSpan(rowSpec.left,   rowSpec.leftCls   || 'near'));
        row.appendChild(buildSpan(rowSpec.center, rowSpec.centerCls));
        row.appendChild(buildSpan(rowSpec.right,  rowSpec.rightCls  || 'near'));
        scene.appendChild(row);
    });

    // Ground row — single full-width span with its own depth class.
    const groundRow = document.createElement('div');
    groundRow.className = 'grove-row grove-ground-row';
    groundRow.appendChild(buildSpan(GROVE_GROUND_ROW, 'ground'));
    scene.appendChild(groundRow);

    // Item rows — placeholder $ characters become clickable buttons.
    GROVE_ITEM_ROWS.forEach((line) => {
        const row = document.createElement('div');
        row.className = 'grove-row grove-items-row';
        row.appendChild(buildSpan(line, 'items'));
        scene.appendChild(row);
    });

    const allCollected = collected.length >= GROVE_ITEMS.length;
    if (allCollected) {
        const empty = document.createElement('div');
        empty.className = 'grove-empty';
        empty.textContent = 'The grove is empty for now.';
        scene.appendChild(empty);
    }

    const found = document.getElementById('grove-found');
    if (found) {
        const stoneCount = (game.inventory.stones || 0);
        found.textContent = stoneCount > 0 ? `Stones gathered: ${stoneCount}` : '';
    }

    // Auto-fit pass: measure the actual rendered container, compute the
    // exact font-size that packs every row. Runs after layout settles
    // (next frame) so .grove-scene's flex-allocated height is real.
    requestAnimationFrame(autofitGroveScene);
}

// Compute and apply a font-size to every grove-row that makes the
// whole scene (35 scene rows + ground + 3 item rows) fit the
// .grove-scene container exactly. Beats the CSS clamp() formula in
// the file because it measures actual container size — accounts for
// browser chrome, dynamic safe-area, the flex layout, fonts that
// aren't pure 1.0 line-height, etc.
//
// Runs from renderGrove (after each render) and from a window
// resize listener wired up in setupGroveAutofit.
function autofitGroveScene() {
    const modal = document.getElementById('grove-modal');
    // Don't try to measure a hidden modal — clientHeight will be 0.
    if (!modal || modal.classList.contains('hidden')) return;
    const scene = document.getElementById('grove-scene');
    if (!scene) return;
    const rows = scene.querySelectorAll('.grove-row');
    if (!rows.length) return;

    const containerH = scene.clientHeight;
    const containerW = scene.clientWidth;
    if (containerH <= 0 || containerW <= 0) return;

    // Each row's height ≈ font-size × line-height (1.0). Pack rows.length
    // rows into containerH with a 4px slack so the last row doesn't kiss
    // the bottom border.
    const heightBound = (containerH - 4) / rows.length;
    // Each row is 40 chars wide. IBM Plex Mono's char-to-em ratio is
    // ~0.6 — to fit 40 chars in containerW: font ≤ containerW / 24.
    // Add 2px slack to dodge sub-pixel rounding at edges.
    const widthBound  = (containerW - 2) / 24;

    // Pick the more restrictive bound, clamp to legibility range.
    let fontSize = Math.min(heightBound, widthBound);
    fontSize = Math.max(6, Math.min(24, fontSize));

    rows.forEach(r => { r.style.fontSize = fontSize + 'px'; });
}

function collectGroveItem(id) {
    ensureGroveState();
    const collected = game.locations.grove.collected;
    if (collected.includes(id)) return;
    const item = GROVE_ITEMS[id];
    if (!item) return;

    collected.push(id);
    if (item.type === 'stick') {
        game.inventory.sticks = (game.inventory.sticks || 0) + 1;
        game.stats.sticksGathered = (game.stats.sticksGathered || 0) + 1;
        sfx('kindle');
    } else if (item.type === 'stone') {
        game.inventory.stones = (game.inventory.stones || 0) + 1;
        sfx('purchase');
    }

    renderGrove();
    updateUI();
}

// Map an ingredient kind ('stick' / 'stone') to its inventory bucket key.
// Singular form lives on grid tiles, recipe arm specs, and rail data-kind
// attributes; the plural form is the natural English count in game.inventory.
// Keep this in sync if new ingredient kinds get added.
function invKeyForKind(kind) {
    return kind + 's';
}

function renderInventoryRail() {
    const stickEl = document.getElementById('inv-tile-stick');
    const stoneEl = document.getElementById('inv-tile-stone');
    if (!stickEl || !stoneEl) return;
    const sticks = Math.max(0, game.inventory && game.inventory.sticks || 0);
    const stones = Math.max(0, game.inventory && game.inventory.stones || 0);
    document.getElementById('inv-tile-stick-count').textContent = sticks;
    document.getElementById('inv-tile-stone-count').textContent = stones;
    stickEl.classList.toggle('is-empty', sticks <= 0);
    stoneEl.classList.toggle('is-empty', stones <= 0);
    stickEl.setAttribute('draggable', sticks > 0 ? 'true' : 'false');
    stoneEl.setAttribute('draggable', stones > 0 ? 'true' : 'false');
}

const SATCHEL_CAP = 8;
// Glyph arrays parallel FUEL_TIERS and ORE_TIERS by index.
const FUEL_GLYPHS = ['*', '**', '~', '#', '##', '^', '^^', '@'];
const ORE_GLYPHS  = ['o', 'O', '0', '()', '<>'];

function satchelGlyph(item) {
    if (item.type === 'fuel') return FUEL_GLYPHS[item.tier - 1] || '*';
    if (item.type === 'ore')  return ORE_GLYPHS[item.tier - 1]  || 'o';
    return '?';
}

function renderSatchelRail() {
    const slotsEl = document.getElementById('sat-slots');
    if (!slotsEl) return;

    // Ensure 8 slot elements exist (created on first render, never replaced).
    // Stable DOM elements are critical for touch drags — iOS Safari fires
    // touchcancel when the touched element is removed mid-drag, which would
    // cancel the user's deploy gesture before they crossed the move threshold.
    while (slotsEl.children.length < SATCHEL_CAP) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'sat-slot';
        slotsEl.appendChild(slot);
    }

    // Update each slot in place.
    for (let i = 0; i < SATCHEL_CAP; i++) {
        const slot = slotsEl.children[i];
        slot.dataset.slotIndex = String(i);
        slot.replaceChildren();
        const item = game.satchel[i];
        if (!item) {
            slot.classList.add('is-empty');
            slot.textContent = '_';
            slot.setAttribute('draggable', 'false');
            slot.removeAttribute('title');
            slot.setAttribute('aria-label', `Satchel slot ${i + 1}: empty`);
        } else {
            slot.classList.remove('is-empty');
            const glyph = document.createElement('span');
            glyph.className = 'sat-slot-glyph';
            glyph.textContent = satchelGlyph(item);
            slot.appendChild(glyph);
            if (item.count > 1) {
                const count = document.createElement('span');
                count.className = 'sat-slot-count';
                count.textContent = item.count;
                slot.appendChild(count);
            }
            // setAttribute (vs. .draggable property) is more reliable for the
            // [draggable="true"] selector match across mobile browsers.
            slot.setAttribute('draggable', 'true');
            const typeLabel = item.type === 'fuel' ? 'Fuel' : 'Ore';
            slot.title = `${typeLabel} tier ${item.tier} ×${item.count}`;
            slot.setAttribute('aria-label', `Satchel slot ${i + 1}: ${item.count} ${typeLabel} tier ${item.tier}. Drag to deploy.`);
        }
    }
}

function updateCraftButton() {
    const row = document.getElementById('craft-button-row');
    const btn = document.getElementById('craft-btn');
    if (!row || !btn) return;
    const match = findRecipeMatch(game.grid);
    game._recipeMatch = match;   // transient cache, not persisted
    if (!match) {
        row.hidden = true;
        return;
    }
    row.hidden = false;
    btn.textContent = `Craft ${match.recipe.name}`;
    const bagFull = (game.keyItems?.length || 0) >= KEYITEMS_CAP;
    btn.disabled = bagFull;
    btn.title = bagFull ? 'Key Items Bag full' : `Craft ${match.recipe.name}`;
}

// ---- Recipes panel ----

function recipePatternCell(recipe, dx, dy) {
    // For 'plus' shape: center at (1,1) of a 3x3 mini-grid; arms at (1,0),(1,2),(0,1),(2,1).
    if (recipe.pattern.shape !== 'plus') return null;
    if (dx === 1 && dy === 1) return recipe.pattern.center;
    if ((dx === 1 && dy === 0) || (dx === 1 && dy === 2) ||
        (dx === 0 && dy === 1) || (dx === 2 && dy === 1)) return recipe.pattern.arms;
    return null;
}

function specToGlyph(spec) {
    if (!spec) return '·';
    if (spec.type === 'fuel') return FUEL_GLYPHS[(spec.tier || 1) - 1] || '*';
    if (spec.type === 'ore')  return ORE_GLYPHS[(spec.tier || 1) - 1] || 'o';
    if (spec.type === 'ingredient') return spec.kind === 'stick' ? '/' : '#';
    return '?';
}

function renderRecipesPanel() {
    const list = document.getElementById('recipes-list');
    if (!list) return;
    list.replaceChildren();
    for (const recipe of RECIPES) {
        if (!game.flags.discoveredRecipes[recipe.id]) continue;
        const card = document.createElement('div');
        card.className = 'recipe-card';
        const name = document.createElement('div');
        name.className = 'recipe-card-name';
        name.textContent = recipe.name;
        const pat = document.createElement('div');
        pat.className = 'recipe-card-pattern';
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 3; dx++) {
                const cell = document.createElement('span');
                cell.className = 'rc-cell';
                const spec = recipePatternCell(recipe, dx, dy);
                if (spec) {
                    cell.textContent = specToGlyph(spec);
                } else {
                    cell.textContent = '·';
                    cell.classList.add('rc-empty');
                }
                pat.appendChild(cell);
            }
        }
        card.appendChild(name);
        card.appendChild(pat);
        list.appendChild(card);
    }
}

// ---- Key Items modal ----

function renderKeyItemsModal() {
    const countEl = document.getElementById('key-items-count');
    const listEl  = document.getElementById('key-items-list');
    if (countEl) countEl.textContent = String(game.keyItems?.length || 0);
    if (!listEl) return;
    listEl.replaceChildren();
    for (const item of (game.keyItems || [])) {
        const tile = document.createElement('div');
        tile.className = 'key-item-tile';
        tile.textContent = item.type === 'golem' ? 'G' : '?';
        tile.title = item.type;
        tile.tabIndex = 0;
        const itemName = item.type === 'golem' ? 'Stick Golem' : item.type;
        tile.setAttribute('aria-label', itemName);
        listEl.appendChild(tile);
    }
}

function randomId() {
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function performCraft() {
    const match = findRecipeMatch(game.grid);
    if (!match) return;   // defensive — button should already be hidden
    if ((game.keyItems?.length || 0) >= KEYITEMS_CAP) {
        showToast('Key Items Bag full', 'error');
        return;
    }
    // Consume the matched cells
    for (const i of match.cells) {
        game.grid[i] = null;
        renderGridItem(i);
    }
    // Spawn the output
    const out = { ...match.recipe.output, id: randomId() };
    game.keyItems.push(out);
    game.flags.discoveredRecipes[match.recipe.id] = true;
    revealEl(document.getElementById('key-items-btn'));
    // Feedback
    const btn = document.getElementById('craft-btn');
    floatPopup(btn, `+${match.recipe.name}`, 'gear');
    sfx('craft');
    updateUI();
    saveGame();
}

function stashIntoSatchel(item) {
    // Try to merge into an existing stack with same type+tier.
    for (const slot of game.satchel) {
        if (slot.type === item.type && slot.tier === item.tier) {
            slot.count += 1;
            return true;
        }
    }
    // Append a new stack if there's room.
    if (game.satchel.length < SATCHEL_CAP) {
        game.satchel.push({ type: item.type, tier: item.tier, count: 1 });
        return true;
    }
    return false;
}

function satchelDropOnCell(targetIndex) {
    const slotIdx = draggedItem && draggedItem.satchelIndex;
    if (slotIdx === undefined || slotIdx === null) return;
    const slot = game.satchel[slotIdx];
    if (!slot) return;
    const targetCell = game.grid[targetIndex];

    if (targetCell === null) {
        // Deploy onto empty cell.
        game.grid[targetIndex] = { type: slot.type, tier: slot.tier };
        renderGridItem(targetIndex);
        sfx('kindle');
    } else if (targetCell.type === slot.type && targetCell.tier === slot.tier) {
        // Merge into matching tile.
        const maxTier = slot.type === 'fuel' ? FUEL_TIERS.length : ORE_TIERS.length;
        if (slot.tier < maxTier) {
            game.grid[targetIndex] = { type: slot.type, tier: slot.tier + 1 };
            if (slot.type === 'fuel' && slot.tier + 1 > game.stats.highestFuelTier) {
                game.stats.highestFuelTier = slot.tier + 1;
            }
            renderGridItem(targetIndex);
            const newItemEl = document.querySelector(`.grid-cell[data-index="${targetIndex}"] > div`);
            if (newItemEl) {
                newItemEl.classList.add('merge-flash');
                setTimeout(() => newItemEl.classList.remove('merge-flash'), 300);
                const tierInfo = (slot.type === 'fuel' ? FUEL_TIERS : ORE_TIERS)[slot.tier];
                if (tierInfo) floatPopup(newItemEl, `+${tierInfo.name}`, 'merge');
            }
            sfx('merge');
            hapticTap(15);
        } else {
            showToast('Already at max tier', 'error');
            return;
        }
    } else {
        showToast('Cell is occupied', 'error');
        return;
    }

    // Decrement the slot.
    slot.count -= 1;
    if (slot.count <= 0) game.satchel.splice(slotIdx, 1);
    updateUI();
    saveGame();
}

function renderUpgrades() {
    function makeRow(cls, text) {
        const el = document.createElement('div');
        el.className = cls;
        el.textContent = text;
        return el;
    }
    for (const [category, upgrades] of Object.entries(UPGRADES)) {
        const panel = document.getElementById(`${category}-upgrades`);
        if (!panel) continue;

        panel.textContent = '';

        for (const upgrade of upgrades) {
            const div = document.createElement('button');
            div.type = 'button';
            div.className = 'upgrade-item';
            div.dataset.id = upgrade.id;

            const purchased = game.upgrades.includes(upgrade.id);
            const hasRequirement = !upgrade.requires || game.upgrades.includes(upgrade.requires);

            if (purchased) {
                div.classList.add('purchased');
                div.disabled = true;
                div.setAttribute('aria-label', `${upgrade.name} — purchased`);
            } else if (!hasRequirement) {
                div.classList.add('locked');
                div.disabled = true;
                div.setAttribute('aria-label', `${upgrade.name} — locked. Requires another upgrade.`);
            } else {
                div.setAttribute('aria-label', `Buy ${upgrade.name} for ${formatNumber(upgrade.cost)} ${upgrade.costType}`);
            }

            div.appendChild(makeRow('upgrade-name', upgrade.name));
            div.appendChild(makeRow('upgrade-desc', upgrade.desc));
            if (upgrade.flavor) div.appendChild(makeRow('upgrade-flavor', upgrade.flavor));
            const costText = purchased ? 'Purchased' : `${formatNumber(upgrade.cost)} ${upgrade.costType}`;
            div.appendChild(makeRow('upgrade-cost', costText));

            if (!purchased && hasRequirement) {
                div.addEventListener('click', () => purchaseUpgrade(upgrade));
            }

            panel.appendChild(div);
        }
    }
}

function getCostBucket(costType) {
    return (costType === 'sticks' || costType === 'stones') ? game.inventory : game.resources;
}

function purchaseUpgrade(upgrade) {
    if (game.upgrades.includes(upgrade.id)) return;

    const bucket = getCostBucket(upgrade.costType);
    const resource = bucket[upgrade.costType];
    if (resource === undefined || resource < upgrade.cost) {
        showToast(`Not enough ${upgrade.costType}!`, 'error');
        return;
    }

    bucket[upgrade.costType] -= upgrade.cost;
    game.upgrades.push(upgrade.id);
    upgrade.effect();

    renderUpgrades();
    updateUI();
    showToast(`Purchased ${upgrade.name}!`, 'success');
    sfx('purchase');
}

function unlockTier(tier) {
    game.unlockedTiers[tier] = true;

    // Show section
    revealEl(document.getElementById(`${tier}-section`));

    // Show resource if applicable
    if (tier === 'smelter') {
        revealEl(document.getElementById('metal-resource'));
        revealEl(document.getElementById('spawn-ore'));
        revealEl(document.querySelector('[data-tab="smelter-upgrades"]'));
        setNarration('The smelter glows. Stone yields to heat.');
    } else if (tier === 'forge') {
        revealEl(document.getElementById('alloy-resource'));
        revealEl(document.querySelector('[data-tab="forge-upgrades"]'));
        setNarration('Metal surrenders its secrets. The forge is yours.');
    } else if (tier === 'workshop') {
        revealEl(document.getElementById('gear-resource'));
        revealEl(document.querySelector('[data-tab="workshop-upgrades"]'));
        setNarration('The workshop hums. Machines dream of being built.');
    } else if (tier === 'sanctum') {
        revealEl(document.getElementById('essence-resource'));
        revealEl(document.getElementById('prestige-display'));
        setNarration('A silence deeper than sound. The Sanctum awaits.');
    }

    showToast(`Unlocked: ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`, 'achievement');
    sfx('reveal');
    screenFlash('var(--text-primary)');
}

// ============================================
// ACHIEVEMENTS
// ============================================

// Feature flag: while we flesh out the stick phase, the achievements UI is
// hidden — toasts, flashes, the section itself. Data still accumulates so
// flipping this back to true picks up the player's existing progress.
const SHOW_ACHIEVEMENTS_UI = false;

function renderAchievements() {
    if (!SHOW_ACHIEVEMENTS_UI) return;
    const list = document.getElementById('achievements-list');
    list.innerHTML = '';

    for (const ach of ACHIEVEMENTS) {
        const div = document.createElement('div');
        div.className = 'achievement';
        if (game.achievements.includes(ach.id)) {
            div.classList.add('unlocked');
        }

        div.innerHTML = `
            <span class="achievement-icon">${ach.icon}</span>
            <span class="achievement-name">${ach.name}</span>
            <div class="achievement-desc">${ach.desc}</div>
        `;

        list.appendChild(div);
    }

    updateAchievementCount();
}

function checkAchievements() {
    let newAchievements = false;

    for (const ach of ACHIEVEMENTS) {
        if (!game.achievements.includes(ach.id) && ach.check()) {
            game.achievements.push(ach.id);
            newAchievements = true;
            if (SHOW_ACHIEVEMENTS_UI) {
                showToast(`Achievement: ${ach.name}!`, 'achievement');
                sfx('achievement');
                screenFlash('var(--accent-essence)');
            }
        }
    }

    if (newAchievements && SHOW_ACHIEVEMENTS_UI) {
        renderAchievements();
    }
}

function updateAchievementCount() {
    const count = document.getElementById('achievement-count');
    count.textContent = `(${game.achievements.length}/${ACHIEVEMENTS.length})`;
}

// ============================================
// OFFLINE PROGRESS
// ============================================

const OFFLINE_CAP_SECONDS = 8 * 3600;      // 8 hours max
const OFFLINE_MIN_SECONDS = 60;            // Ignore sub-minute away times
const OFFLINE_EFFICIENCY  = 0.5;           // Offline runs at 50% efficiency

function processOfflineProgress() {
    if (!game.lastUpdate) return;
    const now = Date.now();
    const awaySec = Math.max(0, (now - game.lastUpdate) / 1000);
    if (awaySec < OFFLINE_MIN_SECONDS) return;

    const cappedSec = Math.min(awaySec, OFFLINE_CAP_SECONDS);
    const eff = OFFLINE_EFFICIENCY;

    const gained = { heat: 0, essence: 0, sparks: 0, ores: 0 };

    // Burn existing fuel slowly while away, producing heat
    if (game.furnace.fuel > 0) {
        const fuelBurned = Math.min(game.furnace.fuel, cappedSec);
        game.furnace.fuel -= fuelBurned;
        const heatPerFuel = 10 * game.bonuses.furnaceEfficiency * game.bonuses.heatMultiplier
            * getWisdomMultiplier()
            * (1 + (game.automation.amplifiers || 0) * 0.5 * game.bonuses.automationEfficiency);
        gained.heat += fuelBurned * heatPerFuel * eff;
    }

    // Auto-sparker accumulation — cap by empty cells so grid doesn't overflow
    if (game.automation.sparkers > 0) {
        const rate = game.automation.sparkers * 0.5 * game.bonuses.automationEfficiency * eff;
        const emptyCells = game.grid.filter(c => c === null).length;
        gained.sparks = Math.min(Math.floor(rate * cappedSec), emptyCells);
        for (let i = 0; i < gained.sparks; i++) spawnItem('fuel', false);
    }

    // Auto-miner accumulation (only if smelter unlocked)
    if (game.automation.miners > 0 && game.unlockedTiers.smelter) {
        const rate = game.automation.miners * 0.3 * game.bonuses.automationEfficiency * eff;
        const emptyCells = game.grid.filter(c => c === null).length;
        gained.ores = Math.min(Math.floor(rate * cappedSec), emptyCells);
        for (let i = 0; i < gained.ores; i++) spawnItem('ore', false);
    }

    // Passive essence (tracked on furnace temperature)
    if (game.unlockedTiers.essence && game.furnace.temperature > 0) {
        const essenceRate = game.furnace.temperature * 0.001 * getWisdomMultiplier() * eff;
        gained.essence = essenceRate * cappedSec;
        game.resources.essence += gained.essence;
    }

    game.resources.heat += gained.heat;
    game.stats.totalHeat += gained.heat;
    game.lastUpdate = now;

    const awayLabel = formatTime(cappedSec * 1000);
    const capped = awaySec > OFFLINE_CAP_SECONDS;
    const lines = [];
    lines.push(`Away for ${awayLabel}${capped ? ' (capped)' : ''}.`);
    if (gained.heat > 0)    lines.push(`+${formatNumber(gained.heat)} heat`);
    if (gained.essence > 0) lines.push(`+${formatNumber(gained.essence)} essence`);
    if (gained.sparks > 0)  lines.push(`+${gained.sparks} sparks on the grid`);
    if (gained.ores > 0)    lines.push(`+${gained.ores} ores on the grid`);
    if (lines.length > 1) showOfflineModal(lines);
}

function showOfflineModal(lines) {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    const content = document.createElement('div');
    content.className = 'modal-content';
    const h3 = document.createElement('h3');
    h3.textContent = 'Welcome Back';
    content.appendChild(h3);
    const list = document.createElement('div');
    list.className = 'offline-lines';
    for (const line of lines) {
        const row = document.createElement('div');
        row.textContent = `> ${line}`;
        list.appendChild(row);
    }
    content.appendChild(list);
    const btnRow = document.createElement('div');
    btnRow.className = 'modal-buttons';
    const btn = document.createElement('button');
    btn.textContent = '[CONTINUE]';
    btn.addEventListener('click', () => overlay.remove());
    btnRow.appendChild(btn);
    content.appendChild(btnRow);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
}

// ============================================
// PROGRESSIVE REVEAL
// ============================================

let _narrationsEnabled = true;

function setNarration(text, fresh = true) {
    if (!_narrationsEnabled) return;
    const el = document.getElementById('narration');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('fresh', fresh);
    if (fresh) {
        clearTimeout(el._fadeTimer);
        el._fadeTimer = setTimeout(() => el.classList.remove('fresh'), 4500);
    }
}

function revealTargets(selectors) {
    if (!selectors) return;
    for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(revealEl);
    }
}

function revealEl(el) {
    if (!el) return;
    const wasHidden = el.classList.contains('reveal-hidden') || el.classList.contains('hidden');
    el.classList.remove('reveal-hidden');
    el.classList.remove('hidden');
    if (wasHidden) {
        el.classList.add('revealing');
        setTimeout(() => el.classList.remove('revealing'), 1000);
    }
}

function checkReveals() {
    for (const stage of REVEAL_STAGES) {
        if (game.revealed[stage.id]) continue;
        if (!stage.cond(game)) continue;

        game.revealed[stage.id] = true;
        revealTargets(stage.targets);
        if (stage.narrate) setNarration(stage.narrate);
        if (stage.onReveal) stage.onReveal();
        // Soft chime only for substantial reveals (ones with visible targets)
        if (stage.targets && stage.targets.length) sfx('reveal');
    }
}

function hideIntroControls() {
    // No-op kept for compatibility with older reveal stages. The stick
    // gather controls are now permanent so there is nothing to hide.
}

// Apply an already-revealed state on load (no animation)
function applyRevealedFlags() {
    for (const stage of REVEAL_STAGES) {
        if (game.revealed[stage.id] && stage.targets) {
            for (const sel of stage.targets) {
                document.querySelectorAll(sel).forEach(el => el.classList.remove('reveal-hidden'));
            }
            if (stage.id === 'mergeGrid') hideIntroControls();
            if (stage.id === 'exploreUnlock') {
                const locked = document.getElementById('location-grove-locked');
                if (locked) locked.classList.add('hidden');
            }
        }
    }
}

// Stick gathering — always-available manual labor. Gathering takes
// STICK_GATHER_MS so it feels like real work (as opposed to the engine's
// automated flows). A progress bar fills the button while gathering; the
// stick counts as a free resource you can stockpile and feed to the engine.
const STICK_GATHER_MS = 3000;
const STICK_FUEL_VALUE = 3; // each stick = 3 fuel = 3 seconds of burn

// Minimum absolute heat decay per second while idle. Layered on top of
// the percentage-based exponential decay so small pools don't linger
// forever (a 10-heat puddle drains in ~100s instead of half-life-ing
// down for hours). Bypassed entirely when bonuses.heatDecayRate = 0
// (Sealed Crucible upgrade).
const MIN_HEAT_DECAY_PER_SEC = 0.1;
let stickGatherState = null;

function startStickGather() {
    if (stickGatherState) return;
    const btn = document.getElementById('gather-stick-btn');
    if (!btn) return;
    const fill = btn.querySelector('.stick-btn-fill');

    btn.classList.add('gathering');
    btn.disabled = true;
    if (fill) fill.style.width = '0%';

    const duration = game.bonuses.stickGatherMs || STICK_GATHER_MS;
    const startTime = Date.now();
    const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / duration) * 100);
        if (fill) fill.style.width = pct + '%';
    }, 50);
    const timeoutId = setTimeout(() => {
        completeStickGather();
    }, duration);

    stickGatherState = { intervalId, timeoutId };
}

function completeStickGather() {
    cancelStickGather(/*deliver=*/true);
}

function cancelStickGather(deliver = false) {
    if (!stickGatherState) return;
    clearInterval(stickGatherState.intervalId);
    clearTimeout(stickGatherState.timeoutId);
    stickGatherState = null;

    const btn = document.getElementById('gather-stick-btn');
    if (btn) {
        btn.classList.remove('gathering');
        btn.disabled = false;
        const fill = btn.querySelector('.stick-btn-fill');
        if (fill) fill.style.width = '0%';
    }

    if (!deliver) return;

    const sticksToAdd = Math.max(1, Math.floor(game.bonuses.sticksPerGather || 1));
    const prevGathered = game.stats.sticksGathered || 0;
    game.inventory.sticks = (game.inventory.sticks || 0) + sticksToAdd;
    game.stats.sticksGathered = prevGathered + sticksToAdd;

    const btnEl = document.getElementById('gather-stick-btn');
    squish(btnEl);
    if (btnEl) floatPopup(btnEl, sticksToAdd === 1 ? '+stick' : `+${sticksToAdd} sticks`, 'heat');
    sfx('kindle');

    if (prevGathered === 0) {
        setNarration('A stick gathered. Feed it to the engine to kindle heat.');
    }
    updateUI();
    checkReveals();
}

// Consume one stored stick, converting it into STICK_FUEL_VALUE fuel.
function feedStick() {
    if ((game.inventory.sticks || 0) <= 0) {
        showToast('No sticks to feed — gather some first.', 'error');
        return;
    }
    const maxFuel = game.bonuses.furnaceCapacity;
    if (game.furnace.fuel >= maxFuel) {
        showToast('Furnace is full!', 'error');
        return;
    }

    const added = Math.min(STICK_FUEL_VALUE, maxFuel - game.furnace.fuel);
    game.furnace.fuel += added;
    game.inventory.sticks -= 1;
    game.stats.kindlingAdded++;

    const furnaceVisual = document.getElementById('furnace-visual');
    floatPopup(furnaceVisual, '+stick', 'heat');
    flashDropZone('furnace-visual');
    sfx('feed');

    // The 'firstStick' reveal stage fires the first-stick narration.
    // Later beats live here.
    if (game.stats.kindlingAdded === 3) {
        setNarration('The iron grows warm. Keep feeding it.');
    }
    updateUI();
    checkReveals();
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    renderInventoryRail();
    renderSatchelRail();
    updateCraftButton();
    renderRecipesPanel();
    renderKeyItemsModal();

    // Explore card gating — show the live "X / 50" progress while locked.
    // The locked placeholder is hidden by the exploreUnlock reveal stage
    // (and by applyRevealedFlags on load) once the threshold is crossed.
    const exploreLockedEl = document.getElementById('location-grove-locked');
    if (exploreLockedEl && !game.revealed.exploreUnlock) {
        const countEl = document.getElementById('explore-locked-count');
        if (countEl) {
            const gathered = Math.min(EXPLORE_UNLOCK_STICKS, game.stats.sticksGathered || 0);
            countEl.textContent = formatNumber(gathered);
        }
    }

    // Resources — Phase 1 shows the heat bar progressing toward the
    // target; once peakHeat clears it, the bar gives way to an unbounded
    // counter (the bar would be meaningless past 100% fill).
    const phase1Active = (game.stats.peakHeat || 0) < PHASE_1_HEAT_TARGET;
    const heatNow = Math.max(0, game.resources.heat);
    const heatTxt = formatNumber(Math.floor(heatNow));
    document.getElementById('metal-value').textContent = formatNumber(Math.max(0, Math.floor(game.resources.metal)));
    document.getElementById('alloy-value').textContent = formatNumber(Math.max(0, Math.floor(game.resources.alloy)));
    document.getElementById('gear-value').textContent = formatNumber(Math.max(0, Math.floor(game.resources.gears)));
    document.getElementById('essence-value').textContent = formatNumber(Math.max(0, Math.floor(game.resources.essence)));

    // Heat readout (engine column, above fuel). During Phase 1 the bar
    // tracks progress toward PHASE_1_HEAT_TARGET; afterwards the bar
    // is hidden and just the number remains.
    const heatBarEl   = document.getElementById('engine-heat-bar');
    const heatValueEl = document.getElementById('engine-heat-value');
    const heatMaxEl   = document.getElementById('engine-heat-max');
    if (heatValueEl) heatValueEl.textContent = heatTxt;
    if (heatMaxEl)   heatMaxEl.textContent   = phase1Active ? ` / ${PHASE_1_HEAT_TARGET}` : '';
    if (heatBarEl) {
        if (phase1Active) {
            const heatBarWidth = 14;
            const heatFilled = Math.max(0, Math.min(heatBarWidth, Math.floor((heatNow / PHASE_1_HEAT_TARGET) * heatBarWidth)));
            heatBarEl.textContent = '[' + '▓'.repeat(heatFilled) + '░'.repeat(heatBarWidth - heatFilled) + ']';
            heatBarEl.style.display = '';
        } else {
            heatBarEl.style.display = 'none';
        }
    }

    // Heat rate — shows generation while burning, decay while idle. Decay
    // is approximate (heat * decayRate is the instantaneous derivative of
    // the exponential decay used in processFurnace).
    const heatRateEl = document.getElementById('engine-heat-rate');
    if (heatRateEl) {
        if (game.furnace.fuel > 0) {
            const heatRate = 10 * game.bonuses.furnaceEfficiency * game.bonuses.heatMultiplier * getWisdomMultiplier() *
                (1 + (game.automation.amplifiers || 0) * 0.5 * game.bonuses.automationEfficiency);
            heatRateEl.textContent = `+${formatRate(heatRate)}/s`;
            heatRateEl.classList.remove('decaying');
        } else {
            const decayRate = game.bonuses.heatDecayRate || 0;
            const passiveGen = game.bonuses.heatPassiveGen || 0;
            const decayPerSec = decayRate > 0 && game.resources.heat > 0
                ? Math.max(decayRate * game.resources.heat, MIN_HEAT_DECAY_PER_SEC)
                : 0;
            const netRate = passiveGen - decayPerSec;
            if (netRate > 0.005) {
                heatRateEl.textContent = `+${formatRate(netRate)}/s`;
                heatRateEl.classList.remove('decaying');
            } else if (decayPerSec > 0.005) {
                heatRateEl.textContent = `-${formatRate(decayPerSec)}/s`;
                heatRateEl.classList.add('decaying');
            } else {
                heatRateEl.textContent = `+0/s`;
                heatRateEl.classList.remove('decaying');
            }
        }
    }

    // Furnace
    const fuelNow = Math.max(0, game.furnace.fuel);
    const fuelCap = Math.max(1, game.bonuses.furnaceCapacity);
    document.getElementById('furnace-fuel').textContent = formatNumber(Math.floor(fuelNow));
    document.getElementById('furnace-fuel-max').textContent = formatNumber(Math.floor(fuelCap));
    const fuelBarWidth = 14;
    const fuelFilled = Math.min(fuelBarWidth, Math.floor((fuelNow / fuelCap) * fuelBarWidth));
    document.getElementById('furnace-fuel-bar').textContent =
        '[' + '▓'.repeat(fuelFilled) + '░'.repeat(fuelBarWidth - fuelFilled) + ']';
    const fuelTimeEl = document.getElementById('furnace-fuel-time');
    if (fuelNow <= 0) {
        fuelTimeEl.textContent = 'idle';
    } else {
        const secs = Math.ceil(fuelNow);
        let label;
        if (secs < 60) label = `${secs}s left`;
        else if (secs < 3600) label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} left`;
        else label = `${Math.floor(secs / 3600)}h ${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}m left`;
        fuelTimeEl.textContent = label;
    }
    document.getElementById('furnace-temp').textContent = `${Math.max(0, Math.floor(game.furnace.temperature))}*`;

    // First-spark prompt: a twinkling glyph appears inside the engine the
    // moment Phase 1 ends, drawing the eye to the engine so the player
    // knows to press-and-hold for their first spark. Vanishes for good
    // once any spark is successfully drawn.
    const enginePromptEl = document.getElementById('engine-prompt');
    if (enginePromptEl) {
        const showPrompt = (game.stats.peakHeat || 0) >= PHASE_1_HEAT_TARGET
            && !game.stats.firstEngineSpark;
        enginePromptEl.classList.toggle('hidden', !showPrompt);
    }

    // Furnace ASCII animation — art changes with temperature.
    const furnaceAscii = document.getElementById('furnace-ascii');
    // Helper for the bare engine art. When `glowCore` is true, the
    // inner-face characters (eyes, mouth-grate) are wrapped in
    // .ember-core spans so CSS can colour and pulse them — this is
    // how the "still-warm engine" beat is rendered.
    function renderBareEngineAscii(target, glowCore) {
        target.textContent = '';
        // Each entry: [pre-text, optional glow-text, post-text]. When
        // glowCore is true, glow-text becomes a span; otherwise it's
        // appended as plain text.
        const lines = [
            ['\n    _______', '', ''],
            ['\n   /       \\', '', ''],
            ['\n  |  ', '.   .', '  |'],
            ['\n  |    ', '_', '    |'],
            ['\n  |  ', "'---'", '  |'],
            ['\n  |_________|', '', ''],
            ['\n /___________\\', '', ''],
            ['\n|_____________|', '', '']
        ];
        for (const [pre, glow, post] of lines) {
            target.appendChild(document.createTextNode(pre));
            if (glow) {
                if (glowCore) {
                    const span = document.createElement('span');
                    span.className = 'ember-core';
                    span.textContent = glow;
                    target.appendChild(span);
                } else {
                    target.appendChild(document.createTextNode(glow));
                }
            }
            if (post) target.appendChild(document.createTextNode(post));
        }
    }
    if (furnaceAscii) {
        const burning = game.furnace.fuel > 0;
        const temp = game.furnace.temperature;
        const cold = !burning && temp < 1 && game.stats.totalHeat === 0;
        const hasResidualHeat = !burning && (game.resources.heat || 0) > 0;
        furnaceAscii.classList.toggle('burning', burning);
        furnaceAscii.classList.toggle('cold', cold);
        furnaceAscii.classList.toggle('roaring', temp >= 400);

        const t = Math.floor(Date.now() / 180);
        if (burning && temp >= 400) {
            // Roaring inferno
            const a = ['*^*^*', '^*^*^', '*^^*^', '^*^^*'][t % 4];
            const b = ['^^^^^', '*^*^*', '^*^*^', '^^*^^'][t % 4];
            furnaceAscii.textContent = `
    _______
   /  ${a}  \\
  |  ${b}  |
  |  ${a}  |
  |  \\_|_/  |
  |_________|
 /___________\\
|_____________|`;
        } else if (burning && temp >= 100) {
            // Steady burn
            const a = ['  ^  ', ' ^^^ ', '^^^^^'][t % 3];
            const b = [' ^^^ ', '^^^^^', '  ^  '][t % 3];
            furnaceAscii.textContent = `
    _______
   /       \\
  |  ${a}  |
  |  ${b}  |
  |  '---'  |
  |_________|
 /___________\\
|_____________|`;
        } else if (burning) {
            // Faint warmth
            const a = ['  .  ', ' . . ', '  .  '][t % 3];
            furnaceAscii.textContent = `
    _______
   /       \\
  |  ${a}  |
  |    _    |
  |  '---'  |
  |_________|
 /___________\\
|_____________|`;
        } else {
            // Cold or warm-but-no-fuel. If the player still has heat
            // banked, the inner face (eyes, mouth) lights up with the
            // ember glow via wrapper spans; otherwise it's plain ASCII.
            renderBareEngineAscii(furnaceAscii, hasResidualHeat);
        }
    }

    // Smelter
    if (game.unlockedTiers.smelter) {
        document.getElementById('smelter-ore').textContent = formatNumber(Math.max(0, Math.floor(game.smelter.ore)));
        document.getElementById('smelter-progress').textContent = Math.max(0, Math.floor(game.smelter.progress));

        // ASCII progress bar (matches fuel meter style — 14-char ▓░)
        const progressBar = document.getElementById('smelter-progress-bar');
        if (progressBar) {
            const barWidth = 14;
            const filled = Math.min(barWidth, Math.floor((game.smelter.progress / 100) * barWidth));
            progressBar.textContent = '▓'.repeat(filled) + '░'.repeat(barWidth - filled);
        }

        // Smelter ASCII animation
        const smelterAscii = document.getElementById('smelter-ascii');
        if (smelterAscii && game.smelter.ore > 0 && game.furnace.temperature >= 100) {
            smelterAscii.classList.add('active');
            const frame = Math.floor(Date.now() / 300) % 2;
            const waves = frame === 0 ? '~~~' : '~^~';
            smelterAscii.textContent = `
   .---.
  /     \\
 |  ${waves}  |
 |  ${waves}  |
  \\_____/
  |_____|`;
        } else if (smelterAscii) {
            smelterAscii.classList.remove('active');
        }
    }

    // Forge
    if (game.unlockedTiers.forge) {
        document.getElementById('forge-count').textContent = game.forge.count;
        document.getElementById('craft-alloy').disabled = game.resources.metal < 5;
    }

    // Workshop
    if (game.unlockedTiers.workshop) {
        document.getElementById('craft-gear').disabled = game.resources.alloy < 3;
        document.getElementById('craft-auto-sparker').disabled = game.resources.gears < 10;
        document.getElementById('craft-auto-miner').disabled = game.resources.gears < 25;
        document.getElementById('craft-heat-amplifier').disabled = game.resources.gears < 50;

        document.getElementById('auto-sparker-count').textContent = game.automation.sparkers;
        document.getElementById('auto-miner-count').textContent = game.automation.miners;
        document.getElementById('heat-amplifier-count').textContent = game.automation.amplifiers;
    }

    // Sanctum
    if (game.unlockedTiers.sanctum) {
        const stonesOnReset = getStonesOnReset();
        document.getElementById('stones-on-reset').textContent = stonesOnReset;
        document.getElementById('transmute-btn').disabled = stonesOnReset <= 0;
    }

    // Prestige display
    if (game.philosopherStones > 0 || game.unlockedTiers.sanctum) {
        revealEl(document.getElementById('prestige-display'));
        document.getElementById('philosopher-stones').textContent = game.philosopherStones;
        document.getElementById('wisdom-mult').textContent = getWisdomMultiplier().toFixed(2);
    }

    // Spawn ore button
    const spawnOreBtn = document.getElementById('spawn-ore');
    spawnOreBtn.disabled = game.resources.heat < 10;

    // Spawn fuel (spark) button — costs SPARK_HEAT_COST heat per click.
    const spawnFuelBtn = document.getElementById('spawn-fuel');
    if (spawnFuelBtn) spawnFuelBtn.disabled = game.resources.heat < SPARK_HEAT_COST;

    // Stick counter and feed button
    const stickCountEl = document.getElementById('stick-count');
    if (stickCountEl) stickCountEl.textContent = Math.max(0, game.inventory.sticks || 0);
    const feedStickBtn = document.getElementById('feed-stick-btn');
    if (feedStickBtn) {
        const canFeed = (game.inventory.sticks || 0) > 0 && game.furnace.fuel < game.bonuses.furnaceCapacity;
        feedStickBtn.disabled = !canFeed;
    }

    // Stats
    document.getElementById('stat-total-heat').textContent = formatNumber(Math.floor(game.stats.totalHeat));
    document.getElementById('stat-total-merges').textContent = formatNumber(game.stats.totalMerges);
    document.getElementById('stat-highest-fuel').textContent = game.stats.highestFuelTier;
    document.getElementById('stat-time-played').textContent = formatTime(game.stats.playTime);

    // Show unlocked sections (idempotent; revealEl only animates once)
    if (game.unlockedTiers.smelter) {
        revealEl(document.getElementById('smelter-section'));
        revealEl(document.getElementById('metal-resource'));
        revealEl(document.getElementById('spawn-ore'));
        revealEl(document.querySelector('[data-tab="smelter-upgrades"]'));
    }
    if (game.unlockedTiers.forge) {
        revealEl(document.getElementById('forge-section'));
        revealEl(document.getElementById('alloy-resource'));
        revealEl(document.querySelector('[data-tab="forge-upgrades"]'));
    }
    if (game.unlockedTiers.workshop) {
        revealEl(document.getElementById('workshop-section'));
        revealEl(document.getElementById('gear-resource'));
        revealEl(document.querySelector('[data-tab="workshop-upgrades"]'));
    }
    if (game.unlockedTiers.sanctum) {
        revealEl(document.getElementById('sanctum-section'));
    }
    if (game.unlockedTiers.essence) {
        revealEl(document.getElementById('essence-resource'));
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Stick gather button — always visible. Starts a 3s gather; completion
    // delivers one stick to the resource pool.
    const gatherBtn = document.getElementById('gather-stick-btn');
    if (gatherBtn) gatherBtn.addEventListener('click', startStickGather);
    // Feed-stick: tap = 1 stick. Bulk feed will return as an upgrade.
    const feedBtn = document.getElementById('feed-stick-btn');
    if (feedBtn) feedBtn.addEventListener('click', () => feedStick());

    // Spawn buttons (one tap = one spawn; bulk spawn returns as an upgrade)
    document.getElementById('spawn-fuel').addEventListener('click', () => spawnFuel());
    document.getElementById('spawn-ore').addEventListener('click', () => spawnOre());

const burnAll = document.getElementById('burn-all-btn');
    if (burnAll) burnAll.addEventListener('click', burnAllFuel);
    const smeltAll = document.getElementById('smelt-all-btn');
    if (smeltAll) smeltAll.addEventListener('click', smeltAllOre);

    // Recipe craft button
    const craftBtn = document.getElementById('craft-btn');
    if (craftBtn) craftBtn.addEventListener('click', performCraft);

    // Key Items modal open/close
    const keyItemsBtn   = document.getElementById('key-items-btn');
    const kiModal       = document.getElementById('key-items-modal');
    const kiModalClose  = document.getElementById('key-items-close');
    if (keyItemsBtn && kiModal) {
        keyItemsBtn.addEventListener('click', () => {
            renderKeyItemsModal();
            kiModal.classList.remove('ki-modal--hidden');
        });
    }
    if (kiModalClose && kiModal) {
        kiModalClose.addEventListener('click', () => kiModal.classList.add('ki-modal--hidden'));
        kiModal.addEventListener('click', e => {
            if (e.target === kiModal) kiModal.classList.add('ki-modal--hidden');
        });
    }

    // Furnace drop zone
    setupFurnaceDropZone();
    setupSmelterDropZone();
    setupUnlockSlots();

    // Engine as a drag SOURCE: drag a Spark out of the furnace onto the grid.
    // Bound to #furnace-ascii (the small ASCII pre) rather than the whole
    // #furnace-visual container so users can still scroll/tap on the temp
    // badge and fuel readout without accidentally initiating a drag.
    // Visual feedback (border highlight, pulse) is applied to the parent
    // visual via CSS for a larger, more visible cue.
    const furnaceAscii = document.getElementById('furnace-ascii');
    if (furnaceAscii) {
        furnaceAscii.setAttribute('draggable', 'true');
        furnaceAscii.addEventListener('dragstart', handleEngineDragStart);
        furnaceAscii.addEventListener('dragend', handleEngineDragEnd);
        furnaceAscii.addEventListener('touchstart', handleEngineTouchStart, { passive: false });
    }

    // Crafting buttons
    document.getElementById('craft-alloy').addEventListener('click', craftAlloy);
    document.getElementById('craft-gear').addEventListener('click', craftGear);
    document.getElementById('craft-auto-sparker').addEventListener('click', craftAutoSparker);
    document.getElementById('craft-auto-miner').addEventListener('click', craftAutoMiner);
    document.getElementById('craft-heat-amplifier').addEventListener('click', craftHeatAmplifier);

    // Prestige
    document.getElementById('transmute-btn').addEventListener('click', prestige);

    // Upgrade tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.upgrade-panel').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    // Save: auto-save runs every 30s and on visibilitychange (page hidden /
    // app backgrounded). The manual SAVE button was removed since it added
    // noise to the footer without protecting against any case the
    // auto-save doesn't already cover.
    document.getElementById('export-btn').addEventListener('click', exportGame);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-modal').classList.remove('hidden');
    });

    document.getElementById('import-confirm').addEventListener('click', importGame);
    document.getElementById('import-cancel').addEventListener('click', () => {
        document.getElementById('import-modal').classList.add('hidden');
    });

    document.getElementById('export-copy').addEventListener('click', copyExportedSave);
    document.getElementById('export-close').addEventListener('click', () => {
        document.getElementById('export-modal').classList.add('hidden');
    });

    document.getElementById('reset-btn').addEventListener('click', hardReset);

    // Settings modal — persistent corner button, always visible
    try {
        _audioEnabled = localStorage.getItem('alchemistsEngine.mute') !== '1';
        const savedVol = parseFloat(localStorage.getItem('alchemistsEngine.volume'));
        if (!isNaN(savedVol)) _volume = Math.max(0, Math.min(1, savedVol));
        _narrationsEnabled = localStorage.getItem('alchemistsEngine.narrations') !== '0';
    } catch (e) {}

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeDisplay = document.getElementById('volume-display');
    const soundToggle = document.getElementById('sound-toggle');
    const narrationToggle = document.getElementById('narration-toggle');
    const settingsClose = document.getElementById('settings-close');
    const narrationEl = document.getElementById('narration');

    function applyNarrationVisibility() {
        if (!narrationEl) return;
        narrationEl.classList.toggle('narration-hidden', !_narrationsEnabled);
    }
    applyNarrationVisibility();

    function refreshSettingsUI() {
        const pct = Math.round(_volume * 100);
        if (volumeSlider) volumeSlider.value = pct;
        if (volumeDisplay) volumeDisplay.textContent = `${pct}%`;
        if (soundToggle) soundToggle.textContent = _audioEnabled ? '[ON]' : '[OFF]';
        if (narrationToggle) narrationToggle.textContent = _narrationsEnabled ? '[ON]' : '[OFF]';
    }
    refreshSettingsUI();

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            refreshSettingsUI();
            settingsModal.classList.remove('hidden');
        });
    }
    if (settingsClose && settingsModal) {
        settingsClose.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }
    if (volumeSlider) {
        volumeSlider.addEventListener('input', () => {
            _volume = Math.max(0, Math.min(1, parseInt(volumeSlider.value, 10) / 100));
            if (volumeDisplay) volumeDisplay.textContent = `${Math.round(_volume * 100)}%`;
            try { localStorage.setItem('alchemistsEngine.volume', String(_volume)); } catch (e) {}
        });
        volumeSlider.addEventListener('change', () => {
            if (_audioEnabled && _volume > 0) sfx('kindle');
        });
    }
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            _audioEnabled = !_audioEnabled;
            soundToggle.textContent = _audioEnabled ? '[ON]' : '[OFF]';
            try { localStorage.setItem('alchemistsEngine.mute', _audioEnabled ? '0' : '1'); } catch (e) {}
            if (_audioEnabled) sfx('kindle');
        });
    }
    if (narrationToggle) {
        narrationToggle.addEventListener('click', () => {
            _narrationsEnabled = !_narrationsEnabled;
            narrationToggle.textContent = _narrationsEnabled ? '[ON]' : '[OFF]';
            try { localStorage.setItem('alchemistsEngine.narrations', _narrationsEnabled ? '1' : '0'); } catch (e) {}
            applyNarrationVisibility();
        });
    }

    // Phase 2 awakening modal — close button.
    const phase2Dismiss = document.getElementById('phase2-dismiss');
    if (phase2Dismiss) {
        phase2Dismiss.addEventListener('click', () => {
            const modal = document.getElementById('phase2-modal');
            if (modal) modal.classList.add('hidden');
        });
    }

    // Dead Grove: teaser card opens the fullscreen scene; [X] closes.
    // We lock body scroll while the modal is open so the page underneath
    // can't bleed-scroll on touch (iOS rubber-band especially); the
    // pre-modal overflow + scroll position are saved and restored on
    // close so the player lands back where they were.
    const groveEnter = document.getElementById('grove-enter');
    const groveLeave = document.getElementById('grove-leave');
    const groveModal = document.getElementById('grove-modal');
    let groveSavedScrollY = 0;
    function lockBodyScroll() {
        groveSavedScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${groveSavedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
    }
    function unlockBodyScroll() {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, groveSavedScrollY);
    }
    if (groveEnter && groveModal) {
        groveEnter.addEventListener('click', () => {
            groveModal.classList.remove('hidden');
            lockBodyScroll();
            renderGrove();
        });
    }
    if (groveLeave && groveModal) {
        groveLeave.addEventListener('click', () => {
            groveModal.classList.add('hidden');
            unlockBodyScroll();
        });
    }

    // Window resize → re-fit grove rows. Cheap, only acts when the
    // grove modal is open (autofitGroveScene bails otherwise).
    // No debounce — autofit is just a measure-and-set, fast enough
    // for native resize cadence.
    window.addEventListener('resize', autofitGroveScene);
    // Orientation change on phones often fires resize, but some
    // browsers don't fire resize on rotate — listen separately.
    window.addEventListener('orientationchange', () => {
        // Defer to next frame; rotation triggers layout shifts that
        // settle a few frames later.
        requestAnimationFrame(() => requestAnimationFrame(autofitGroveScene));
    });

    // Intro modal — first-load awakening beat. Honors the Story Prompts
    // toggle: if the player has narrations off, the intro is silently
    // marked seen so it doesn't ambush them on a future re-enable.
    const introModal = document.getElementById('intro-modal');
    const introDismiss = document.getElementById('intro-dismiss');
    if (introModal && introDismiss) {
        introDismiss.addEventListener('click', () => {
            introModal.classList.add('hidden');
            game.introSeen = true;
            saveGame();
        });
        if (!game.introSeen) {
            if (_narrationsEnabled) {
                introModal.classList.remove('hidden');
            } else {
                game.introSeen = true;
                saveGame();
            }
        }
    }

    // Resume audio context on first user gesture (browser autoplay policy)
    const unlockAudio = () => {
        const ctx = getAudioCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
        document.removeEventListener('touchend', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    document.addEventListener('touchend', unlockAudio);

    // Block iOS double-tap zoom on inert page surfaces only. touch-action:
    // manipulation handles buttons and grid cells; calling preventDefault
    // on touchend would cancel the synthetic click that follows, eating
    // every other rapid tap on actionable controls. Only block here when
    // the touch lands somewhere that *wouldn't* otherwise dispatch a
    // useful click — i.e. background chrome, decorative ASCII, etc.
    let lastTouchEnd = 0;
    const INTERACTIVE_SELECTOR = 'button, a, textarea, input, select, label, .grid-cell, .drop-zone, .resource, [role="button"]';
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 350) {
            if (!e.target.closest(INTERACTIVE_SELECTOR)) {
                e.preventDefault();
            }
        }
        lastTouchEnd = now;
    }, { passive: false });

    // Suppress iOS long-press context menu on the game surface
    document.addEventListener('contextmenu', (e) => {
        // Our own right-click handlers (quickSendItem) call preventDefault
        // themselves, so this only affects long-press on non-item surfaces.
        if (e.target.closest('.fuel-item, .ore-item')) return;
        if (e.target.closest('textarea, input')) return;
        e.preventDefault();
    });

    // Prevent browser gesturestart zoom (Safari)
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    // Best-effort portrait lock. Only works in fullscreen/PWA contexts and on
    // Android; silently no-ops on iOS Safari browsing. CSS #rotate-hint is
    // the universal fallback for unsupported environments.
    tryLockPortrait();
    window.addEventListener('orientationchange', tryLockPortrait);
}

function tryLockPortrait() {
    try {
        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('portrait').catch(() => {});
        }
    } catch (e) { /* unsupported — rotate-hint overlay handles it */ }
}

// ============================================
// SAVE/LOAD
// ============================================

let _resetting = false;

function saveGame() {
    if (_resetting) return;
    localStorage.setItem('alchemistsEngine', JSON.stringify(game));
}

function loadGame() {
    const saved = localStorage.getItem('alchemistsEngine');
    if (saved) {
        try {
            const loaded = JSON.parse(saved);
            // Merge with defaults to handle new properties
            game = { ...JSON.parse(JSON.stringify(defaultGame)), ...loaded };
            game.resources = { ...defaultGame.resources, ...loaded.resources };
            game.bonuses = { ...defaultGame.bonuses, ...loaded.bonuses };
            game.stats = { ...defaultGame.stats, ...loaded.stats };
            game.unlockedTiers = { ...defaultGame.unlockedTiers, ...loaded.unlockedTiers };
            game.automation = { ...defaultGame.automation, ...loaded.automation };
            // Migration: ensure every automation counter is a finite number.
            // An undefined or NaN value here propagates into the heat
            // calc as NaN (e.g. `undefined * 0.5 === NaN`) and corrupts
            // game.resources.heat permanently because `NaN += anything`
            // stays NaN and `NaN > 0` is false (so decay can't rescue it).
            // See cowork ticket 0060.
            for (const k of Object.keys(defaultGame.automation)) {
                if (typeof game.automation[k] !== 'number' || !Number.isFinite(game.automation[k])) {
                    game.automation[k] = defaultGame.automation[k];
                }
            }
            game.inventory = { ...defaultGame.inventory, ...(loaded.inventory || {}) };
            game.satchel = Array.isArray(loaded.satchel) ? loaded.satchel : [];
            game.keyItems = Array.isArray(loaded.keyItems) ? loaded.keyItems : [];
            game.flags = { ...defaultGame.flags, ...(loaded.flags || {}) };
            game.flags.discoveredRecipes = { ...defaultGame.flags.discoveredRecipes, ...(loaded.flags?.discoveredRecipes || {}) };
            game.revealed = loaded.revealed || {};

            // Migration: sticks/stones moved from game.resources to game.inventory.
            // Take the max in case a partially-migrated save has both.
            const legacySticks = (loaded.resources && typeof loaded.resources.sticks === 'number') ? loaded.resources.sticks : 0;
            const legacyStones = (loaded.resources && typeof loaded.resources.stones === 'number') ? loaded.resources.stones : 0;
            game.inventory.sticks = Math.max(game.inventory.sticks || 0, legacySticks);
            game.inventory.stones = Math.max(game.inventory.stones || 0, legacyStones);
            // Zero out legacy fields if they leaked through the resources merge.
            if ('sticks' in game.resources) delete game.resources.sticks;
            if ('stones' in game.resources) delete game.resources.stones;

            // Migration: if save predates the reveal system but the player
            // already has progress, mark all applicable stages as revealed
            // so they don't get bombarded with narration on load.
            if (Object.keys(game.revealed).length === 0) {
                for (const stage of REVEAL_STAGES) {
                    if (stage.cond(game)) game.revealed[stage.id] = true;
                }
            }

            // Migration: existing players who've already started shouldn't see
            // the intro modal again. Any sign of progress means they've passed
            // the awakening. Only a truly fresh save (or a Clear → reload)
            // should trigger it.
            if (!game.introSeen && (
                (game.stats.totalHeat || 0) > 0 ||
                (game.stats.sticksGathered || 0) > 0 ||
                (game.stats.kindlingAdded || 0) > 0
            )) {
                game.introSeen = true;
            }

            // Migration: peakHeat is a new stat. Anyone past the merge-grid
            // reveal has effectively cleared Phase 1 already, so seed it to
            // the target so they don't see the soot UI.
            if ((game.stats.peakHeat || 0) < PHASE_1_HEAT_TARGET && game.revealed.mergeGrid) {
                game.stats.peakHeat = PHASE_1_HEAT_TARGET;
            }

            // Migration: firstEngineSpark is a new stat. Players already
            // past Phase 1 don't need the tutorial twinkle.
            if (!game.stats.firstEngineSpark && game.revealed.mergeGrid) {
                game.stats.firstEngineSpark = true;
            }

            // Migration: locations is a new field. If missing, seed with
            // a fresh Dead Grove so old saves get the trial location.
            if (!game.locations) {
                game.locations = JSON.parse(JSON.stringify(defaultGame.locations));
            }
            // Migration: the trial grove used to count by type. Convert
            // any old format to the new collected-id list.
            if (game.locations.grove && !Array.isArray(game.locations.grove.collected)) {
                game.locations.grove = { collected: [] };
            }
            // Migration: the grove scene was redesigned with a new
            // item layout (different $ count and ordering). Old
            // collected indices no longer point at the same items, so
            // reset on saves that predate the new layout. groveLayoutV
            // is bumped whenever GROVE_ITEM_ROWS changes.
            const GROVE_LAYOUT_V = 3;
            if ((game.locations.grove.layoutV || 1) < GROVE_LAYOUT_V) {
                game.locations.grove.collected = [];
                game.locations.grove.layoutV = GROVE_LAYOUT_V;
            }

            // Re-apply upgrades
            const purchasedUpgrades = [...game.upgrades];
            game.upgrades = [];
            game.bonuses = { ...defaultGame.bonuses };

            for (const upgradeId of purchasedUpgrades) {
                for (const category of Object.values(UPGRADES)) {
                    const upgrade = category.find(u => u.id === upgradeId);
                    if (upgrade) {
                        game.upgrades.push(upgradeId);
                        upgrade.effect();
                    }
                }
            }

            // One-time NaN scrub: rescue saves that already have NaN
            // propagated into resources or furnace state from the
            // pre-fix amplifier bug (ticket 0060). Without this, the
            // guard above prevents new corruption but existing saves
            // stay broken because NaN is sticky through arithmetic.
            for (const k of Object.keys(game.resources)) {
                if (typeof game.resources[k] !== 'number' || !Number.isFinite(game.resources[k])) {
                    game.resources[k] = 0;
                } else if (game.resources[k] < 0) {
                    // Negative resources can't arise in normal play; treat as
                    // corruption (save edit, console injection, future bug)
                    // and clamp on load so the UI and downstream math start
                    // from a clean floor.
                    game.resources[k] = 0;
                }
            }
            if (game.inventory && typeof game.inventory === 'object') {
                for (const k of Object.keys(game.inventory)) {
                    if (typeof game.inventory[k] === 'number'
                        && (!Number.isFinite(game.inventory[k]) || game.inventory[k] < 0)) {
                        game.inventory[k] = 0;
                    }
                }
            }
            if (typeof game.furnace.fuel !== 'number' || !Number.isFinite(game.furnace.fuel) || game.furnace.fuel < 0) {
                game.furnace.fuel = 0;
            }
            if (typeof game.furnace.temperature !== 'number' || !Number.isFinite(game.furnace.temperature) || game.furnace.temperature < 0) {
                game.furnace.temperature = 0;
            }

            game.lastUpdate = Date.now();
        } catch (e) {
            console.error('Failed to load save:', e);
        }
    }
}

// Save code format version. Bump when the game shape changes in a way that
// requires migration. Older codes are still accepted for backward compat.
const SAVE_VERSION = 1;

function buildSavePayload() {
    const envelope = { v: SAVE_VERSION, ts: Date.now(), game: game };
    return btoa(unescape(encodeURIComponent(JSON.stringify(envelope))));
}

function parseSavePayload(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    let text;
    try { text = decodeURIComponent(escape(atob(trimmed))); }
    catch (e) {
        try { text = atob(trimmed); }
        catch (err) { return null; }
    }

    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return null; }

    if (parsed && typeof parsed.v === 'number' && parsed.game) {
        return { version: parsed.v, game: migrateSave(parsed.game, parsed.v) };
    }
    if (parsed && typeof parsed.resources === 'object') {
        return { version: 0, game: parsed };
    }
    return null;
}

function migrateSave(g, fromVersion) {
    // No migrations yet. When the save shape changes, add steps like:
    //   if (fromVersion < 2) { g.newField = default; }
    return g;
}

function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
}

function renderQrFallback(container, message) {
    clearChildren(container);
    const div = document.createElement('div');
    div.className = 'export-qr-fallback';
    div.textContent = message;
    container.appendChild(div);
}

function renderQrInto(container, svgString) {
    clearChildren(container);
    // Parse SVG string via DOMParser — safe: string is built by our own
    // generator from a fixed template, no user-controlled HTML.
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg && svg.nodeName.toLowerCase() === 'svg') {
        container.appendChild(document.importNode(svg, true));
    } else {
        renderQrFallback(container, 'QR rendering failed.');
    }
}

function exportGame() {
    const saveData = buildSavePayload();
    const modal = document.getElementById('export-modal');
    const textarea = document.getElementById('export-textarea');
    const qrContainer = document.getElementById('export-qr');

    textarea.value = saveData;

    if (window.QR) {
        const qr = window.QR.generate(saveData);
        if (qr) {
            renderQrInto(qrContainer, window.QR.toSvg(qr, 4, 4));
        } else {
            renderQrFallback(qrContainer, 'Save too large for QR — use [COPY CODE] instead.');
        }
    } else {
        renderQrFallback(qrContainer, 'QR generator unavailable.');
    }

    modal.classList.remove('hidden');
    setTimeout(() => textarea.select(), 0);
}

function copyExportedSave() {
    const textarea = document.getElementById('export-textarea');
    const saveData = textarea.value;
    const done = () => showToast('Save code copied!', 'success');
    const fallback = () => {
        textarea.select();
        try { document.execCommand('copy'); done(); }
        catch (e) { showToast('Copy failed — select and copy manually.', 'error'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(saveData).then(done).catch(fallback);
    } else {
        fallback();
    }
}

function importGame() {
    const textarea = document.getElementById('import-textarea');
    const result = parseSavePayload(textarea.value);

    if (!result) {
        showToast('Invalid save code!', 'error');
        return;
    }

    const decoded = result.game;

    try {
        game = { ...JSON.parse(JSON.stringify(defaultGame)), ...decoded };
        game.resources = { ...defaultGame.resources, ...decoded.resources };
        game.bonuses = { ...defaultGame.bonuses };
        game.stats = { ...defaultGame.stats, ...decoded.stats };
        game.unlockedTiers = { ...defaultGame.unlockedTiers, ...decoded.unlockedTiers };
        game.automation = { ...defaultGame.automation, ...decoded.automation };

        // Re-apply upgrades
        const purchasedUpgrades = [...game.upgrades];
        game.upgrades = [];

        for (const upgradeId of purchasedUpgrades) {
            for (const category of Object.values(UPGRADES)) {
                const upgrade = category.find(u => u.id === upgradeId);
                if (upgrade) {
                    game.upgrades.push(upgradeId);
                    upgrade.effect();
                }
            }
        }

        game.lastUpdate = Date.now();

        createGrid();
        renderUpgrades();
        renderAchievements();
        updateUI();
        saveGame();

        document.getElementById('import-modal').classList.add('hidden');
        textarea.value = '';
        showToast('Save imported!', 'success');
    } catch (e) {
        showToast('Invalid save data!', 'error');
    }
}

function hardReset() {
    if (!confirm('Are you sure you want to reset ALL progress? This cannot be undone!')) {
        return;
    }
    if (!confirm('Really? Everything will be lost, including Philosopher\'s Stones!')) {
        return;
    }

    // Block any save attempts that fire during the unload window — pagehide
    // and visibilitychange both call saveGame and would otherwise re-write
    // the state we just cleared.
    _resetting = true;
    stopLoops();
    localStorage.removeItem('alchemistsEngine');
    // Reloading is the simplest way to restore the pristine progressive-reveal state.
    location.reload();
}

// ============================================
// UTILITIES
// ============================================

function formatNumber(n) {
    if (n < 1000) return Math.floor(n).toString();
    if (n < 1000000) return (n / 1000).toFixed(1) + 'K';
    if (n < 1000000000) return (n / 1000000).toFixed(2) + 'M';
    if (n < 1000000000000) return (n / 1000000000).toFixed(2) + 'B';
    return (n / 1000000000000).toFixed(2) + 'T';
}

// Display variant for per-second rates. formatNumber floors integers
// (so a real 0.25/s decay would render as "0/s" — misleading early-game).
// formatRate keeps decimals for small magnitudes and trims trailing
// zeros / decimal points so readouts stay clean.
function formatRate(n) {
    if (n >= 1000) return formatNumber(n);
    if (n >= 10)   return Math.round(n).toString();
    if (n >= 1)    return n.toFixed(1).replace(/\.0$/, '');
    return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// START GAME
// ============================================

document.addEventListener('DOMContentLoaded', init);

// PWA: register the service worker so the game works offline and can be
// installed from the browser. Runs on http(s) only — file:// and srcdoc
// contexts skip silently.
//
// updateViaCache: 'none' tells the browser to never serve the
// service-worker.js file from HTTP cache, so each page load picks up new
// SW versions immediately. Combined with the post-activate sw-updated
// message below, deploys propagate to existing tabs in a single reload.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' }).catch(() => {
            // Offline capability is a bonus, not required. Ignore failures.
        });
    });
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'sw-updated') {
            // New SW activated — capture state, then reload onto fresh shell.
            try { saveGame(); } catch (_) {}
            location.reload();
        }
    });
}

// Force refresh button next to the version tag. Saves the game, wipes
// every SW cache, prods the SW for a new version, then reloads — bypasses
// any stuck cache state so the player always has a way to see the latest
// build without diving into devtools.
async function forceRefresh() {
    try { saveGame(); } catch (_) {}
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if (navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
        }
    } catch (_) { /* fall through and reload regardless */ }
    location.reload();
}
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', forceRefresh);
});
