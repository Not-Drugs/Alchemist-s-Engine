# Pre-Prod Checklist

Hardening / polish items deferred to before public launch. NOT active
cowork tickets — items here are queued for the pre-ship pass and
shouldn't be picked up by terminal-Claude's `[new]`/`[reopened]` loop.

When a checklist item is ready to ship, file it as a fresh ticket in
`cowork/inbox.md` with the regular `[new]` status and reference this
file's heading.

---

## Anti-injection hardening (originally ticket-20260430-0091)

**Goal:** Production builds make casual injection harder AND
sanity-check loaded/runtime state so injected values self-correct or
get rejected.

**Status:** deferred to pre-prod (moved out of inbox 2026-04-30 by
Nicholas — "is 91 preventing injection that can be moved from the
ticket to the backlog as a pre prod checklist item").

### Stacked options (pick one or several)

1. **Hide `game` from `window` in production.** Wrap the game-state
   initialization in an IIFE / module scope so `window.game` is
   `undefined`. Expose only when a dev flag is set:
   ```js
   const isDev = location.hostname === 'localhost'
              || location.hostname === '127.0.0.1'
              || location.search.includes('dev=1');
   if (isDev) {
       window.game = game;
       // also expose anything cowork tests poke directly:
       window.checkReveals = checkReveals;
       window.feedStick = feedStick;
       window.engineDropOnCell = engineDropOnCell;
       // ... per current cowork harness
   }
   ```
   Cowork sessions append `?dev=1` to the test URL. Live game keeps
   `game` private. **Cost:** low (~10 min). **Effectiveness:** stops
   drive-by cheating; a determined player can still userscript
   `game.js`, but that's a different bar.

2. **Save-load validation (range clamps).** After the existing
   NaN-scrub on load, clamp each numeric field to a per-field max
   and reject non-finite values:
   ```js
   const RES_MAX = {
       heat: 1e15, metal: 1e15, alloy: 1e15,
       gears: 1e10, essence: 1e10,
       alloyFrac: 1, metalFrac: 1
   };
   for (const [k, max] of Object.entries(RES_MAX)) {
       if (game.resources[k] > max) game.resources[k] = max;
       if (game.resources[k] < 0)   game.resources[k] = 0;
   }
   game.philosopherStones = Math.max(0, Math.min(game.philosopherStones || 0, 1e6));
   game.inventory.sticks  = Math.max(0, Math.min(game.inventory.sticks  || 0, 1e7));
   game.inventory.stones  = Math.max(0, Math.min(game.inventory.stones  || 0, 1e7));
   game.furnace.fuel      = Math.max(0, Math.min(game.furnace.fuel      || 0, game.bonuses.furnaceCapacity || 100));
   ```
   Already partially done by ticket-0060's NaN-scrub and 0090's
   negative clamp — extending with range maxes is a few lines.
   **Cost:** low (~5 min). **Effectiveness:** any cheat that survives
   a save/load round-trip gets capped to "very impressive but
   plausible." Also defends against save-state corruption and
   future-bug-produced overflows that hit non-cheating players.

3. **Per-tick sanity gate.** In the main game loop, detect
   implausible deltas (e.g. heat jumped from 100 to 999999999
   between ticks without a fuel burn) and clamp / log / snapshot.
   **Cost:** medium. **Effectiveness:** catches mid-session
   injection AND future game-logic bugs that produce nonsensical
   numbers.

### Recommendation

Ship **option 1 + option 2** together (hide + validate). The
combination has the best cost-benefit ratio for an idle game and
together they form a clean "data is sane, display is sane" pair
with already-shipped 0060 (NaN scrub) and 0090 (negative clamp).

### Cowork harness updates required when this ships

- `cowork/README.md` — document the `?dev=1` flag for cowork-Claude's
  test URL.
- `cowork/PROTOCOL.md` — note that test URLs in tickets should
  include `?dev=1`.
- Refresh any in-flight cowork sessions with the new URL.
