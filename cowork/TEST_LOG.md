# Cowork Playtest Test Log

What's been exercised by cowork-Claude playtest sessions, by area. Helps future
sessions skip already-covered ground and focus on gaps. New tests append at the
bottom of each section with a date stamp.

**Scope (per Nicholas, 2026-04-30):** Phase 1 (sticks) + Alchemical Table (merge
grid / inventory / satchel / crafting) + Exploration (Dead Grove). Smelter / Forge
/ Workshop / Sanctum are out of scope for now — those mechanics may change.

Each row has:
- **ID** — internal test number for the session
- **Source → Target / Action** — what the test exercised
- **Expected** — what should happen
- **Result** — `pass` / `fail` / `observe` (no clear pass/fail; data captured)
- **Ticket** — link to filed bug, if any
- **Date** — when run

---

## Phase 1 — Stick mechanics

### 2026-04-29 cowork session

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| P1-01 | Click [/] Gather Stick (3s timer at base) | sticks +1, sticksGathered +1 | pass | — |
| P1-02 | Click [>] Feed Stick (single) | sticks -1, fuel +3, kindlingAdded +1, narration beats fire | pass | — |
| P1-03 | Shift-click [>] Feed Stick (bulk-feed all sticks) | feeds every stick at once | pass | scheduled to be removed per ticket-20260430-0050 |
| P1-04 | Reach peakHeat ≥ 1000 → Phase 2 modal "Engine Awakens" | modal opens, [Reach for it] dismisses | pass | — |
| P1-05 | Buy Stick Basket upgrade (5 sticks) | bonuses.sticksPerGather=4, stickGatherMs=5000 | pass | — |
| P1-06 | Inspect resources section visibility on fresh save | section collapses to 0px when no resources unlocked | pass after fix | ticket-20260429-2358 [verified] |
| P1-07 | Floating "+heat" popup cadence during burn | 1 floater per 1s of accumulated heat | pass | not-a-bug per ticket-20260430-0000b [verified] |

### Open / TODO for Phase 1

- [ ] Furnace overflow: drag fuel onto a 100/100 furnace — should reject or partial-consume cleanly
- [ ] Sticks gathered counter monotonicity: feed all sticks, verify `game.stats.sticksGathered` does NOT decrement
- [ ] Heat decay floor when `decayRate === 0` (Sealed Crucible upgrade) — floor should NOT kick in
- [ ] Heat passive gen (Ember Heart upgrade) only fires while idle (fuel === 0)
- [ ] NaN-recovery scrub on save load — see ticket-20260430-0060

---

## Phase 2 — Alchemical Table (merge grid + inventory + satchel + crafting)

### 2026-04-29 cowork session — drag system battery

State: clean grid, sticks=5, stones=3, satchel=[], heat=5000, fuel=0, automation cleared.

#### Inventory ↔ Grid

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T1 | inv-tile-stick → empty cell | place ingredient {type:'ingredient',kind:'stick'}, sticks-1 | pass | — |
| T2 | inv-tile-stone → empty cell | place ingredient kind:'stone', stones-1 (v64 invKeyForKind) | pass | — |
| T3 | stick-ingredient (grid) → inv-tile-stick | cell cleared, sticks+1 | pass | — |
| T4 | stone-ingredient (grid) → inv-tile-stick (wrong target) | reject — ingredient stays, no inventory change | pass | — |

#### Grid ↔ Grid (merge)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T5 | spark t1 (cell A) → spark t1 (cell B) | merge → ember t2 in B, A cleared | pass | — |
| T6 | spark t1 → ember t2 | reject (different tier) | pass | — |

#### Grid ↔ Satchel

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T7 | spark t1 (grid) → empty satchel slot | slot fills with {tier:1,count:1}, cell cleared | pass | — |
| T10 | second spark t1 (grid) → same slot | count increments to 2, no new slot | pass | — |
| T11 | ember t2 (grid) → slot 0 holding spark t1 (different tier) | new slot 1 created with t2×1, slot 0 unchanged | pass | — |

#### Satchel ↔ Grid (deploy)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T8 | satchel slot (count 1) → empty grid cell | slot vanishes, cell gets spark | pass | — |
| T12 | satchel slot (count 3) → empty grid cell | deploys 1, slot count → 2 | pass | — |
| T13 | satchel slot (count 2) → grid cell with matching tier | auto-merges to next tier, slot count → 1 | pass | — |

#### Engine drops (drag-to-furnace)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T9 | satchel slot (fuel) → engine ASCII | fuel +1, slot decremented (NOT double-credited — v67 fix) | pass | — |
| T15 | inv-tile-stick → engine | reject (sticks-as-inventory not burnable via drag) | reject | **ticket-20260430-0070** — gap: should accept |
| T16 | stick-ingredient (grid) → engine | reject (sticks-as-ingredient not burnable via drag) | reject | **ticket-20260430-0070** — gap: should accept |
| T30 | inv-tile-stick → engine (re-test) | EXPECTED +3 fuel, -1 stick (per Nicholas) | **fail** | ticket-20260430-0070 |
| T31 | stick-ingredient → engine (re-test) | EXPECTED +3 fuel, ingredient consumed | **fail** | ticket-20260430-0070 |
| T32 | spark fuel (grid) → engine | fuel +1, cell cleared | pass | — |
| T33 | spark fuel (satchel slot) → engine | fuel +1, slot empty | pass | — |
| T40 | inv-tile-stone → engine | reject (not burnable) | pass | — |
| T41 | stone-ingredient (grid) → engine | reject | pass | — |
| T42 | ore (grid) → engine | reject (ore is smeltable, not burnable) | pass | — |

#### Wrong-target rejects

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| T14 | spark fuel (grid) → inv-tile-stick | reject | pass | — |
| T20 | spark fuel (grid) → inv-tile-stick | reject | pass | — |
| T21 | spark fuel (grid) → inv-tile-stone | reject | pass | — |
| T22 | inv-tile-stone → inv-tile-stick (cross-kind) | reject | pass | — |
| T23 | stone-ingredient (grid) → inv-tile-stick (cross-kind) | reject | pass | — |
| T24 | spark fuel t1 → unlock-burn-all (needs Infernite t7) | reject | pass | — |
| T25 | stone-ingredient → unlock-spark (needs Blazite t6) | reject | pass | — |

#### Convenience-button unlocks (Alchemical Table — drop tier-N to forge a button)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| U1 | Blazite t6 (grid) → unlock-spark slot | game.upgrades += 'sparkUnlock', Blazite consumed, slot hides | pass | — |

#### Crafting (recipe matcher)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| C1 | findRecipeMatch on `+`-shape (4 sticks orthogonal around spark t1) | returns {recipe:'Stick Golem', cells:[…]} | pass | — |
| C2 | Click [Craft Stick Golem] | grid 5 cells consumed, keyItems += {type:'golem'}, golemRecipeTaught=true | pass | — |
| C3 | Open Key Items modal | modal opens centered, lists "G" tile with title="golem", [Close] dismisses | pass | design-D9 (label polish) |

#### Upgrade purchases (Phase 2 mechanics)

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| UP1 | Click .upgrade-item[data-id="stickBundle"] | upgrade applied, costs 5 sticks, marked [OWNED] | pass | — |
| UP2 | Tab through page on keyboard | upgrade items focusable | pass after fix | ticket-20260430-0000 + 0014 [verified] |

### Open / TODO for Phase 2

- [ ] 8-slot satchel cap: stash 8 different fuel/ore tiers, try to stash a 9th of a NEW tier — should toast "Satchel full"
- [ ] Drop fuel onto a count-N satchel slot of same tier — does it stack or refuse?
- [ ] Drop fuel onto a satchel slot of DIFFERENT tier — should create new slot, but only if slots available
- [ ] Right-click / double-click on a fuel tile to burn (CLAUDE.md mentions `dbl/right-click to burn`)
- [ ] Cross-type merge attempts (drag fuel onto ingredient cell, ore onto fuel cell)
- [ ] Multi-golem crafting: craft Stick Golem twice, verify Key Items modal lists 2 entries (8-item soft cap)
- [ ] Recipe accordion `[Recipes ▾]` once a recipe is discovered (currently empty UI is fine; verify it shows the discovered recipe)
- [ ] Save → export → clear localStorage → import roundtrip with new alloyFrac/metalFrac fields (post-v78 migration)

---

## Exploration — Dead Grove

### 2026-04-29 cowork session

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| G1 | Explore card while sticksGathered < 50 | shows locked placeholder with "N / 50" counter | pass | — |
| G2 | sticksGathered = 50 → checkReveals() | exploreUnlock fires, locked placeholder hides, [Explore Grove] revealed | pass | — |
| G3 | Click grove-enter | grove modal opens, body-scroll lock fires, [X] dismisses | pass | — |
| G4 | Grove modal scrollbars at vw=500 | should fit without scrollbars | pass after fix | ticket-20260430-0012 [verified] (partial vertical residue acceptable) |
| G5 | Click .grove-item.grove-stick | sticks +1, item removed from scene, collected[] += index | pass | — |
| G6 | Grove ASCII rendering | framing trees + 5 mid-bands + horizon + items render | pass (visual review pending) | design notes D5/D7 in FEEDBACK.md |

### 2026-04-30 cowork session — retest pass on v91

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| RP1 | Drag stick (inv) → engine | +3 fuel, -1 stick | pass | ticket-20260430-0070 [verified] |
| RP2 | Drag stick-ingredient (grid) → engine | +3 fuel, ingredient consumed | pass | ticket-20260430-0070 [verified] |
| RP3 | Drag stone (inv/grid) and ore (grid) → engine | rejected | pass | ticket-20260430-0070 [verified] |
| RP4 | Drag stick → engine when furnace at 99/100 | clamps fuel to 100, consumes 1 stick | pass — same partial-fill semantics as [Feed Stick] button | ticket-20260430-0070 [verified] |
| RP5 | Desktop max-width: 8 standalone rows (header / #resources / .narration / #upgrades / #stats / etc.) at vw=1494 | width 960px, margins auto, no horiz scroll | pass | ticket-20260430-0080 [verified] |
| RP6 | Desktop max-width breakpoint scoped to `@media (min-width: 901px)` | mobile (≤900px) keeps full-width layout | pass — CSS rule confirmed scoped | ticket-20260430-0080 [verified] |
| RP7 | Display-layer clamp: sticks=-5, stones=-3, heat=-100, metal/alloy/gears/essence=neg | all UI cells render "0", no negative shows | pass | ticket-20260430-0090 [verified] |
| RP8 | Data-layer self-heal: save with negatives, reload | resources clamped to 0 on load (alongside NaN scrub) | pass | ticket-20260430-0090 [verified] |

### 2026-04-30 cowork session — bug-hunt sweep on v84

#### Phase 1 — heat decay edge cases

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| H1 | Sealed Crucible (decayRate=0) at heat=100, idle 3s | zero decay (no exp, no floor) | pass | — |
| H2 | Default decay (decayRate=0.005) at heat=100, idle 3s | ~1.5 heat decay (exponential ~0.5%/s) | pass | — |
| H3 | Sealed Crucible at heat=5 (where floor would normally kick in), idle 3s | zero decay (floor properly bypassed) | pass | — |

#### Phase 2 — recipe edge cases

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| R1 | Two valid +shapes simultaneously | returns first by row-scan order | pass | — |
| R2 | Recipe with one arm missing | no match | pass | — |
| R3 | Recipe + unrelated junk on grid | match found (anchor-free) | pass | — |
| R4 | Wrong center type (stone instead of fuel t1) | no match | pass | — |
| R5 | Wrong arm kinds (stones instead of sticks) | no match | pass | — |
| R6 | Center at corner (off-grid arms) | no match | pass | — |
| R7 | Wrong center tier (ember t2 instead of spark t1) | no match | pass | — |
| R8 | Repeated findRecipeMatch on same grid | deterministic same result | pass | — |

#### Phase 1→2 transition

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| TR1 | Old save loaded with peakHeat=2000 + empty `revealed{}` | reveal stages backfilled by checkReveals → narration doesn't replay | pass | — |
| TR2 | Fresh save progression: peakHeat 0→250→500→750→1000 | reveals fire at each threshold (sootBeat1/2/3, mergeGrid) | pass | — |
| TR3 | checkReveals() called repeatedly | idempotent — no double-fire | pass | — |

#### Negative / overflow inventory

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| N1 | sticks=-5 → click [Feed Stick] | feedStick rejects (no fuel added) | pass (logic) | — |
| N1b | sticks=-5 → check inv-tile-stick-count textContent | UI clamped to "0" | **fail — shows "-5"** | 0090 |
| N2 | sticks=99999999 → check UI | renders as raw "99999999" | pass (no NaN) | — |
| N3 | heat=Number.MAX_SAFE_INTEGER | renders as "9007.20T", finite | pass | — |
| N4 | heat=9.007e17 (beyond MAX) | renders as "900719.93T", finite | pass | — |
| N5 | heat=-100 → check UI | clamped to "0" | **fail — shows "-100"** | 0090 |
| N6 | fuel=-50 → check UI | clamped to "0 / 100" | pass — already clamped | — (reference for fix) |

#### Rapid-click race conditions

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| C1 | Spam-click [Feed Stick] 50× with sticks=100, fuel=0 | up to furnace cap (100) consumed proportionally; no drift | pass — 34 sticks consumed for 100 fuel, capped cleanly | — |
| C2 | Spam-click [Gather Stick] 5× rapidly, wait 6.5s | only 1 gather completes (4 sticks with Stick Basket); no double-fire | pass | — |
| C3 | Spam-click an unowned upgrade 10× | bought once, charged once | pass — 50 heat spent, owned ×1 | — |

### 2026-04-30 cowork session — additional Grove coverage on v84

| ID | Action | Expected | Result | Ticket |
|----|--------|----------|--------|--------|
| G7 | Inventory rail stone-tile glyph (post-fix) | `()` instead of `#` | pass | ticket-20260430-0041 [verified] |
| G8 | Grove scene exposes 4 stones + 11 sticks (post-fix) | 4×`()`, 11×`/` clickable | pass | ticket-20260430-0041 [verified] |
| G9 | Save+load preserves `collected` indices | pick 3, save+load, modal still shows 12 items, indices intact | pass | — |
| G10 | All-collected empty state | collect all 15, reopen → 0 items visible, no orphan `$` placeholders | pass | — |
| G11 | GROVE_LAYOUT_V migration | layoutV=1 + collected=[0..4], save+load → layoutV bumps to 3, collected resets to [] | pass | — |

| G12 | Body-scroll lock during grove modal | scroll y=400 → open → body becomes `position:fixed`, `top:-400px`, `overflow:hidden`, scrollY=0 → programmatic scrollTo blocked → close → all styles restored, scrollY back to 400 | pass | — |

### Open / TODO for Exploration
- [ ] `[X]` close button anchored to `safe-area-inset-top` / `safe-area-inset-right` (not testable from desktop browser tool — needs real mobile)
- [ ] Future: full-screen grove layout per ticket-20260430-0031 (Nicholas iterating)
- [ ] Future: visual passes per ticket-20260430-0040 (Nicholas iterating)
- [ ] Future: no-scrollbars + defined desktop frame per ticket-20260430-0080
- [ ] Grove respawn (v107): pick a stick, wait the full window (3+ min), reopen → stick is back; `respawnAt` entry cleared by `tickRespawns()`
- [ ] Grove respawn jitter (v107): pick all 15 items at once → respawn timestamps distribute across 1–3 min, NOT all simultaneous (sample `Object.values(game.locations.grove.respawnAt)`)
- [ ] Save migration (v107): force `game.locations.grove = { collected: [0,1,2], layoutV: 3 }`, save+load → `collected` deleted, `respawnAt: {}`, layoutV bumped to 4
- [ ] Save migration (v107): force a save with `locations.grove.layoutV: 4` and `respawnAt: {0: <future ts>}` → load preserves the timestamp (no reset)

---

## Phase 3 — Abandoned Quarry (v107)

Scope: world-map gating + pickaxe crafting + quarry modal + iron ore
mining + shared respawn behavior. New mechanics shipped in commit
`742308a` (`feat(quarry): build out the Abandoned Quarry`).

### Open / TODO

#### World-map forest gate

State setup: fresh save past Phase 1, axe NOT yet crafted, `game.stats.logsGathered = 0`.

| ID | Action | Expected |
|----|--------|----------|
| Q-G1 | Inspect grove → quarry connector on initial load (logsGathered=0) | `#quarry-connector` has `.forest-gated` class, leafy/mossy gradient visible |
| Q-G2 | Tap quarry node pre-gate (logsGathered=0) | toast: `Forest blocks the path (0 / 1 logs)`, narration `The path is choked with growth…`, modal does NOT open |
| Q-G3 | Set `game.stats.logsGathered = 1` (or actually gather a log), call `updateUI()` | `forest-gated` class strips off connector; `quarryUnlock` REVEAL_STAGE fires once (narration + screenFlash) |
| Q-G4 | Tap quarry node post-gate | quarry modal opens, body scroll locks, scene renders |
| Q-G5 | Reload page after Q-G3 | `quarryUnlock` already revealed; on next `updateUI()` the connector is clean (no replay of narration) |
| Q-G6 | `logsGathered` rolls over on a 32-bit signed int boundary | not applicable here, but verify `>= QUARRY_LOG_GATE` does NOT misfire if stat is undefined (should treat as 0) |

#### Pickaxe recipe

State setup: post-mergeGrid reveal, sticks ≥ 2, stones ≥ 3, no pickaxe in `keyItems`.

| ID | Action | Expected |
|----|--------|----------|
| Q-P1 | Place pickaxe shape on grid: 3 stones across (e.g. cells `[6,7,8]`) + 2 sticks below center (`[13,19]` if center is col-1) | `[Craft Pickaxe]` button surfaces below grid |
| Q-P2 | Tap `[Craft Pickaxe]` | 5 cells consumed, `keyItems` gains `{type:'pickaxe', id:…}`, Key Items bag count +1, recipe added to `discoveredRecipes` |
| Q-P3 | Open Key Items modal | pickaxe shows as `[T]` tile with title `Pickaxe` |
| Q-P4 | Place pickaxe shape again with pickaxe already in bag | `findRecipeMatch` skips (`canCraft` returns false), button does NOT surface |
| Q-P5 | Place 3 sticks + 2 stones (axe shape) + a stone elsewhere | axe matches first (`woodenAxe` is earlier in `RECIPES`); pickaxe shape would match too if axe is gone |
| Q-P6 | Pickaxe-recipe-hint trigger: clean save with sticks=2, stones=3, no pickaxe | `pickaxeRecipeHint` reveal fires once, narration plays, `flags.pickaxeRecipeTaught = true`; subsequent ticks don't refire |
| Q-P7 | Recipe panel rendering | `[Recipes ▾]` shows pickaxe entry once discovered, with `[#][#][#] / / · / / · / / ·` glyph pattern (3 stones top, sticks col-1 rows 1+2) |

#### Quarry modal — open / close lifecycle

State setup: post-gate, pickaxe in bag (or not, depending on test).

| ID | Action | Expected |
|----|--------|----------|
| Q-M1 | Open quarry modal | `body.style.position === 'fixed'` (scroll lock), scene rendered, `[Mine Iron Ore]` button visible at bottom |
| Q-M2 | Close via `[X]` (`quarry-leave`) | modal hides, body scroll restored to pre-open scrollY, no leftover `position:fixed` |
| Q-M3 | Close while mining is in progress | `cancelMineOre(false)` runs: timers cleared, `mineOreState === null`, fill bar reset to 0% |
| Q-M4 | Backgroud the tab (visibilitychange → hidden) while mining | `cancelMineOre(false)` fires from `onPageHide` (parallel to logGather/stickGather) |
| Q-M5 | Resize window with quarry modal open | `autofitQuarryScene()` re-runs, font-size recomputes, no scrollbars in scene |
| Q-M6 | Orientation change (mobile) | autofit fires after 2 rAFs, scene fits new viewport |

#### Iron-ore mining

State setup: pickaxe in bag, quarry modal open, ore nodes available.

| ID | Action | Expected |
|----|--------|----------|
| Q-O1 | Tap an `[O]` node WITHOUT pickaxe in bag | toast: `You need a pickaxe to mine iron ore.`, no progress bar, no respawn timer set |
| Q-O2 | Tap an `[O]` node WITH pickaxe | mining bar starts, `mineOreState !== null`, fill animates 0% → 100% over 30s |
| Q-O3 | Wait 30s for completion | `inventory.ironOre +1`, `stats.ironOreMined +1`, node hides, `respawnAt[id]` set 1–3 min in future |
| Q-O4 | Tap a different ore node mid-mining | current attempt cancels (no delivery), bar resets; second tap on a node would start a fresh mine (per current behavior — re-tap to re-arm) |
| Q-O5 | Tap the mining bar itself mid-mining | cancels (`cancelMineOre(false)`), bar resets, no ore delivered |
| Q-O6 | Mine all 3 ore nodes in one session | scene shows 5 stones still, 0 ore visible, `inventory.ironOre += 3`, `stats.ironOreMined += 3` |
| Q-O7 | Inventory rail iron-ore tile | hidden until `stats.ironOreMined > 0`; once mined, tile reveals showing `[O] N`, NOT draggable |
| Q-O8 | Save+load mid-mining | `mineOreState` doesn't persist (transient), bar gone after reload — no ghost progress; ore node still available (no respawn was set) |
| Q-O9 | Stat rollover: `stats.ironOreMined = 999` then mine 1 | reaches 1000, no NaN, tile renders `[O] 1000` cleanly |

#### Stone pickup (quarry)

| ID | Action | Expected |
|----|--------|----------|
| Q-S1 | Tap an `()` stone node | `inventory.stones +1`, node hides, `respawnAt[id]` set 1–3 min in future |
| Q-S2 | Tap a stone with NO pickaxe | works fine — pickaxe gating is for ore only, NOT stones |
| Q-S3 | Pick all 5 stones + all 3 ores in one session | `quarry-empty-row` message renders: `The rocks are picked clean — for now.` |

#### Respawn (shared mechanic across grove + quarry)

| ID | Action | Expected |
|----|--------|----------|
| Q-R1 | Pick 1 stone in quarry, force `Date.now()` 4 min later (or set `respawnAt[id]` to past), reopen modal | item respawned, clickable again, `tickRespawns()` cleared the entry |
| Q-R2 | Pick 1 stone, immediately reopen modal | stone NOT respawned yet (timer is 1–3 min), node still hidden |
| Q-R3 | Inspect `Object.values(game.locations.quarry.respawnAt)` after picking 5 items rapidly | timestamps span ≥30s range (not all identical — RNG jitter working) |
| Q-R4 | Save with respawnAt entries → load → wait through respawn window | timestamps preserved across save/load, items respawn at the right wall-clock time |
| Q-R5 | Long offline (close tab 30 min, reopen) | items with timestamps in the past respawn on next render; `respawnAt` map cleaned by `tickRespawns()` |

#### Save migration (v107)

| ID | Action | Expected |
|----|--------|----------|
| Q-MIG1 | Load a v106 save (grove uses `collected: [3,7]`, no quarry) | grove becomes `respawnAt: {}` (collected dropped — pre-launch grace), quarry seeded with `{respawnAt:{}, layoutV:1}`, no errors |
| Q-MIG2 | Load a save where `locations` is missing entirely | both grove + quarry seeded from `defaultGame.locations`, no errors |
| Q-MIG3 | Load a save with `inventory.ironOre` missing | defaults to 0 via inventory spread; no NaN; tile stays hidden |
| Q-MIG4 | Load a save with `stats.logsGathered` and `stats.ironOreMined` missing | both default to 0 via stats spread |

#### Visual / scene composition

| ID | Action | Expected |
|----|--------|----------|
| Q-V1 | Mountain ASCII renders aligned (no row drift) | every row is 40 chars wide post-pad; cave mouth `|____|` sits centered; framing slopes meet at the base |
| Q-V2 | Depth tinting applies row-by-row | sky rows fully transparent, far/midfar rows dim, near rows full opacity (parallel to grove) |
| Q-V3 | Empty-state row count | when all items gone: 1 spacer + 1 message + 1 spacer = 3 rows (matches non-empty 3-item-row count, no autofit jump) |
| Q-V4 | Mining bar fill color tint | cool grey-blue (distinct from log-gather's amber) |
| Q-V5 | Quarry modal at 380px viewport | rows fit without horizontal scroll; mountain still legible |
| Q-V6 | Quarry modal at landscape ≤500px tall | rotate-hint considered? (probably out of scope — no quarry-specific landscape lock) |

#### Cross-system integration

| ID | Action | Expected |
|----|--------|----------|
| Q-X1 | Pickaxe doesn't appear in axe's `KI_DISPLAY` slot or vice versa | axe shows `[/]`, pickaxe shows `[T]`, distinct tiles in the bag |
| Q-X2 | Iron ore doesn't accidentally drag-place onto grid | `draggable="false"` enforced; touchstart on tile doesn't initiate a drag |
| Q-X3 | Phase 1 bootstrap with no axe / no logs / no quarry visible | quarry node still rendered (visible from start) but tapping shows the gate toast; no errors from undefined paths |
| Q-X4 | Forest-gated connector accessibility | `aria-hidden="true"` on the span (decorative), no screen-reader noise; the gate state surfaces via the toast/narration on quarry-node tap |

---

## Cross-cutting

### Save/load

- [ ] Export save modal: opens, shows base64 envelope text + QR code rendering
- [ ] Import save: paste known-good code → restores all state (resources, inventory, satchel, grid, keyItems)
- [ ] Save migration: load a pre-v78 save (before alloyFrac/metalFrac existed) → no NaN, fields default to 0
- [ ] Save migration: load a save where automation.amplifiers is missing → no NaN heat (ticket-20260430-0060)
- [ ] Auto-save: after 30s OR on visibilitychange:hidden, verify localStorage.alchemistsEngine updates

### Achievements

- [ ] Achievement check interval (500ms): all achievements trigger when their `check()` returns true
- [ ] Achievement toast appears on first trigger only (no re-fire on subsequent ticks)
- [ ] Specific Phase 1 / Phase 2 / Grove achievements: which IDs are reachable in scope?

### Console

- [ ] No console errors on load (already checked once; clean)
- [ ] No console errors during specific actions: gather, feed, merge, drag-burn, craft, grove-pick

### Visual / responsive

- [ ] Layout at 380px viewport (CSS breakpoint) — couldn't reach via browser tool's resize floor (~500px)
- [ ] Landscape rotation hint at ≤500px tall (touch-only media query — not testable on desktop)
- [ ] PWA install / service worker reload on version bump

---

## How to add a row

When running a new test:
1. Append it to the matching area's table.
2. Use a date-stamped subsection if doing a fresh batch.
3. If the test fails or surfaces something interesting, file a ticket in `inbox.md` and reference its ID in the **Ticket** column.
4. Move items from the **Open / TODO** list into the main table once they've been run.
