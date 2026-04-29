# Cowork Playtest Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a documented file-based ticketing channel between cowork-Claude (browser session) and terminal-Claude (this session) so cowork can file playtest bugs and verify fixes visually after I push.

**Architecture:** Documentation-only feature. Two committed files (`cowork/PROTOCOL.md`, `cowork/README.md`) describe the protocol; two gitignored paths (`cowork/inbox.md`, `cowork/attachments/`) hold runtime conversation state. A `.gitkeep` preserves the attachments directory in git. CLAUDE.md gets a short pointer section so future sessions know the channel exists. No JS/CSS/shell-file changes — `service-worker.js` `CACHE` and `game.js` `APP_VERSION` are NOT bumped.

**Tech Stack:** Markdown, `.gitignore`.

**Spec:** `docs/superpowers/specs/2026-04-29-cowork-playtest-inbox-design.md`

---

## File Structure

| Path                          | Action  | Tracked? | Responsibility                                                  |
|-------------------------------|---------|----------|-----------------------------------------------------------------|
| `cowork/PROTOCOL.md`          | Create  | yes      | Ticket format, status table, comment format reference           |
| `cowork/README.md`            | Create  | yes      | Bring-up instructions + pasteable `/loop` prompts for both sides |
| `cowork/attachments/.gitkeep` | Create  | yes      | Preserves the attachments directory in git                      |
| `cowork/inbox.md`             | (none)  | no       | Created at runtime by whichever side files first ticket         |
| `.gitignore`                  | Modify  | yes      | Add `cowork/inbox.md` and `cowork/attachments/*` (with `.gitkeep` exception) |
| `CLAUDE.md`                   | Modify  | yes      | Add a "Cowork Playtest Channel" section near Workflow Rules     |

Five logical units, four commits (one per task; CLAUDE.md update + push bundle into the last task per workflow rules).

---

### Task 1: Write `cowork/PROTOCOL.md`

**Files:**
- Create: `cowork/PROTOCOL.md`

- [ ] **Step 1: Create the protocol document with the full content below**

Path: `cowork/PROTOCOL.md`

```markdown
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

Either side may delete `[verified]` ticket blocks periodically to keep
`inbox.md` small. **Never** delete tickets in any other status. Don't
delete attachments referenced by un-`verified` tickets.
```

- [ ] **Step 2: Mental walkthrough — open the file and trace one full ticket lifecycle**

Imagine cowork files a ticket about a broken touch drag. Read the doc top-to-bottom in order:
1. Format section tells cowork exactly how to format the heading + body.
2. Status table tells terminal-Claude what `[new]` means and that they're next.
3. Replies section tells terminal how to sign comments and rewrite the status.
4. Lifecycle diagram shows what happens after `[ready-for-retest]`.

Confirm: a fresh reader of just this file could file, claim, and verify a ticket without referring to the spec.

- [ ] **Step 3: Commit**

```bash
git add cowork/PROTOCOL.md
git commit -m "docs(cowork): add ticket protocol for playtest inbox

Defines the format, status lifecycle, and reply convention for the
cowork <-> terminal-Claude playtest channel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Write `cowork/README.md`

**Files:**
- Create: `cowork/README.md`

- [ ] **Step 1: Create the README with the full content below**

Path: `cowork/README.md`

```markdown
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
```

- [ ] **Step 2: Mental walkthrough — fresh user follows the README from scratch**

Imagine a session where neither loop is running. Read top-to-bottom and check:
1. Step 1 → user picks Pages or local server. ✓ (Pages is the default)
2. Step 2 → user has a copy-pasteable terminal prompt. ✓
3. Step 3 → user has a copy-pasteable cowork prompt that includes the `/loop` body. ✓
4. Step 4 → user knows how to stop. ✓
5. Deploy gap section preempts the most likely false-positive `[reopened]`.

Confirm: nothing in the README assumes prior context the spec didn't establish.

- [ ] **Step 3: Commit**

```bash
git add cowork/README.md
git commit -m "docs(cowork): add bring-up README with paste-ready loop prompts

Includes terminal and cowork loop prompts, deploy-gap caveat, and a
troubleshooting table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Gitignore + attachments directory marker

**Files:**
- Modify: `.gitignore`
- Create: `cowork/attachments/.gitkeep`

- [ ] **Step 1: Read current `.gitignore`**

Run: `cat .gitignore` (or use Read).

Expected current content:
```
.claude/worktrees/
_research/
.superpowers/
```

- [ ] **Step 2: Append cowork ignore lines**

Append to `.gitignore`:

```
cowork/inbox.md
cowork/attachments/*
!cowork/attachments/.gitkeep
```

The `!cowork/attachments/.gitkeep` exception preserves the empty directory in git so cowork doesn't have to `mkdir -p` before saving its first screenshot.

Final `.gitignore`:

```
.claude/worktrees/
_research/
.superpowers/
cowork/inbox.md
cowork/attachments/*
!cowork/attachments/.gitkeep
```

- [ ] **Step 3: Create the `.gitkeep` marker**

Path: `cowork/attachments/.gitkeep`

Content: empty file.

(Use Write with empty content — do NOT echo to file.)

- [ ] **Step 4: Verify ignore behavior with a smoke test**

```bash
# Create a temp inbox.md to confirm it's ignored
echo "smoke test" > cowork/inbox.md
git status cowork/
```

Expected: `git status` shows `cowork/attachments/.gitkeep` as untracked but NOT `cowork/inbox.md`.

```bash
# Cleanup the temp file
rm cowork/inbox.md
```

If `cowork/inbox.md` shows up in `git status`, the ignore line is wrong — re-check `.gitignore` for trailing whitespace or an unintended trailing slash.

- [ ] **Step 5: Commit**

```bash
git add .gitignore cowork/attachments/.gitkeep
git commit -m "chore(cowork): ignore inbox.md + attachments, keep dir marker

Adds gitignore entries for runtime cowork state and a .gitkeep so the
attachments directory exists in fresh checkouts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add cowork channel section to `CLAUDE.md` and push

**Files:**
- Modify: `CLAUDE.md` (insert new section between line 581 "## Clean Room Protocol — Reference Material" block end and line 583 "## Workflow Rules")

- [ ] **Step 1: Locate the insertion point**

Run: `grep -n "^## " CLAUDE.md`

Expected (last two entries):
```
539:## Clean Room Protocol — Reference Material
583:## Workflow Rules
```

The new section goes immediately before `## Workflow Rules`.

- [ ] **Step 2: Edit `CLAUDE.md` to insert the new section**

Use Edit tool. Find:

```
This rule applies even when "just borrowing a small function" looks
tempting. Always paraphrase by re-deriving the logic in our own style.

## Workflow Rules
```

Replace with:

```
This rule applies even when "just borrowing a small function" looks
tempting. Always paraphrase by re-deriving the logic in our own style.

## Cowork Playtest Channel

A file-based ticketing channel for browser-automated playtesting lives
under `cowork/`. **cowork-Claude** runs in a browser session, plays the
game, files bug tickets, and visually verifies fixes after they're
pushed. **terminal-Claude** (this session) claims tickets, fixes them in
code, pushes, and marks `[ready-for-retest]`.

- `cowork/PROTOCOL.md` — ticket format, status lifecycle, reply convention.
- `cowork/README.md` — bring-up steps and paste-ready `/loop` prompts.
- `cowork/inbox.md` — runtime state, gitignored, append-only.
- `cowork/attachments/` — runtime state, gitignored (`.gitkeep` preserves
  the directory).

Status lifecycle: `[new]` → `[claimed]` → `[ready-for-retest]` →
`[verified]`, with `[needs-info]` (terminal bounces back) and
`[reopened]` (retest failed) as branches. `[needs-human]` is an
escape hatch — either Claude side flips a ticket to it when stuck;
both loops then skip it and the user adjudicates (reproducing
on real hardware, calling intended-vs-bug, etc.) before flipping
the status back. The terminal loop only acts on `[new]` and
`[reopened]`; the cowork loop only acts on `[ready-for-retest]` and
`[needs-info]` for tickets it opened.

When fixing a ticket: include the commit SHA in the
`[ready-for-retest]` comment so cowork knows what build to verify
against (Pages takes ~30–60s to rebuild after push).

Cowork checks `cowork/inbox.md` at the **start of every turn**, not
only on `/loop` ticks — replies from terminal should be picked up
immediately while cowork is mid-playtest, not deferred to the next
loop firing.

## Workflow Rules
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude.md): document cowork playtest channel

Adds a section pointing at cowork/PROTOCOL.md and cowork/README.md so
future sessions know the channel exists and how the status lifecycle
works.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push all four commits to main**

Per the project's workflow rules ("always push after a commit so the
GitHub Pages deploy stays current"), push the bundled work:

```bash
git push origin main
```

Expected: four commits land on `origin/main`.

- [ ] **Step 5: Verify on GitHub**

```bash
git log --oneline -5
```

Expected: the four new commits at the top, in this order (most recent first):
1. `docs(claude.md): document cowork playtest channel`
2. `chore(cowork): ignore inbox.md + attachments, keep dir marker`
3. `docs(cowork): add bring-up README with paste-ready loop prompts`
4. `docs(cowork): add ticket protocol for playtest inbox`

Confirm the working tree is clean:

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Self-Review

**Spec coverage:**
- Directory layout (PROTOCOL.md, README.md, inbox.md, attachments/) → covered by Tasks 1, 2, 3.
- Ticket format → covered by Task 1 (PROTOCOL.md).
- Status lifecycle (six states + diagram) → covered by Task 1 + summary in Task 4 (CLAUDE.md).
- Co-located reply convention → covered by Task 1.
- Two-loop polling with paste-ready prompts → covered by Task 2 (README.md).
- Bring-up notes (Pages vs local server, deploy gap) → covered by Task 2.
- Gitignore for inbox.md and attachments → covered by Task 3.
- Lean-up rules → covered by Task 1 (PROTOCOL.md "Lean-up" section).
- CLAUDE.md pointer → covered by Task 4.
- "Out of scope (v1)" items (no FROM, no labels, no automation, no human-tester card) → respected — none of these appear in the plan.

No spec gaps.

**Placeholder scan:** No "TBD", "TODO", or vague directives in any task body. All file contents shown verbatim.

**Type / name consistency:**
- Status names spelled identically across PROTOCOL.md, README.md, CLAUDE.md, and the loop prompts: `[new]`, `[claimed]`, `[needs-info]`, `[ready-for-retest]`, `[verified]`, `[reopened]`. ✓
- Signature strings consistent: `claude-terminal` / `claude-cowork`. ✓
- Path consistent: `cowork/inbox.md`, `cowork/attachments/`. ✓
- Ticket ID format consistent: `ticket-YYYYMMDD-HHMM`. ✓
