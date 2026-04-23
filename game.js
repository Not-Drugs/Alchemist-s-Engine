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

const UPGRADES = {
    furnace: [
        { id: 'efficiency1', name: 'Better Bellows', desc: '+25% furnace efficiency', cost: 50, costType: 'heat', effect: () => { game.bonuses.furnaceEfficiency += 0.25; } },
        { id: 'efficiency2', name: 'Insulated Walls', desc: '+25% furnace efficiency', cost: 200, costType: 'heat', requires: 'efficiency1', effect: () => { game.bonuses.furnaceEfficiency += 0.25; } },
        { id: 'efficiency3', name: 'Arcane Vents', desc: '+50% furnace efficiency', cost: 1000, costType: 'heat', requires: 'efficiency2', effect: () => { game.bonuses.furnaceEfficiency += 0.5; } },
        { id: 'capacity1', name: 'Fuel Chamber', desc: 'Furnace holds +100 fuel', cost: 100, costType: 'heat', effect: () => { game.bonuses.furnaceCapacity += 100; } },
        { id: 'capacity2', name: 'Deep Hearth', desc: 'Furnace holds +500 fuel', cost: 500, costType: 'heat', requires: 'capacity1', effect: () => { game.bonuses.furnaceCapacity += 500; } },
        { id: 'heatMult1', name: 'Heat Resonance', desc: '2x heat generation', cost: 2000, costType: 'heat', effect: () => { game.bonuses.heatMultiplier *= 2; } },
        { id: 'heatMult2', name: 'Thermal Mastery', desc: '2x heat generation', cost: 10000, costType: 'heat', requires: 'heatMult1', effect: () => { game.bonuses.heatMultiplier *= 2; } },
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

const defaultGame = {
    resources: {
        heat: 0,
        metal: 0,
        alloy: 0,
        gears: 0,
        essence: 0
    },
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
        automationEfficiency: 1
    },
    stats: {
        totalHeat: 0,
        totalMerges: 0,
        highestFuelTier: 1,
        startTime: Date.now(),
        playTime: 0
    },
    philosopherStones: 0,
    prestigeCount: 0,
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

function init() {
    loadGame();
    createGrid();
    setupEventListeners();
    renderUpgrades();
    renderAchievements();
    updateUI();

    // Start game loop
    setInterval(gameLoop, 100); // 10 ticks per second

    // Auto-save every 30 seconds
    setInterval(saveGame, 30000);

    // Check achievements every second
    setInterval(checkAchievements, 1000);
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

    // Drag events
    itemEl.addEventListener('dragstart', handleDragStart);
    itemEl.addEventListener('dragend', handleDragEnd);

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
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItem = null;
    draggedIndex = null;
    draggedElement = null;

    // Remove all drag-over states
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
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

            // Flash animation
            renderGridItem(targetIndex);
            const newItem = document.querySelector(`.grid-cell[data-index="${targetIndex}"] > div`);
            if (newItem) {
                newItem.classList.add('merge-flash');
                setTimeout(() => newItem.classList.remove('merge-flash'), 300);
            }

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

        // Update temperature (approaches fuel level)
        const targetTemp = Math.min(game.furnace.fuel * 5, 1000);
        game.furnace.temperature += (targetTemp - game.furnace.temperature) * 0.1 * delta;
    } else {
        // Cool down
        game.furnace.temperature *= Math.pow(0.95, delta);
        if (game.furnace.temperature < 1) game.furnace.temperature = 0;
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

function spawnFuel() {
    spawnItem('fuel');
}

function spawnOre() {
    const cost = 10;
    if (game.resources.heat >= cost) {
        if (spawnItem('ore')) {
            game.resources.heat -= cost;
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
        const yield_ = Math.floor(1 * (1 + game.bonuses.alloyYield) * getWisdomMultiplier());
        game.resources.alloy += yield_;
        game.forge.count++;
        showToast(`Forged ${yield_} alloy!`, 'success');
    }
}

function craftGear() {
    const cost = 3;
    if (game.resources.alloy >= cost) {
        game.resources.alloy -= cost;
        const yield_ = Math.ceil(getWisdomMultiplier());
        game.resources.gears += yield_;
        showToast(`Crafted ${yield_} gear(s)!`, 'success');
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
}

function unlockTier(tier) {
    game.unlockedTiers[tier] = true;

    // Show section
    const section = document.getElementById(`${tier}-section`);
    if (section) section.classList.remove('hidden');

    // Show resource if applicable
    if (tier === 'smelter') {
        document.getElementById('metal-resource').classList.remove('hidden');
        document.getElementById('spawn-ore').classList.remove('hidden');
        document.querySelector('[data-tab="smelter-upgrades"]').classList.remove('hidden');
    } else if (tier === 'forge') {
        document.getElementById('alloy-resource').classList.remove('hidden');
        document.querySelector('[data-tab="forge-upgrades"]').classList.remove('hidden');
    } else if (tier === 'workshop') {
        document.getElementById('gear-resource').classList.remove('hidden');
        document.querySelector('[data-tab="workshop-upgrades"]').classList.remove('hidden');
    } else if (tier === 'sanctum') {
        document.getElementById('essence-resource').classList.remove('hidden');
        document.getElementById('prestige-display').classList.remove('hidden');
    }

    showToast(`Unlocked: ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`, 'achievement');
}

// ============================================
// ACHIEVEMENTS
// ============================================

function renderAchievements() {
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
            showToast(`Achievement: ${ach.name}!`, 'achievement');
        }
    }

    if (newAchievements) {
        renderAchievements();
    }
}

function updateAchievementCount() {
    const count = document.getElementById('achievement-count');
    count.textContent = `(${game.achievements.length}/${ACHIEVEMENTS.length})`;
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
    document.getElementById('furnace-fuel').textContent = formatNumber(Math.floor(game.furnace.fuel));
    document.getElementById('furnace-temperature').textContent = formatNumber(Math.floor(game.furnace.temperature));
    document.getElementById('furnace-temp').textContent = `${Math.floor(game.furnace.temperature)}*`;
    document.getElementById('furnace-efficiency').textContent = Math.floor(game.bonuses.furnaceEfficiency * 100);

    // Furnace ASCII animation
    const furnaceAscii = document.getElementById('furnace-ascii');
    if (furnaceAscii) {
        const burning = game.furnace.fuel > 0;
        furnaceAscii.classList.toggle('burning', burning);
        if (burning) {
            const frame = Math.floor(Date.now() / 200) % 3;
            const flames = ['  ^', ' ^^^', '^^^^^'][frame];
            const flames2 = [' ^^^', '^^^^^', '  ^'][frame];
            furnaceAscii.textContent = `
    _______
   /       \\
  |  ${flames}  |
  |  ${flames2}  |
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

        // ASCII progress bar
        const progressBar = document.getElementById('smelter-progress-bar');
        if (progressBar) {
            const filled = Math.floor(game.smelter.progress / 10);
            const empty = 10 - filled;
            progressBar.textContent = '='.repeat(filled) + '-'.repeat(empty);
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
        document.getElementById('prestige-display').classList.remove('hidden');
        document.getElementById('philosopher-stones').textContent = game.philosopherStones;
        document.getElementById('wisdom-mult').textContent = getWisdomMultiplier().toFixed(2);
    }

    // Spawn ore button
    const spawnOreBtn = document.getElementById('spawn-ore');
    spawnOreBtn.disabled = game.resources.heat < 10;

    // Stats
    document.getElementById('stat-total-heat').textContent = formatNumber(Math.floor(game.stats.totalHeat));
    document.getElementById('stat-total-merges').textContent = formatNumber(game.stats.totalMerges);
    document.getElementById('stat-highest-fuel').textContent = game.stats.highestFuelTier;
    document.getElementById('stat-time-played').textContent = formatTime(game.stats.playTime);

    // Show unlocked sections
    if (game.unlockedTiers.smelter) {
        document.getElementById('smelter-section').classList.remove('hidden');
        document.getElementById('metal-resource').classList.remove('hidden');
        document.getElementById('spawn-ore').classList.remove('hidden');
        document.querySelector('[data-tab="smelter-upgrades"]').classList.remove('hidden');
    }
    if (game.unlockedTiers.forge) {
        document.getElementById('forge-section').classList.remove('hidden');
        document.getElementById('alloy-resource').classList.remove('hidden');
        document.querySelector('[data-tab="forge-upgrades"]').classList.remove('hidden');
    }
    if (game.unlockedTiers.workshop) {
        document.getElementById('workshop-section').classList.remove('hidden');
        document.getElementById('gear-resource').classList.remove('hidden');
        document.querySelector('[data-tab="workshop-upgrades"]').classList.remove('hidden');
    }
    if (game.unlockedTiers.sanctum) {
        document.getElementById('sanctum-section').classList.remove('hidden');
    }
    if (game.unlockedTiers.essence) {
        document.getElementById('essence-resource').classList.remove('hidden');
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Spawn buttons
    document.getElementById('spawn-fuel').addEventListener('click', spawnFuel);
    document.getElementById('spawn-ore').addEventListener('click', spawnOre);

    // Furnace drop zone
    setupFurnaceDropZone();
    setupSmelterDropZone();

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

    document.getElementById('reset-btn').addEventListener('click', hardReset);
}

// ============================================
// SAVE/LOAD
// ============================================

function saveGame() {
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

function exportGame() {
    const saveData = btoa(JSON.stringify(game));
    navigator.clipboard.writeText(saveData).then(() => {
        showToast('Save copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = saveData;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Save copied to clipboard!', 'success');
    });
}

function importGame() {
    const textarea = document.getElementById('import-textarea');
    const data = textarea.value.trim();

    try {
        const decoded = JSON.parse(atob(data));
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

    localStorage.removeItem('alchemistsEngine');
    game = JSON.parse(JSON.stringify(defaultGame));
    game.lastUpdate = Date.now();

    createGrid();
    renderUpgrades();
    renderAchievements();
    updateUI();

    // Hide all unlockable sections
    document.querySelectorAll('.hidden').forEach(el => el.classList.add('hidden'));
    document.getElementById('smelter-section').classList.add('hidden');
    document.getElementById('forge-section').classList.add('hidden');
    document.getElementById('workshop-section').classList.add('hidden');
    document.getElementById('sanctum-section').classList.add('hidden');
    document.getElementById('prestige-display').classList.add('hidden');
    document.getElementById('metal-resource').classList.add('hidden');
    document.getElementById('alloy-resource').classList.add('hidden');
    document.getElementById('gear-resource').classList.add('hidden');
    document.getElementById('essence-resource').classList.add('hidden');
    document.getElementById('spawn-ore').classList.add('hidden');
    document.querySelectorAll('[data-tab="smelter-upgrades"], [data-tab="forge-upgrades"], [data-tab="workshop-upgrades"]')
        .forEach(el => el.classList.add('hidden'));

    showToast('Game reset!', 'success');
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
