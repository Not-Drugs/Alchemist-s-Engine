# Cowork Backlog

Nicholas-flagged deferred ideas — features and design moves to entertain
later. Distinct from:
- `cowork/inbox.md` — active tickets being worked now
- `cowork/PRE_PROD_CHECKLIST.md` — hardening required before launch
- `cowork/FEEDBACK.md` — cowork-Claude's playtest observations

When a backlog item is ready to ship, file it as a fresh ticket in
`inbox.md` with a `[new]` status and reference this file's heading.

---

## Quarry: bump log-gate from 1 → 5 before public launch

**Test value (2026-05-01):** `QUARRY_LOG_GATE = 1` in `game.js`. One log
clears the dense forest, which is fine while iterating but trivial for
a real player. Pre-launch action: bump to 5 (or whatever feels right
after playtesting) so the quarry actually feels earned and so the
forest-gated connector + progress toast are visible long enough to
register. When bumping, also re-check the unlock narration — at 5 logs
the message is a more meaningful payoff.

---

## Split `game.js` into focused modules (token efficiency)

**Concept (Nicholas, 2026-05-01):** `game.js` is ~5000 lines and gets
re-read in fragments by every Claude session. Splitting into focused
files (candidates: `golems.js`, `grove.js`, `crafting.js`, `save.js`,
`ui.js`, plus a slim `game.js` core) would let future sessions Read
just the relevant slice instead of paging through the whole file.

No build step needed — vanilla `<script>` tags in dependency order
work fine. Biggest single token-efficiency win available, but
invasive: bump `CACHE` shell list, every cross-module reference
becomes a global, and the migration commit will be huge. Plan as
its own ticket when ready; do not bundle with feature work.

Secondary cuts to consider in the same pass: `.claudeignore` at
repo root for `_research/` and shipped `docs/superpowers/plans/*`,
and archive the crafting plan (1300+ lines) under
`docs/superpowers/archive/` once it's no longer load-bearing.

---

## Stronger golem variants for log + stone gathering

**Concept (Nicholas, 2026-05-01):** The Stick Golem only gathers
sticks. To unlock log-chopping (axe-tier) and stone-quarrying
(quarry-tier) the player crafts more powerful golem variants —
each with its own recipe, key-item type, and assignment job. The
infrastructure is already in place: `game.golems.assignments` is a
`{ jobKey: count }` map and `processGolems` iterates `GOLEM_JOBS`,
so adding a `logs` or `stones` job is a small extension once the
new craftable golem types exist. Recipes and gating TBD; likely
require the Wooden Axe / first quarry visit as prerequisites.

---

## Grove: litter rows in the forest-floor zone (was pass D of ticket-0040)

**Idea (Nicholas, 2026-04-30, after testing v96):**
"I like the idea but the fallen branch doesn't look great we can
re try later." Initial implementation reverted from main; revisiting
with better ASCII later.

**Concept:** Two rows of forest-floor detail sit between the near
mid-band and the trunks-only sky rows of the grove scene — fallen
branches, low stumps, bracken. Reads as forest understory you walk
through, not empty space the eye glides past.

**v96 attempt (commit 8800e4d, reverted):**
```
'   .  \__,    /,    .  '   fallen branch + leaning sapling
'  ,;'  .   |_|   ,;'   '   bracken + low stump
```
Rendered at `'midnear'` depth class. The fallen-branch silhouette
specifically didn't read clearly — the `\__,` shape is ambiguous,
could be branch / arrow / random punctuation. Stump (`|_|`) and
bracken (`,;'`) tufts read better but together with the bad branch
the row felt cluttered.

**Iteration ideas:**
- Try clearer fallen-log glyphs: `===` or `~~~~` for a horizontal
  log; `|=|` chunks for cut wood. Avoid backslash-comma combos.
- Three rows instead of two? Spread the elements so each gets
  breathing room.
- Match the depth tinting of the framing-tree trunks at the same
  height — currently `midnear` (~0.85), but maybe `mid` (0.68)
  would push the litter further back so it's atmosphere, not focus.
- Reference some real ASCII tree-litter art from `_research/ascii-trees/`
  if there's anything there.

**Trade-off if shipped:** total scene rows would push from 35 to 37,
shrinking the trunks-only sky from 8 rows to 6. Auto-fit JS handles
the size change but it tightens the visual breathing room.

---

## Grove: mountain range as final background layer

**Idea (Nicholas, 2026-04-30, after pass C of ticket-0040):**
"add a backlog item to entertain making a mountain range as the final
background layer."

**Concept:** Beyond the distant treeline (currently the deepest visible
layer of the grove scene), introduce a mountain-silhouette layer
behind it as the absolute farthest depth. Reads as truly distant
geography — the eye registers "this forest sits in a valley" rather
than "this is just a flat horizon."

**Implementation sketch:**
- Add a `MOUNTAIN_RIDGE` constant — multi-row ASCII silhouette,
  probably 2–3 rows tall, low jagged shape (e.g. `. /\ /\ . /^\ . `)
- Render BEHIND the existing horizon stipple / distant treeline
  rows. Could be:
  - Above row 0 (pushing scene up) — adds 2-3 rows to top
  - At row 0 with the horizon ridge OVERLAID on it (per-char
    overlay similar to canopy work in v93)
- Use a NEW depth class even fainter than `horizon` (e.g.
  `peaks` at opacity ~0.12, color a dim cool grey-blue) so it
  reads as far-away geography rather than near forest
- Could move with parallax if we ever do scrolling, but for v1
  static is fine

**Trade-offs:**
- Adds visual depth / sense of place
- Eats 2–3 more scene rows → tightens the auto-fit math; might
  push trunk fade gradient down or shrink mid-band proportions
- Color/opacity tuning is delicate (mountains too prominent
  competes with the ridge break in pass C; too faint and they're
  invisible)

**Related work to land first:**
- Pass F, D, E, B of ticket-0040 (other grove polish)
- Maybe wait until "environment / terraforming + buildings" idea
  (below) is fleshed out — mountains might tie into a larger
  spatial-meta-layer rather than just grove decoration

---

## Click-automation upgrades

Gate hold-to-fire / auto-click on spark, feed-stick, ore, and craft
buttons behind upgrades (e.g. a workshop "Tireless Hands" line).
Manual clicking stays the default early-game work; automation is
something the player earns. See `feedback_input_design.md` memory —
we explicitly chose manual clicks over hold-to-fire as the default.

---

## Revisit heat ↔ temperature coupling

Current model treats them as parallel, independent outputs of the
burning furnace: heat rate is flat (10/s × bonuses) and temperature
is a separate state driven by fuel volume (target = `fuel × 5`,
cap 1000). Scientifically defensible — temperature is intensive,
heat is extensive — but there's room to make them feel more
connected.

**Options to weigh later:**
- Temperature multiplier on heat rate (hotter → more heat/s)
- Temperature decay during burn if fuel is too little to sustain it
- Specific-heat-style ramp where the first seconds of a fresh burn
  deliver less heat until the furnace warms

**Caution:** don't change without re-tuning the early economy; the
current numbers are balanced around the flat-rate assumption.

---

## Runic unlock slots (visual upgrade)

Re-skin the convenience-button unlock slots (currently a plain
dashed-border box reading "Drop a Blazite to forge [+] Spark") into
something more thematic — engraved runic altars where the required
symbol is etched faintly into the slot and lights up when the player
places a matching item on it.

**Sketch:**
- Box-drawing characters for the frame
- The FUEL_TIERS / ORE_TIERS `::before` glyph as the placeholder rune
- Small flash + sigil burn-in animation when consumed

Mechanics are settled (one item, one unlock); this is purely a visual
upgrade on top of the existing UNLOCK_SLOTS pipeline.

---

## Environment / terraforming + buildings (meta-layer)

Reframe the game's setting: the player has woken in a magically
blighted landscape and the engine's heat/output is what they use
to slowly heal it. Each tier or milestone could unlock a piece of
terrain that's currently dead — soil that becomes grass, a frozen
river that thaws, a stand of charred trees that regrows — and let
the player place buildings on the reclaimed land (shelter, well,
kiln, greenhouse, etc.) that produce passive bonuses or new resources.

This becomes the spatial/visible meta-layer on top of the existing
engine/merge/prestige loop, giving heat a destination beyond pure
numbers.

**Open questions when revisiting:**
- Tile-based map vs. a scrolling diorama of ASCII vignettes
- Whether buildings cost heat / alloy / essence / something new
- Whether terraforming progress persists through prestige (probably
  yes — it's the meta layer)

---

## Other unsorted future ideas (one-liners from CLAUDE.md)

- More automation buildings
- Research tree
- Multiple furnaces
- More prestige layers
- Richer SFX library (currently 9 synthesized sounds)
- Cloud save sync (currently portable save codes only)
