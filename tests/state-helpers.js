// State-injection library for cowork-Claude.
//
// Cowork-Claude has been doing manual state setup all session — set
// inventory.sticks, force unlocks, mark grove items collected, etc.
// These are the named, reusable versions. Add new helpers here when a
// test scenario keeps repeating.
//
// USAGE FROM COWORK (browser console):
//
//   const s = document.createElement('script');
//   s.src = '/tests/state-helpers.js';
//   document.body.appendChild(s);
//
// After the script loads, every helper is callable directly:
// `setupGroveFresh()`, `setupGroveAllCollected()`, etc. Or use
// `S.<name>()` for namespace discipline (every helper is also
// attached to `window.S`). Loading this file twice in the same
// session is idempotent — the IIFE just re-attaches the same
// functions to `window`.
//
// All helpers assume `window.game` exists. The current build exposes
// `game` to window unconditionally; the planned anti-injection
// hardening (PRE_PROD_CHECKLIST.md "hide game from window") will
// require `?dev=1` on the test URL to keep `game` reachable.

(function () {
    'use strict';

    // -----------------------------------------------------------------
    // Resets — start from a known clean baseline so no leftover state
    // from a previous test bleeds in.
    // -----------------------------------------------------------------

    /**
     * Wipe localStorage so the next reload comes up as a true first
     * load. Reloads the page automatically — cowork's next interaction
     * will be against the fresh state.
     */
    function clearSave() {
        localStorage.removeItem('alchemistsEngine');
        location.reload();
    }

    /** Same as clearSave, kept as a more discoverable name. */
    function setupFreshSave() {
        clearSave();
    }

    // -----------------------------------------------------------------
    // Phase 1 setups (stick-gather era)
    // -----------------------------------------------------------------

    /** Player has gathered enough sticks to surface the Upgrades panel. */
    function setupKindlingThreshold() {
        if (!window.game) return;
        window.game.inventory.sticks = 5;
        window.game.stats.kindlingAdded = 3;
        window.updateUI?.();
        window.checkReveals?.();
    }

    /** Heat at 50% of phase 1 target — sootBeat2 narration territory. */
    function setupHalfPhase1() {
        if (!window.game) return;
        window.game.stats.peakHeat = 500;
        window.game.resources.heat = 250;
        window.game.furnace.fuel = 30;
        window.updateUI?.();
    }

    // -----------------------------------------------------------------
    // Phase 2+ setups (post-merge-grid reveal)
    // -----------------------------------------------------------------

    /** Phase 1 just completed — Awakens modal would fire. */
    function setupPhase2Awakens() {
        if (!window.game) return;
        window.game.stats.peakHeat = 1000;
        window.game.resources.heat = 1000;
        window.updateUI?.();
        window.checkReveals?.();
    }

    /** Forge unlocked, mid-progression. */
    function setupForgeUnlocked() {
        if (!window.game) return;
        window.game.stats.peakHeat = 5000;
        window.game.resources.heat = 500;
        window.game.resources.metal = 50;
        window.game.unlockedTiers.smelter = true;
        window.game.unlockedTiers.forge = true;
        window.updateUI?.();
        window.checkReveals?.();
    }

    // -----------------------------------------------------------------
    // Grove setups — the visual-iteration workhorse
    // -----------------------------------------------------------------

    /** Grove unlocked, fresh — every item still present (4 stones / 11 sticks). */
    function setupGroveFresh() {
        if (!window.game) return;
        window.game.stats.sticksGathered = 50;  // unlocks the Explore card
        if (!window.game.locations) window.game.locations = {};
        window.game.locations.grove = { collected: [], layoutV: 3 };
        window.game.revealed = window.game.revealed || {};
        window.game.revealed.exploreUnlock = true;
        window.updateUI?.();
    }

    /** Grove with everything picked up — "The grove is empty for now." state. */
    function setupGroveAllCollected() {
        setupGroveFresh();
        if (!window.game) return;
        // Mark all 15 indices collected (current GROVE_ITEMS.length).
        window.game.locations.grove.collected = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14];
    }

    /** Open the grove modal (use after a setupGrove* call). */
    function openGrove() {
        document.getElementById('grove-enter')?.click();
    }

    /** Close the grove modal. */
    function closeGrove() {
        document.getElementById('grove-leave')?.click();
    }

    // -----------------------------------------------------------------
    // Bug-state setups — for regression checks on previously-shipped fixes
    // -----------------------------------------------------------------

    /** Corrupted automation field (ticket 0060 NaN-heat). */
    function setupCorruptedAutomation() {
        if (!window.game) return;
        window.game.automation = window.game.automation || {};
        window.game.automation.amplifiers = undefined;
        window.game.automation.sparkers = undefined;
    }

    /** Negative resource values (ticket 0090 UI-clamp regression). */
    function setupNegativeResources() {
        if (!window.game) return;
        window.game.inventory.sticks = -5;
        window.game.resources.heat = -100;
        window.game.resources.metal = -50;
        window.updateUI?.();
    }

    /** Inject a NaN into heat to verify the load-time scrub catches it. */
    function setupNaNHeat() {
        if (!window.game) return;
        window.game.resources.heat = NaN;
        window.updateUI?.();
    }

    // -----------------------------------------------------------------
    // Diagnostics — quick console snapshots cowork can paste
    // -----------------------------------------------------------------

    /** Dump grove state in one line. */
    function diagGrove() {
        const sc = document.getElementById('grove-scene');
        const rows = sc?.querySelectorAll('.grove-row') ?? [];
        return {
            modalHidden: document.getElementById('grove-modal')?.classList.contains('hidden'),
            sceneClientHW: sc ? `${sc.clientWidth}x${sc.clientHeight}` : null,
            sceneScrollHW: sc ? `${sc.scrollWidth}x${sc.scrollHeight}` : null,
            rowCount: rows.length,
            firstRowFontSize: rows[0]?.style.fontSize || getComputedStyle(rows[0] || document.body).fontSize,
            collected: window.game?.locations?.grove?.collected?.length,
            layoutV: window.game?.locations?.grove?.layoutV,
        };
    }

    /** Dump heat / resource state. */
    function diagResources() {
        if (!window.game) return null;
        return {
            heat: window.game.resources.heat,
            heatIsFinite: Number.isFinite(window.game.resources.heat),
            fuel: window.game.furnace.fuel,
            sticks: window.game.inventory.sticks,
            metal: window.game.resources.metal,
            alloy: window.game.resources.alloy,
            automation: window.game.automation,
        };
    }

    // -----------------------------------------------------------------
    // Export to window so cowork can call helpers directly OR via S.<name>
    // -----------------------------------------------------------------

    const helpers = {
        clearSave,
        setupFreshSave,
        setupKindlingThreshold,
        setupHalfPhase1,
        setupPhase2Awakens,
        setupForgeUnlocked,
        setupGroveFresh,
        setupGroveAllCollected,
        openGrove,
        closeGrove,
        setupCorruptedAutomation,
        setupNegativeResources,
        setupNaNHeat,
        diagGrove,
        diagResources,
    };
    window.S = helpers;
    Object.assign(window, helpers);

    console.log('[state-helpers] loaded — call any of: ' + Object.keys(helpers).join(', '));
})();
