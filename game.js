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

// Keep this in sync with `CACHE` in service-worker.js. Rendered into the
// version tag at the bottom of the page so a stale build is easy to spot.
const APP_VERSION = 'v20';

const UPGRADES = {
    furnace: [
        { id: 'stickBundle',    name: 'Stick Bundle',    desc: 'Gather 2 sticks per click',         cost: 10,  costType: 'sticks', effect: () => { game.bonuses.sticksPerGather = Math.max(game.bonuses.sticksPerGather, 2); } },
        { id: 'whittlingKnife', name: 'Whittling Knife', desc: 'Gather sticks 25% faster',          cost: 40,  costType: 'sticks', requires: 'stickBundle', effect: () => { game.bonuses.stickGatherSpeed = 1.25; } },
        { id: 'stickCache',     name: 'Stick Cache',     desc: 'Gather 3 sticks per click',         cost: 200, costType: 'sticks', requires: 'stickBundle', effect: () => { game.bonuses.sticksPerGather = Math.max(game.bonuses.sticksPerGather, 3); } },
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
    { id: 'heatMeter',     cond: g => g.stats.totalHeat >= 1,      narrate: 'A faint warmth rises from the iron.',         targets: ['#resources', '#heat-resource', '#furnace-temp'] },
    { id: 'furnaceStats',  cond: g => g.stats.totalHeat >= 8,      narrate: 'You begin to notice the rhythm of the burn.', targets: ['#fuel-readout'] },
    { id: 'upgrades',      cond: g => g.stats.kindlingAdded >= 3,  narrate: 'The engine responds to your attention. Tools take shape.', targets: ['#upgrades-section'] },
    { id: 'mergeGrid',     cond: g => g.stats.kindlingAdded >= 20,
        narrate: 'The engine has tasted enough kindling. It shows you what more it can do.',
        targets: ['#merge-section', '#burn-all-btn'],
        onReveal: () => {
            hideIntroControls();
            showFurnaceDrop();
            // Seed two Sparks so the merge mechanic is obvious
            spawnItem('fuel', false);
            spawnItem('fuel', false);
        } },
    // Achievements stage intentionally omitted while the achievements UI is
    // disabled (see SHOW_ACHIEVEMENTS_UI). Re-add to surface the section.
    { id: 'stats',         cond: g => g.stats.totalHeat >= 150,    narrate: 'Numbers accrue. The work leaves a trace.',    targets: ['#stats-section'] },
    { id: 'save',          cond: g => g.stats.totalHeat >= 200,    narrate: 'You find a way to etch this moment.',         targets: ['footer', '#save-btn'] },
    { id: 'reset',         cond: g => g.unlockedTiers.forge,       targets: ['#settings-savedata', '#export-btn', '#import-btn'] }
];

const defaultGame = {
    resources: {
        heat: 0,
        metal: 0,
        alloy: 0,
        gears: 0,
        essence: 0,
        sticks: 0
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
        stickGatherSpeed: 1
    },
    stats: {
        totalHeat: 0,
        totalMerges: 0,
        highestFuelTier: 1,
        startTime: Date.now(),
        playTime: 0,
        kindlingAdded: 0,
        sticksGathered: 0
    },
    philosopherStones: 0,
    prestigeCount: 0,
    introSeen: false,
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
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.textContent = APP_VERSION;
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
}

function renderGridItem(index) {
    const cell = document.querySelector(`.grid-cell[data-index="${index}"]`);
    if (!cell) return;

    cell.innerHTML = '';
    const item = game.grid[index];

    if (!item) return;

    const itemEl = document.createElement('div');
    itemEl.className = `${item.type}-item ${item.type === 'fuel' ? FUEL_TIERS[item.tier - 1].color : ORE_TIERS[item.tier - 1].color}`;
    itemEl.draggable = true;
    itemEl.dataset.index = index;
    itemEl.dataset.type = item.type;
    itemEl.dataset.tier = item.tier;

    const tierLabel = document.createElement('span');
    tierLabel.className = 'item-tier-label';
    tierLabel.textContent = item.type === 'fuel' ? FUEL_TIERS[item.tier - 1].name : ORE_TIERS[item.tier - 1].name;
    itemEl.appendChild(tierLabel);

    // Drag events (desktop HTML5 drag API)
    itemEl.addEventListener('dragstart', handleDragStart);
    itemEl.addEventListener('dragend', handleDragEnd);

    // Touch-based drag for mobile (parallels desktop drag)
    itemEl.addEventListener('touchstart', handleTouchStart, { passive: false });

    // Quick-send: double-click sends fuel to furnace, ore to smelter
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

    // Tooltip for clarity
    itemEl.title = item.type === 'fuel'
        ? `${FUEL_TIERS[item.tier - 1].name} (${FUEL_TIERS[item.tier - 1].value} fuel) — dbl-click or right-click to burn`
        : `${ORE_TIERS[item.tier - 1].name} (${ORE_TIERS[item.tier - 1].value} ore) — dbl-click or right-click to smelt`;
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
        flashDropZone('furnace-fuel-slot');
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
        flashDropZone('furnace-fuel-slot');
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
    draggedIndex = parseInt(e.target.dataset.index);
    draggedItem = game.grid[draggedIndex];
    draggedElement = e.target;

    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex);

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
    if (!canDragSparkFromEngine()) {
        e.preventDefault();
        return;
    }
    draggedItem = { type: 'fuel', tier: 1, fromEngine: true };
    draggedIndex = -1;
    draggedElement = e.currentTarget;
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', 'engine-spark');
    }
    // Highlight tier-1 fuel on the grid as merge targets
    game.grid.forEach((cell, i) => {
        if (cell && cell.type === 'fuel' && cell.tier === 1) {
            const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
            if (el) el.classList.add('merge-target');
        }
    });
}

function handleEngineDragEnd() {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.merge-target').forEach(el => el.classList.remove('merge-target'));
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
        updateUI();
        return;
    }

    // Mismatched cell — fail gracefully
    showToast('Drop on an empty cell or another Spark.', 'error');
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

    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const targetItem = game.grid[targetIndex];

    // Check if we can merge
    if (targetItem &&
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

function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    const itemEl = e.currentTarget;
    const index = parseInt(itemEl.dataset.index);
    const item = game.grid[index];
    if (!item) return;

    // Defer drag initiation: if the user taps quickly, dblclick/contextmenu
    // handlers still fire. Only start the drag once they actually move.
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

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

function beginTouchDrag() {
    if (!touchDragState || touchDragState.moved) return;
    const { itemEl, index, item } = touchDragState;
    const fromEngine = !!item.fromEngine;

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

    // Highlight merge targets
    if (fromEngine) {
        // Only tier-1 sparks accept an engine-spark for a merge
        game.grid.forEach((cell, i) => {
            if (cell && cell.type === 'fuel' && cell.tier === 1) {
                const el = document.querySelector(`.grid-cell[data-index="${i}"]`);
                if (el) el.classList.add('merge-target');
            }
        });
    } else {
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
function handleEngineTouchStart(e) {
    if (!canDragSparkFromEngine()) return;
    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    touchDragState = {
        itemEl: e.currentTarget,
        index: -1,
        item: { type: 'fuel', tier: 1, fromEngine: true },
        startX: t.clientX,
        startY: t.clientY,
        moved: false,
        ghost: null,
        lastTarget: null
    };

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

    const target = under && under.closest('.grid-cell, .drop-zone');

    if (touchDragState.lastTarget && touchDragState.lastTarget !== target) {
        touchDragState.lastTarget.classList.remove('drag-over');
    }
    if (target && target !== touchDragState.lastTarget) {
        // Only highlight drop zones that accept this item type. Engine-source
        // drags don't accept any drop zone (they only place on grid cells).
        if (target.classList.contains('drop-zone')) {
            const accepts = !draggedItem.fromEngine && (
                (target.id === 'furnace-fuel-slot' && draggedItem.type === 'fuel') ||
                (target.id === 'smelter-ore-slot'   && draggedItem.type === 'ore')
            );
            if (accepts) target.classList.add('drag-over');
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
        target = under && under.closest('.grid-cell, .drop-zone');
    }

    if (target) {
        if (target.classList.contains('drop-zone')) {
            // Engine-source drag releasing on a drop zone is a no-op —
            // sparks only place on grid cells, not back into the furnace.
            if (!draggedItem || !draggedItem.fromEngine) {
                dispatchTouchDropOnZone(target);
            }
        } else {
            dispatchTouchDropOnGrid(target);
        }
    }

    // Cleanup
    if (ghost) ghost.remove();
    if (touchDragState.itemEl) touchDragState.itemEl.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.merge-target').forEach(el => el.classList.remove('merge-target'));

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

    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const targetItem = game.grid[targetIndex];

    if (targetItem &&
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
    if (zone.id === 'furnace-fuel-slot' && draggedItem.type === 'fuel') {
        const fuelValue = FUEL_TIERS[draggedItem.tier - 1].value;
        const maxFuel = game.bonuses.furnaceCapacity;
        if (game.furnace.fuel < maxFuel) {
            game.furnace.fuel = Math.min(game.furnace.fuel + fuelValue, maxFuel);
            game.grid[draggedIndex] = null;
            renderGridItem(draggedIndex);
            flashDropZone('furnace-fuel-slot');
            showToast(`Added ${FUEL_TIERS[draggedItem.tier - 1].name} to furnace!`);
        } else {
            showToast('Furnace is full!', 'error');
        }
    } else if (zone.id === 'smelter-ore-slot' && draggedItem.type === 'ore' && game.unlockedTiers.smelter) {
        const oreValue = ORE_TIERS[draggedItem.tier - 1].value;
        game.smelter.ore += oreValue;
        game.grid[draggedIndex] = null;
        renderGridItem(draggedIndex);
        flashDropZone('smelter-ore-slot');
        showToast(`Added ${ORE_TIERS[draggedItem.tier - 1].name} to smelter!`);
    }
}

// ============================================
// FURNACE DROP ZONE
// ============================================

function setupFurnaceDropZone() {
    const furnaceSlot = document.getElementById('furnace-fuel-slot');

    furnaceSlot.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedItem && draggedItem.type === 'fuel') {
            furnaceSlot.classList.add('drag-over');
        }
    });

    furnaceSlot.addEventListener('dragleave', () => {
        furnaceSlot.classList.remove('drag-over');
    });

    furnaceSlot.addEventListener('drop', (e) => {
        e.preventDefault();
        furnaceSlot.classList.remove('drag-over');

        if (draggedItem && draggedItem.type === 'fuel') {
            const fuelValue = FUEL_TIERS[draggedItem.tier - 1].value;
            const maxFuel = game.bonuses.furnaceCapacity;

            if (game.furnace.fuel < maxFuel) {
                game.furnace.fuel = Math.min(game.furnace.fuel + fuelValue, maxFuel);
                game.grid[draggedIndex] = null;
                renderGridItem(draggedIndex);
                showToast(`Added ${FUEL_TIERS[draggedItem.tier - 1].name} to furnace!`);
            } else {
                showToast('Furnace is full!', 'error');
            }
        }
    });
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
            game.grid[draggedIndex] = null;
            renderGridItem(draggedIndex);
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
        const amplifierBonus = 1 + (game.automation.amplifiers * 0.5 * game.bonuses.automationEfficiency);
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

        // Heat decay while idle. Exponential so large stockpiles aren't
        // wiped but early-game pressure to keep burning is real.
        const decayRate = game.bonuses.heatDecayRate || 0;
        if (decayRate > 0 && game.resources.heat > 0) {
            game.resources.heat *= Math.pow(1 - decayRate, delta);
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
            // Complete smelting
            const metalGain = Math.floor(game.smelter.ore * (1 + game.bonuses.metalYield) * getWisdomMultiplier());
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

function spawnFuel(bulk = false) {
    if (!bulk) {
        if (game.resources.heat < SPARK_HEAT_COST) {
            showToast('Not enough heat — gather sticks to rekindle.', 'error');
            sfx('error');
            return;
        }
        if (spawnItem('fuel')) {
            game.resources.heat -= SPARK_HEAT_COST;
            updateUI();
        }
        return;
    }
    // Bulk spawn: spark until heat or cells run out
    let count = 0;
    while (game.resources.heat >= SPARK_HEAT_COST) {
        const emptyIndex = game.grid.findIndex(c => c === null);
        if (emptyIndex === -1) break;
        if (spawnItem('fuel', false)) {
            game.resources.heat -= SPARK_HEAT_COST;
            count++;
        } else break;
    }
    if (count === 0) {
        showToast(game.resources.heat < SPARK_HEAT_COST
            ? 'Not enough heat — gather sticks.'
            : 'Grid is full!', 'error');
    } else {
        showToast(`Spawned ${count} sparks!`, 'success');
        updateUI();
    }
}

function spawnOre(bulk = false) {
    const cost = 10;
    if (!bulk) {
        if (game.resources.heat >= cost) {
            if (spawnItem('ore')) {
                game.resources.heat -= cost;
                updateUI();
            }
        } else {
            showToast('Not enough heat!', 'error');
        }
        return;
    }
    // Bulk: spawn as many as heat + empty cells allow
    let count = 0;
    while (game.resources.heat >= cost) {
        const emptyIndex = game.grid.findIndex(c => c === null);
        if (emptyIndex === -1) break;
        if (spawnItem('ore', false)) {
            game.resources.heat -= cost;
            count++;
        } else break;
    }
    if (count === 0) {
        showToast('No room or not enough heat!', 'error');
    } else {
        showToast(`Spawned ${count} ore!`, 'success');
        updateUI();
    }
}

// ============================================
// CRAFTING
// ============================================

function craftAlloy() {
    const cost = 5;
    if (game.resources.metal >= cost) {
        game.resources.metal -= cost;
        const yield_ = Math.floor(1 * (1 + game.bonuses.alloyYield) * getWisdomMultiplier());
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

function renderUpgrades() {
    for (const [category, upgrades] of Object.entries(UPGRADES)) {
        const panel = document.getElementById(`${category}-upgrades`);
        if (!panel) continue;

        panel.innerHTML = '';

        for (const upgrade of upgrades) {
            const div = document.createElement('div');
            div.className = 'upgrade-item';
            div.dataset.id = upgrade.id;

            const purchased = game.upgrades.includes(upgrade.id);
            const hasRequirement = !upgrade.requires || game.upgrades.includes(upgrade.requires);

            if (purchased) {
                div.classList.add('purchased');
            } else if (!hasRequirement) {
                div.classList.add('locked');
            }

            div.innerHTML = `
                <div class="upgrade-name">${upgrade.name}</div>
                <div class="upgrade-desc">${upgrade.desc}</div>
                <div class="upgrade-cost">${purchased ? 'Purchased' : `${formatNumber(upgrade.cost)} ${upgrade.costType}`}</div>
            `;

            if (!purchased && hasRequirement) {
                div.addEventListener('click', () => purchaseUpgrade(upgrade));
            }

            panel.appendChild(div);
        }
    }
}

function purchaseUpgrade(upgrade) {
    if (game.upgrades.includes(upgrade.id)) return;

    const resource = game.resources[upgrade.costType];
    if (resource === undefined || resource < upgrade.cost) {
        showToast(`Not enough ${upgrade.costType}!`, 'error');
        return;
    }

    game.resources[upgrade.costType] -= upgrade.cost;
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
            * (1 + game.automation.amplifiers * 0.5 * game.bonuses.automationEfficiency);
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

function showFurnaceDrop() {
    revealTargets(['#furnace-fuel-slot']);
}

// Apply an already-revealed state on load (no animation)
function applyRevealedFlags() {
    for (const stage of REVEAL_STAGES) {
        if (game.revealed[stage.id] && stage.targets) {
            for (const sel of stage.targets) {
                document.querySelectorAll(sel).forEach(el => el.classList.remove('reveal-hidden'));
            }
            if (stage.id === 'mergeGrid') hideIntroControls();
        }
    }
}

// Stick gathering — always-available manual labor. Gathering takes
// STICK_GATHER_MS so it feels like real work (as opposed to the engine's
// automated flows). A progress bar fills the button while gathering; the
// stick counts as a free resource you can stockpile and feed to the engine.
const STICK_GATHER_MS = 3000;
const STICK_FUEL_VALUE = 3; // each stick = 3 fuel = 3 seconds of burn
let stickGatherState = null;

function startStickGather() {
    if (stickGatherState) return;
    const btn = document.getElementById('gather-stick-btn');
    if (!btn) return;
    const fill = btn.querySelector('.stick-btn-fill');

    btn.classList.add('gathering');
    btn.disabled = true;
    if (fill) fill.style.width = '0%';

    const duration = STICK_GATHER_MS / (game.bonuses.stickGatherSpeed || 1);
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
    game.resources.sticks = (game.resources.sticks || 0) + sticksToAdd;
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

// Consume stored sticks, converting each into STICK_FUEL_VALUE fuel.
function feedStick(bulk = false) {
    if ((game.resources.sticks || 0) <= 0) {
        showToast('No sticks to feed — gather some first.', 'error');
        return;
    }
    const maxFuel = game.bonuses.furnaceCapacity;
    if (game.furnace.fuel >= maxFuel) {
        showToast('Furnace is full!', 'error');
        return;
    }

    let fed = 0;
    const limit = bulk ? game.resources.sticks : 1;
    for (let i = 0; i < limit; i++) {
        if (game.furnace.fuel >= maxFuel) break;
        if (game.resources.sticks <= 0) break;
        const added = Math.min(STICK_FUEL_VALUE, maxFuel - game.furnace.fuel);
        game.furnace.fuel += added;
        game.resources.sticks -= 1;
        game.stats.kindlingAdded++;
        fed++;
    }

    if (fed > 0) {
        const furnaceVisual = document.getElementById('furnace-visual');
        floatPopup(furnaceVisual, fed === 1 ? '+stick' : `+${fed} sticks`, 'heat');
        flashDropZone('furnace-fuel-slot');
        sfx('feed');

        // The 'firstStick' reveal stage fires the first-stick narration.
        // Later beats live here.
        if (game.stats.kindlingAdded === 3) {
            setNarration('The iron grows warm. Keep feeding it.');
        }
    }
    updateUI();
    checkReveals();
}

// ============================================
// UI UPDATES
// ============================================

function updateUI() {
    // Resources
    document.getElementById('heat-value').textContent = formatNumber(Math.floor(game.resources.heat));
    document.getElementById('metal-value').textContent = formatNumber(Math.floor(game.resources.metal));
    document.getElementById('alloy-value').textContent = formatNumber(Math.floor(game.resources.alloy));
    document.getElementById('gear-value').textContent = formatNumber(Math.floor(game.resources.gears));
    document.getElementById('essence-value').textContent = formatNumber(Math.floor(game.resources.essence));

    // Heat rate
    const heatRate = game.furnace.fuel > 0 ?
        10 * game.bonuses.furnaceEfficiency * game.bonuses.heatMultiplier * getWisdomMultiplier() *
        (1 + game.automation.amplifiers * 0.5 * game.bonuses.automationEfficiency) : 0;
    document.getElementById('heat-rate').textContent = `+${formatNumber(heatRate)}/s`;

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
        fuelTimeEl.textContent = `· ${label}`;
    }
    document.getElementById('furnace-temp').textContent = `${Math.floor(game.furnace.temperature)}*`;

    // Furnace ASCII animation — art changes with temperature
    const furnaceAscii = document.getElementById('furnace-ascii');
    if (furnaceAscii) {
        const burning = game.furnace.fuel > 0;
        const temp = game.furnace.temperature;
        const cold = !burning && temp < 1 && game.stats.totalHeat === 0;
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
            furnaceAscii.textContent = `
    _______
   /       \\
  |  .   .  |
  |    _    |
  |  '---'  |
  |_________|
 /___________\\
|_____________|`;
        }
    }

    // Smelter
    if (game.unlockedTiers.smelter) {
        document.getElementById('smelter-ore').textContent = formatNumber(Math.floor(game.smelter.ore));
        document.getElementById('smelter-progress').textContent = Math.floor(game.smelter.progress);

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
    if (stickCountEl) stickCountEl.textContent = game.resources.sticks || 0;
    const feedStickBtn = document.getElementById('feed-stick-btn');
    if (feedStickBtn) {
        const canFeed = (game.resources.sticks || 0) > 0 && game.furnace.fuel < game.bonuses.furnaceCapacity;
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
    // Feed-stick: tap = 1 stick, shift-tap = feed all
    const feedBtn = document.getElementById('feed-stick-btn');
    if (feedBtn) feedBtn.addEventListener('click', (e) => feedStick(e.shiftKey));

    // Spawn buttons (shift-click = bulk fill)
    document.getElementById('spawn-fuel').addEventListener('click', (e) => spawnFuel(e.shiftKey));
    document.getElementById('spawn-ore').addEventListener('click', (e) => spawnOre(e.shiftKey));

const burnAll = document.getElementById('burn-all-btn');
    if (burnAll) burnAll.addEventListener('click', burnAllFuel);
    const smeltAll = document.getElementById('smelt-all-btn');
    if (smeltAll) smeltAll.addEventListener('click', smeltAllOre);

    // Furnace drop zone
    setupFurnaceDropZone();
    setupSmelterDropZone();

    // Engine as a drag SOURCE: drag a Spark out of the furnace onto the grid.
    // Listeners are bound unconditionally; the handlers gate themselves on
    // canDragSparkFromEngine() so dragging is a no-op until merge grid is
    // unlocked and there's enough heat to spend.
    const furnaceVisual = document.getElementById('furnace-visual');
    if (furnaceVisual) {
        furnaceVisual.setAttribute('draggable', 'true');
        furnaceVisual.addEventListener('dragstart', handleEngineDragStart);
        furnaceVisual.addEventListener('dragend', handleEngineDragEnd);
        furnaceVisual.addEventListener('touchstart', handleEngineTouchStart, { passive: false });
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

    // Save/Load
    document.getElementById('save-btn').addEventListener('click', () => {
        saveGame();
        showToast('Game saved!', 'success');
    });

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
            game.revealed = loaded.revealed || {};

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
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {
            // Offline capability is a bonus, not required. Ignore failures.
        });
    });
}
