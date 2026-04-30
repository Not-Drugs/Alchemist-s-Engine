# Cowork Backlog

Nicholas-flagged deferred ideas — features and design moves to entertain
later. Distinct from:
- `cowork/inbox.md` — active tickets being worked now
- `cowork/PRE_PROD_CHECKLIST.md` — hardening required before launch
- `cowork/FEEDBACK.md` — cowork-Claude's playtest observations

When a backlog item is ready to ship, file it as a fresh ticket in
`inbox.md` with a `[new]` status and reference this file's heading.

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
