# tests/

State-injection helpers for cowork-Claude's manual playtesting.

Cowork has been pasting 5–10-line state-setup blocks into the console
all session ("set inventory.sticks=5, set automation.amplifiers=undefined,
…"). This file collapses each scenario into a one-line call.

## How cowork loads it

In the browser console at the test URL, paste once per session:

```js
const s = document.createElement('script'); s.src = '/tests/state-helpers.js'; document.body.appendChild(s);
```

After that, every helper is on `window` (and on `window.S` for namespace
discipline if multiple things start fighting for top-level names):

```js
setupGroveFresh();              // unlock the grove with all 15 items present
setupGroveAllCollected();       // mark everything picked up — empty-message state
setupForgeUnlocked();           // jump to forge progression
setupCorruptedAutomation();     // inject the 0060 bug shape; should self-heal
diagGrove();                    // snapshot of grove DOM measurements
diagResources();                // snapshot of resource + heat state
```

The full list logs to the console after the script finishes loading.

## What's in the library

**Resets** — wipe to a fresh save:
- `clearSave()` / `setupFreshSave()`

**Phase setups** — jump to a known progression:
- `setupKindlingThreshold()` — Upgrades panel just revealed
- `setupHalfPhase1()` — heat at 50% of phase 1
- `setupPhase2Awakens()` — phase 1 just complete
- `setupForgeUnlocked()` — mid-progression with smelter + forge

**Grove** — the visual-ticket workhorse:
- `setupGroveFresh()` — all 15 items present
- `setupGroveAllCollected()` — empty message state
- `openGrove()` / `closeGrove()` — modal toggle

**Bug-state regressions** — verify shipped fixes still hold:
- `setupCorruptedAutomation()` — 0060 NaN propagation
- `setupNegativeResources()` — 0090 UI clamp
- `setupNaNHeat()` — load-time scrub

**Diagnostics** — one-liners for inbox comments:
- `diagGrove()` — modal + scene measurements
- `diagResources()` — heat / fuel / inventory snapshot

## Adding a helper

If a scenario repeats across tickets, add it. Each helper:
1. Bails harmlessly if `window.game` isn't present
2. Pokes the relevant fields
3. Calls `updateUI()` and/or `checkReveals()` to flush the change

Add the function inside the IIFE, then add it to the `helpers` object
at the bottom so it gets exported to `window` and shows up in the
load-time console list.

## Caveats

- Assumes `window.game` is reachable. The PRE_PROD_CHECKLIST.md item
  "hide `game` from window in production" will require `?dev=1` on
  the test URL to keep it accessible. Update this README when that
  lands.
- Some helpers reload the page (`clearSave`). State after them starts
  from the top.
- Pure browser code — no Node, no test framework. The IIFE structure
  attaches helpers to `window` on load; loading the file twice in the
  same session is idempotent (second load just re-attaches the same
  functions).
