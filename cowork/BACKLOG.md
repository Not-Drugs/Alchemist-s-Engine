# Cowork Backlog

Nicholas-flagged deferred ideas — features and design moves to entertain
later. Distinct from:
- `cowork/inbox.md` — active tickets being worked now
- `cowork/PRE_PROD_CHECKLIST.md` — hardening required before launch
- `cowork/FEEDBACK.md` — cowork-Claude's playtest observations

When a backlog item is ready to ship, file it as a fresh ticket in
`inbox.md` with a `[new]` status and reference this file's heading.

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
  from CLAUDE.md is fleshed out — mountains might tie into a larger
  spatial-meta-layer rather than just grove decoration
