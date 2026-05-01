# Dispatch Log

A changelog for work shipped through Dispatch sessions. Newest first.

Each entry: date — short description — commit SHA (filled in after the
commit lands). When a session bundles several features, list them as
sub-bullets so the SHA references the merged state.

---

## 2026-04-30 — Functional golems + abandoned quarry node

Two new player-facing systems plus DISPATCH_LOG bring-up. The axe +
logs feature was scoped out of this session (handled by a separate
parallel session).

- **Stick Golems become functional.** The existing 4-sticks-around-a-Spark
  recipe still produces golems into the Key Items bag, but golems are
  no longer inert — they can now be **deployed** (from the Key Items
  modal) to gather sticks and feed the engine automatically.
  - Each active golem performs one action every `GOLEM_ACTION_MS`
    (5 seconds). An action costs **1 heat**. If sticks are available
    and the furnace has room, the golem feeds one stick (–1 stick,
    +`STICK_FUEL_VALUE` fuel). Otherwise it gathers (+1 stick to
    inventory, also counts toward `sticksGathered`). When heat is
    below the action cost, golems idle silently — they don't burn
    the last drop of heat trying to act.
  - Max active golems is tied to **furnace level**. Pre-`efficiency3`
    (Arcane Vents, 1000 heat) is Level 1 → 1 golem max. Post-purchase
    is Level 2 → 2 max. Deploy/Recall live in the Key Items modal as
    `[+]` / `[-]` controls under the grouped golem tile, which now
    shows `Nx (active/max)`.
  - A `Golems: N/M active` status line appears in the stick controls
    panel once at least one golem is in the bag, with a tail hint
    that switches between `idle in bag`, `gathering & feeding`, and
    `no heat — paused`.
  - Transient per-golem accumulators live in module-level vars
    (`_golemAccums`, `_golemLastActions`); only the active count
    persists in `game.golems.active`.
- **Abandoned Quarry** — third node on the world map (after the engine
  and the grove). Visual only for now: a distinct rocky-peaked ASCII
  icon in a cool grey-blue tint that reads as stone outcrop, separate
  from the grove's solid filled box. Tapping it surfaces the
  description ("An old quarry. Metal ore glints in the rock face.")
  via narration plus a "coming soon" toast. The connector + node slot
  in `#location-grove`'s `.explore-map` is now the template for adding
  further locations.
- Bumped `APP_VERSION` and `CACHE` to v103 (lock-step).
- Seeded this DISPATCH_LOG.md as the changelog for Dispatch-shipped
  work.

Commit: `bb52032` (single bundled commit on the dispatch branch).
