# Cowork Playtest Inbox

A ticketing channel between two Claude sessions:

- **Cowork-Claude** — runs in a browser-automation VM, plays Alchemist's
  Engine in a real browser, can see the rendered DOM, click through flows,
  and visually verify behavior.
- **Terminal-Claude (me)** — runs in the user's local Claude Code session,
  has full repo + shell access, edits and commits code.

Cowork files tickets when it finds bugs. I claim, fix, push, and mark
`[ready-for-retest]`. Cowork re-runs the repro in the browser and either
`[verified]`s or `[reopened]`s. Round-trip closes because cowork can
*see the app*; I can't.

## Why this isn't a straight copy of the dnd map maker `cowork/`

The dnd map maker's `cowork/` directory uses split inbox/outbox files
because the conversation there is open-ended (questions, status updates,
help requests). Tickets are a narrower shape with a defined lifecycle, so:

- One `inbox.md` instead of `inbox.md` + `outbox.md`. Replies live as
  blockquoted comments under each ticket — the whole conversation per
  bug reads top-to-bottom in one place.
- Status verbs are bug-tracker-shaped (`new`, `claimed`,
  `ready-for-retest`, `verified`, `needs-info`, `reopened`), not the
  dnd-style `[pending]`/`[done]`.
- No `FROM:` field. Single cowork instance at a time; reporter identity
  is implicit.
- No human-tester instruction card. Both sides are Claude.

## Directory layout

```
cowork/
├── README.md       (committed) — how to bring up both loops; pasteable prompts
├── PROTOCOL.md     (committed) — ticket format reference
├── inbox.md        (gitignored) — tickets + replies, append-only
└── attachments/    (gitignored) — screenshots cowork captures
```

`inbox.md` and `attachments/` are runtime state. README.md and
PROTOCOL.md describe the protocol and stay committed.

## Ticket format

Cowork appends a heading block per ticket:

```markdown
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
```

ID format: `ticket-YYYYMMDD-HHMM`. Local time is fine; the goal is
collision-free uniqueness within a session, not absolute ordering.

`SEVERITY:` semantics — informational only, doesn't gate work. I read
all `[new]` tickets in order.

`ATTACHMENTS:` is optional. If included, the file lives at
`cowork/attachments/<name>` and the path is repo-relative.

## Status lifecycle

```
[new] ─────────► [claimed] ─────────► [ready-for-retest] ─────► [verified]
                    │                          │
                    ▼                          ▼
                [needs-info]               [reopened] ──┐
                    │                                   │
                    └─────── (cowork answers) ──────────┘
                                back to [new]

Any active status ──► [needs-human] ──► (user resolves to any status)
```

| Status              | Meaning                                                    | Next actor                   |
|---------------------|------------------------------------------------------------|------------------------------|
| `[new]`             | Cowork just filed; waiting for me to look                  | terminal-Claude              |
| `[claimed]`         | I'm working on it                                          | terminal-Claude              |
| `[needs-info]`      | I bounced back with a question; cowork must respond        | cowork-Claude                |
| `[ready-for-retest]`| Fix pushed; cowork must rerun repro                        | cowork-Claude                |
| `[verified]`        | Cowork confirmed the fix in browser; ticket closed         | (closed)                     |
| `[reopened]`        | Retest failed; treat like `[new]`                          | terminal-Claude              |
| `[needs-human]`     | Stuck — neither side can make progress without the user    | user (Nicholas)              |

When a side acts on a ticket, it rewrites the status in the heading
(e.g. `## ticket-... [new]` → `## ticket-... [claimed]`) AND appends a
comment.

### `[needs-human]` — escape hatch

Either Claude side flips to `[needs-human]` when it gets stuck and the
user has to step in:

- Terminal can't reproduce the bug from cowork's STEPS, the env doesn't
  match anything I can run locally, and `[needs-info]` already bounced
  once with no progress.
- Cowork's repro succeeds in the browser but terminal disagrees that
  it's a bug (e.g. it's intended behavior) — needs a human triage call.
- A fix landed and cowork's retest still fails, but terminal can't tell
  whether the retest is wrong or the fix is wrong.
- Anything else where two Claude sessions are looping without making
  progress.

The flipping side appends a comment that names the decision the user
needs to make:

```
> claude-terminal 2026-04-29 16:10: Cannot reproduce the satchel-merge
> bug on desktop Chrome 124 or mobile emulation. Cowork sees it on
> Pixel 7 hardware which I can't simulate. Need user to confirm on
> their actual phone whether this is real. [needs-human]
```

The user reads, takes an out-of-band action (reproduces in their own
browser, makes a call on intended-vs-bug, etc.), then flips the status
to whatever the resolution is — `[claimed]` (terminal: here's what I
saw, try again), `[ready-for-retest]` (cowork: I fixed it directly,
verify), `[verified]` (closed as not-a-bug or out-of-scope), or
`[reopened]` (terminal: pick this back up with this new info).

Both Claude loops **skip** `[needs-human]` tickets. They are owned
exclusively by the user.

## Concurrency

Both sessions read and write the same `inbox.md`. Three properties keep
this safe without locks:

1. **Single mutator per state.** The "Next actor" column above is a
   convention enforced by the loop prompts: terminal only acts on
   `[new]`/`[reopened]`, cowork only acts on `[ready-for-retest]` and
   `[needs-info]` it opened. At any moment a ticket has exactly one
   valid mutator. The other side reads but does not write.
2. **Append-only comments.** Reply blocks are always appended to the
   end of the file's per-ticket section. No comment is ever rewritten.
   The only line that mutates is the heading's status flag.
3. **Self-paced loops.** Both sides sleep between actions (10–30+
   minutes when idle). The window where two sides edit at the same
   instant is small enough that genuine collisions are vanishingly
   rare in practice.

If a collision does happen (heading edited twice, comments interleaved
strangely), either side may manually clean up the heading — but
**never** delete or rewrite a comment, and never resolve a status
disagreement by force. When in doubt, flip to `[needs-human]` and let
the user adjudicate.

`[verified]` block deletion (lean-up) is the one action that touches
the file structurally beyond a single ticket. Do it infrequently and
only when no other side is active in the same minute.

## Replies (co-located with the ticket)

Both sides append blockquoted comments directly under the ticket they
relate to. Comments are signed and timestamped:

```markdown
> claude-terminal 2026-04-29 14:32: Claimed. The engineDropOnCell path
> doesn't account for fromSatchel touches — patching now.
> claude-terminal 2026-04-29 14:55: Fixed in commit 8eb73b5. Pushed,
> Pages should rebuild within ~60s. [ready-for-retest]
> claude-cowork 2026-04-29 14:58: Hard-refreshed, repro'd the steps,
> spark merges cleanly now. [verified]
```

Sign as `claude-terminal` or `claude-cowork`. Timestamps are local
time (whatever the writer's environment reports). Don't rewrite or
edit older comments — append-only.

If a ticket needs `[needs-info]`, the comment must say what's missing:

```markdown
> claude-terminal 2026-04-29 14:32: Can you share the browser zoom
> level and whether the engine ASCII was animating when the drag
> started? Need both to repro. [needs-info]
```

## Polling — two loops

Both sides run a `/loop` with self-paced cadence. The pasteable prompts
live in `cowork/README.md`.

### Terminal-Claude (me) loop

```
/loop check cowork/inbox.md for tickets in [new] or [reopened] status.
For each, in order: read it, claim by setting [claimed] and appending a
'claimed' comment with what you intend to investigate. Reproduce in the
codebase, fix, commit, push to main. Set status to [ready-for-retest]
and append a comment with the commit SHA. If repro is unclear or env
is missing, set [needs-info] and ask in a comment for what's missing.
Skip tickets in [claimed], [needs-info], [ready-for-retest], or
[verified]. If nothing is actionable, do nothing and exit until the
next tick.
```

Self-paced (no fixed interval) — when nothing's actionable, sleep
~10–20 minutes; when a ticket is mid-work, sleep shorter.

### Cowork-Claude loop

```
/loop check cowork/inbox.md for tickets in [ready-for-retest] status
or [needs-info] status that you opened. For [ready-for-retest]: hard-
refresh the test URL, redo the STEPS exactly, capture a screenshot to
cowork/attachments/, then mark [verified] or [reopened] with a comment
explaining what you saw. For [needs-info]: answer the question in a
comment and set status back to [new]. If you can't make progress on a
ticket (terminal disagrees it's a bug, fix doesn't work and you can't
tell if the fix or the test is wrong, etc.), set [needs-human] with a
comment naming the decision the user needs to make. Skip [needs-human]
— those are owned by the user. While idle, continue active playtesting
and file new tickets when bugs surface.
```

Cowork's loop is also self-paced.

### Cowork's per-turn check

Beyond the `/loop`, the cowork bring-up prompt instructs the session to
**read `cowork/inbox.md` at the start of every turn** (every assistant
message), not only when the loop fires. Rationale: cowork is doing
active in-browser work between loop ticks, and replies from terminal
should be picked up immediately rather than waiting for the next tick.
The /loop is the safety net for idle periods, not the only trigger.

## Bring-up

### Cowork side

1. User starts cowork session in the browser-automation environment
   with the standard cowork prompt (in this repo's `cowork/README.md`).
2. Cowork navigates to the test URL. Default is the GitHub Pages
   deploy; user may override with a local server URL if testing
   un-pushed changes (cf. dnd map maker's `cowork.md` notes about
   localhost reachability — same constraint applies).
3. User pastes the cowork loop prompt to start the polling loop.

### Terminal side

1. User opens this repo in Claude Code.
2. User pastes the terminal loop prompt to start polling.
3. Terminal-Claude is now watching `inbox.md`.

## Deploy gap

When I push a fix, the live GitHub Pages URL takes ~30–60s to rebuild.
The `[ready-for-retest]` comment includes the commit SHA so cowork can
hard-refresh and verify the build is current (e.g. by checking the
`APP_VERSION` label in the corner). If cowork retests too early and
sees the old build, the right move is to wait and retry, not to mark
`[reopened]`.

For testing un-pushed changes, the user runs a local server on their
Windows host (the cowork sandbox cannot reach localhost reliably
without that — same gotcha as dnd map maker, documented in its
`cowork.md`). Cowork-Claude points its browser at the user's
localhost URL.

## Gitignore

Add to `.gitignore`:

```
cowork/inbox.md
cowork/attachments/
```

`README.md` and `PROTOCOL.md` are committed because they describe the
protocol; the conversational state is not.

## Lean-up

Either side may delete `[verified]` ticket blocks periodically to keep
`inbox.md` small. **Never** delete tickets in any other status. Don't
delete attachments referenced by un-`verified` tickets.

## Out of scope (v1)

- No labels / tagging beyond `SEVERITY`.
- No assignment to specific terminal-Claude instances (only one runs
  at a time; future multi-instance support could add an `OWNER:` field).
- No automation of cowork bring-up — the user copy-pastes prompts.
- No backlog / triage view; tickets stay in `inbox.md` chronologically.
- No PLAYTEST.md for human testers (separate spec if that's added later).
