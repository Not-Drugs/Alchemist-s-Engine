# Cowork Playtest Ticket Protocol

Two Claude sessions collaborate via one append-only markdown file:

- **cowork-Claude** — runs in a browser-automation session, can navigate
  to the live game, click through flows, and visually verify behavior.
  Files tickets when it finds bugs and verifies fixes after they ship.
- **terminal-Claude** — runs in the user's local Claude Code session,
  has full repo + shell access. Claims tickets, fixes in code, pushes,
  and marks for retest.

Both sides read and write `cowork/inbox.md`. Replies are co-located with
the ticket they reply to.

## Ticket format

Cowork appends a new heading block per ticket:

    ## ticket-YYYYMMDD-HHMM [new]
    SEVERITY: low | normal | high
    ENV: desktop Chrome 124 / mobile emulation iPhone 14 / etc.
    WHAT: One-sentence description of the bug.
    EXPECTED: One-sentence description of what should have happened.
    STEPS:
    1. Open <url>.
    2. Click <thing>.
    3. Observe <wrong behavior>.
    ATTACHMENTS: cowork/attachments/<filename>.png

- ID format: `ticket-YYYYMMDD-HHMM`. Local time. Goal is collision-free
  uniqueness within a session.
- `SEVERITY` is informational. Terminal-Claude reads all `[new]` tickets
  in chronological order.
- `ATTACHMENTS` is optional. Files live at `cowork/attachments/<name>`.
  Path is repo-relative.

### ID convention — who can use which range

To prevent the "ticket hijack" race condition where two sides write the
same ID concurrently and one side overwrites the other's body (this
happened with ticket-20260430-0040 — terminal opened it for a stone fix
and cowork overwrote the body with the AAA visual plan), each side
reserves its own slot:

- **Cowork** files standard 4-digit IDs: `ticket-YYYYMMDD-NNNN` (e.g.
  `ticket-20260430-0042`). This is the bulk of traffic.
- **Terminal-on-user-behalf** files prefixed IDs:
  `ticket-YYYYMMDD-U-NNN` where the `U-` marks "user-direct" (a
  Nicholas-originated request that terminal converted into a ticket
  for the cowork channel). Three digits after the prefix is enough.
  Example: `ticket-20260430-U-041`.
- **Self-collisions are still avoided** by checking the inbox before
  filing — pick the next free number in your range.

Either side reads BOTH ranges as actionable; the prefix is only about
write-side ownership. Cowork shouldn't repurpose a `U-` ticket's body;
terminal shouldn't repurpose an unprefixed cowork ticket's body. If
either side disagrees with a ticket's framing, file a NEW one and
cross-reference, don't rewrite.

## Status lifecycle

| Status               | Meaning                                                | Next actor       |
|----------------------|--------------------------------------------------------|------------------|
| `[new]`              | Cowork just filed; waiting for me to look              | terminal-Claude  |
| `[claimed]`          | Terminal-Claude is working on it                       | terminal-Claude  |
| `[needs-info]`       | Terminal bounced back; cowork must respond             | cowork-Claude    |
| `[ready-for-retest]` | Fix pushed; cowork must rerun the repro                | cowork-Claude    |
| `[verified]`         | Cowork confirmed in the browser; ticket closed         | (closed)         |
| `[reopened]`         | Retest failed; treated like `[new]` for routing        | terminal-Claude  |
| `[needs-human]`      | Stuck — neither Claude can make progress alone         | user (Nicholas)  |

Flow:

    [new] -> [claimed] -> [ready-for-retest] -> [verified]
                |                 |
                v                 v
            [needs-info]      [reopened] -> back to [new]

    Any active status -> [needs-human] -> (user resolves to any status)

When a side acts on a ticket it rewrites the status in the heading AND
appends a comment. The heading is the only line that gets edited.
Everything else is append-only.

## `[needs-human]` — escape hatch

Either Claude side flips to `[needs-human]` when a ticket is stuck and
needs the user (Nicholas) to step in. Common cases:

- Terminal can't reproduce the STEPS in any environment available
  locally, and `[needs-info]` already bounced once with no progress.
- Cowork's repro succeeds in the browser but terminal disagrees that
  it's a bug — needs a human triage call.
- A fix landed and cowork's retest fails, but terminal can't tell
  whether the retest is wrong or the fix is wrong.
- Two-Claude back-and-forth without convergence.

The flipping side appends a comment naming the specific decision the
user needs to make:

    > claude-terminal 2026-04-29 16:10: Cannot reproduce on desktop
    > Chrome 124 or mobile emulation. Cowork sees it on Pixel 7
    > hardware which I can't simulate. Need user to confirm on their
    > actual phone whether this is real. [needs-human]

The user reads, takes whatever out-of-band action is needed, then flips
the status to one of: `[claimed]` (terminal: try again with this info),
`[ready-for-retest]` (cowork: I fixed it directly, verify),
`[verified]` (closed as not-a-bug or out-of-scope), or `[reopened]`
(terminal: pick this back up).

Both Claude loops **skip** `[needs-human]` tickets. They belong to the
user.

## Concurrency

Both sessions read and write the same `inbox.md`. Three properties keep
it safe without file locks:

1. **Single mutator per state.** The "Next actor" column is a
   convention enforced by the loop prompts. Terminal only writes
   `[new]`/`[reopened]`; cowork only writes `[ready-for-retest]`/
   `[needs-info]` it opened. The other side reads but does not write.
2. **Append-only comments.** Reply blocks always append to the end of
   the per-ticket section. No comment is ever rewritten. The only line
   that mutates is the heading's status flag.
3. **Self-paced loops.** Both sides sleep between actions. Genuine
   write-write collisions are vanishingly rare in practice.

If a collision does happen, manually fix the heading — never delete or
rewrite a comment. When statuses disagree, flip to `[needs-human]` and
let the user adjudicate.

`[verified]` block deletion (lean-up) is the one structural action.
Do it infrequently, only when no other side is active in the same
minute.

## Replies (co-located with the ticket)

Append blockquoted comments directly under the ticket they relate to.
Sign and timestamp each comment:

    > claude-terminal 2026-04-29 14:32: Claimed. Looking at engine
    > drag handler — engineDropOnCell may not check fromSatchel.
    > claude-terminal 2026-04-29 14:55: Fixed in commit abc1234.
    > Pushed; Pages should rebuild within ~60s. [ready-for-retest]
    > claude-cowork 2026-04-29 14:58: Hard-refreshed, repro'd the
    > steps, spark merges cleanly now. [verified]

- Sign as `claude-terminal` or `claude-cowork`.
- Timestamps are local time (whatever the writer's environment reports).
- Don't rewrite or edit older comments — append only.

If a ticket needs `[needs-info]`, the comment must say what's missing:

    > claude-terminal 2026-04-29 14:32: Need browser zoom level and
    > whether the engine ASCII was animating when the drag started.
    > [needs-info]

## Lean-up

Either side may evict `[verified]` ticket blocks periodically to keep
`inbox.md` small. **Never** evict tickets in any other status. Don't
delete attachments referenced by un-`verified` tickets.

Eviction is a **two-step move, not a delete**:

1. **Append the full ticket block** (heading, body, every comment) to
   `cowork/archive.md`, prefixed with `archived <local time> (by
   claude-terminal|claude-cowork):` so the audit trail survives.
2. **Then remove the block from `inbox.md`.** Verify the archive
   write landed before deleting.

`cowork/archive.md` is append-only and gitignored, same as `inbox.md`.
Don't rewrite or trim older archive entries — fold the oldest year
into `archive-YYYY.md` if the file gets unwieldy.
