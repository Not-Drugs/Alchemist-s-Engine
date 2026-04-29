# Cowork Playtest Channel

A file-based ticketing channel between two Claude sessions:

- **cowork-Claude** — browser-automation session, plays the game and
  visually verifies fixes.
- **terminal-Claude** — this Claude Code session, fixes bugs in code.

Format and lifecycle are defined in `cowork/PROTOCOL.md`. This file is
the operational "how do I start it" guide.

```
cowork/
├── README.md       you are here
├── PROTOCOL.md     ticket format + status lifecycle reference
├── inbox.md        runtime state, gitignored, append-only
└── attachments/    runtime state, gitignored
```

## How to use

### Quick start (preferred)

In either session, type one of these and the agent will do the rest
(read this file, identify which side, start the right `/loop`):

- `/cowork` — slash command (works in Claude Code via
  `.claude/commands/cowork.md`)
- `enter cowork mode` / `enter ticket mode` / `cowork mode` /
  `ticket mode` — natural-language phrases recognized via CLAUDE.md

The detailed steps below are the manual fallback if the shortcut
doesn't work in your environment (e.g. a Claude session without
CLAUDE.md or slash-command support).

### 1. Bring up the test target

Cowork needs a URL to test against:

- **GitHub Pages** (default) — the live deploy. Pushes to `main`
  rebuild within ~30–60s. Best for testing already-shipped behavior
  and for verifying fixes after `[ready-for-retest]`.
- **Local server** — for testing un-pushed local changes. The user
  runs a static server on their Windows host (e.g. `python -m http.server`
  in the repo root) and tells cowork to point at the localhost URL.
  Cowork's sandbox cannot host the server itself reliably (same
  constraint as the dnd map maker — see that repo's `cowork.md` for
  the gory details).

### 2. Start the terminal-Claude polling loop

In this Claude Code session, paste:

```
/loop check cowork/inbox.md for tickets in [new] or [reopened] status.
For each, in order: read it, claim by setting [claimed] and appending
a 'claimed' comment with what you intend to investigate. Reproduce in
the codebase, fix, commit, push to main. Set status to
[ready-for-retest] and append a comment with the commit SHA. If repro
is unclear or env is missing, set [needs-info] and ask in a comment
for what's missing. If you can't reproduce after [needs-info] bounced
once, or you disagree it's a bug, or you can't tell whether the fix or
cowork's retest is wrong, set [needs-human] with a comment naming the
specific decision the user needs to make. Skip tickets in [claimed],
[needs-info], [ready-for-retest], [verified], or [needs-human]. If
nothing is actionable, do nothing and exit until the next tick.
```

Self-paced — when nothing's actionable, it sleeps ~10–20 min; when
mid-fix, it sleeps shorter.

### 3. Start the cowork-Claude polling loop

In the cowork browser session, after pointing at the test URL, paste:

```
You are cowork-Claude on the Alchemist's Engine playtest channel.
Your partner is a terminal-Claude session on the user's local
machine that fixes code based on tickets you file. The full protocol
is in cowork/PROTOCOL.md — read it before you do anything else.

Channel files (in the repo you have access to):
- cowork/inbox.md       append-only ticket file, both sides write here
- cowork/PROTOCOL.md    ticket format + status lifecycle reference
- cowork/attachments/   screenshots you capture (PNG)

Your responsibilities:
1) FILE TICKETS while playtesting. When you find a bug in the
   browser, append a heading block to cowork/inbox.md per
   PROTOCOL.md format (status [new], severity, env, what,
   expected, steps, attachments). Use a unique
   ticket-YYYYMMDD-HHMM ID. Save any supporting screenshot to
   cowork/attachments/ first.

2) CHECK THE INBOX AT THE START OF EVERY TURN. Before any other
   action — even if you're mid-playtest — read cowork/inbox.md
   and look for tickets you opened that are now [ready-for-retest]
   or [needs-info]. If any exist, handle those first; only then
   continue playtesting. Do not wait for the /loop tick to notice
   replies. The /loop is the safety net for idle periods, not the
   primary trigger.

3) RETEST [ready-for-retest] tickets you opened. Hard-refresh the
   test URL, redo the STEPS exactly, capture a screenshot to
   cowork/attachments/, and:
     - if the fix works: rewrite the heading status to [verified]
       and append a comment describing what you saw.
     - if the fix doesn't work: rewrite to [reopened] and append a
       comment with what's still wrong (include the screenshot).
   Important: after a [ready-for-retest] comment that names a
   commit SHA, give Pages ~30–60s to rebuild before retesting.
   Verify the rebuild landed by checking the APP_VERSION label
   on the page. If you retest too early, the result is invalid;
   wait and retry, do not [reopened].

4) ANSWER [needs-info] tickets you opened. Read terminal's
   question, append an answer comment, and rewrite the status
   back to [new] so terminal picks it back up.

5) FLIP TO [needs-human] WHEN STUCK. If you're sure a bug is
   real but terminal disagrees and won't fix, or a fix doesn't
   work after multiple rounds and you can't tell why, rewrite
   the heading to [needs-human] and append a comment naming the
   specific decision the user (Nicholas) needs to make. The user
   is the only one who can flip [needs-human] tickets back out.

6) NEVER touch tickets in [claimed] (terminal owns), [verified]
   (closed), or [needs-human] (user owns). The status table in
   PROTOCOL.md is the routing rule.

7) APPEND-ONLY for comments. The only line you may rewrite is the
   ## ticket-... [status] heading. Never edit a comment after
   writing it; never delete another side's comment.

The /loop below is the periodic-check fallback for idle moments.
Most of the work happens via the per-turn check in (2).

/loop check cowork/inbox.md for tickets you opened in
[ready-for-retest] or [needs-info] status. For [ready-for-retest]:
hard-refresh the test URL (after waiting if a SHA was just named),
redo the STEPS, capture a screenshot to cowork/attachments/, then
mark [verified] or [reopened] with a comment. For [needs-info]:
answer the question in a comment and set status back to [new]. If
you've been stuck on a single ticket for 3+ rounds with no progress,
flip to [needs-human] with a comment naming what the user needs to
decide. Skip tickets in [claimed], [verified], or [needs-human].
Between ticks, continue active playtesting and file new tickets.
```

### 4. Stopping

Either side stops by typing `/loop` with no args. The files persist on
disk; resume by pasting the loop prompt again.

## Deploy gap

When terminal-Claude pushes a fix, GitHub Pages takes ~30–60s to
rebuild. The `[ready-for-retest]` comment includes the commit SHA so
cowork can hard-refresh and verify the build is current — check the
`APP_VERSION` label in the corner of the page against
`game.js`'s `APP_VERSION` constant on the SHA.

If cowork retests too early and sees the old build, the right move is
to wait ~30s and retry, NOT to mark `[reopened]`.

## Troubleshooting

| Symptom                                      | Cause / fix                                                                 |
|----------------------------------------------|-----------------------------------------------------------------------------|
| Terminal isn't picking up tickets            | `/loop` not running. Re-paste the loop prompt.                              |
| Cowork ignores `[ready-for-retest]`          | Cowork loop not running, or the ticket wasn't opened by this cowork session. Re-paste. |
| Tickets keep landing in conflict             | Two sides wrote the same heading line. Manually fix the heading; don't lose comments. |
| `inbox.md` gets huge                         | Delete `[verified]` blocks. Never delete other statuses.                    |
| Fix doesn't appear on Pages even after wait  | Check Pages deploy status on GitHub; rebuild may have failed.               |
