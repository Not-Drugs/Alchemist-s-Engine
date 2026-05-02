# Workflow — Detailed Reference

For top-level rules see CLAUDE.md. This file holds the deeper detail.

## Pre-commit guard: `APP_VERSION` ↔ `CACHE` lock-step

`.claude/settings.json` carries a `PreToolUse` hook on `Bash(git commit*)`
that greps both files and blocks the commit if they disagree. The block
exits 2 with a `BLOCKED:` stderr message naming both versions, so a
forgotten or silently-failed bump can't ship. The hook is committed and
travels with the repo — any Claude Code session in this worktree
inherits it.

If you ever need to bypass it (you almost never should — fix the
underlying drift instead), pass `--no-verify` only with the user's
explicit OK.

## Orchestrator + worktree-isolated agents

For tickets that are big enough to keep a Claude session productive in
parallel (≥15 min of focused work, touching a different file region than
what the orchestrator is editing on `main`), use this pattern:

1. **Orchestrator dispatches a coding agent with `Agent({ isolation:
   "worktree", ... })`.** The Agent tool creates a fresh worktree under
   `.claude/worktrees/agent-<id>/` on a new branch
   `worktree-agent-<id>`.
2. **Agent receives a self-contained prompt** that references
   `cowork/agent-template.md` (the standing rules) plus the specific
   ticket text and any implementation hints. The template carries the
   reusable rules so dispatch prompts stay short.
3. **Agent commits one atomic commit** to its branch and returns the
   SHA + a ≤200-word report. It does NOT push.
4. **Orchestrator merges the branch into `main`** with `git merge
   --squash <branch>`, bumps APP_VERSION + CACHE once for the combined
   delta, composes one commit on `main`, pushes. The squash gives clean
   linear history (one commit per ticket on main, no merge bubbles).
5. **Orchestrator updates `cowork/inbox.md`** with the ready-for-retest
   status + the SHA. Cowork retests the live build.
6. **Cleanup** — `git worktree remove <path>` and `git branch -D
   <branch>` are destructive; ask the user before running either.
   The `/cleanup-worktree` slash command (or
   `bash scripts/cleanup-worktree.sh`) lists all agent worktrees with
   merge status (`merged-ff` / `merged-squash` / `unmerged` / `killed`)
   in read-only preview mode by default; pass `--apply` only after the
   user confirms.

   **Windows file-lock gotcha (2026-05-01).** On Windows, running
   Claude Code processes hold open file handles inside their own
   worktrees, so `git worktree remove --force` succeeds in
   de-registering the worktree from git but fails to delete the
   on-disk directory with `Permission denied`. The same lock blocks
   `rm -rf` on the leftover dir. **Fix: reboot the computer** (or at
   minimum kill every Claude Code process holding the worktree open),
   then re-run cleanup — the locks release on logoff/restart and the
   dirs delete cleanly. Also, the cleanup script only matches
   `agent-*` worktrees; `claude/*` worktrees (created by other Claude
   sessions, named like `competent-swartz-c37526`) need manual
   `git worktree remove` per worktree, plus `git branch -D claude/<name>`
   per branch. Check with `git worktree list` and `git branch | grep claude`
   to enumerate.

Why the discipline:

- **Agents never bump APP_VERSION/CACHE.** Two agents bumping in
  parallel branches conflict on every merge. Orchestrator bumps once
  on merge.
- **Agents never touch `cowork/inbox.md`.** The inbox is gitignored, so
  its changes don't propagate via merge anyway. Orchestrator owns claim
  and ready-for-retest writes; agents own code only.
- **Domain-split prompts.** Tell agent A "you're in JS renderers" and
  agent B "you're in CSS." The further apart their territories, the
  fewer merge conflicts.

Skip this pattern for sub-5-min fixes — dispatch + merge overhead
exceeds the work. Skip it for serial single-agent runs — the win only
shows up when the orchestrator is committing in parallel on disjoint
surfaces.

## Clean Room Protocol — Reference Material

When taking inspiration from other open-source incremental games (Candy Box
2, A Dark Room, etc.) we observe a strict separation: **read for patterns,
implement in our own voice. Never copy code verbatim.**

- Upstream source goes into `_research/<source-name>/repo/` (gitignored)
- Use shallow clones (`git clone --depth 1 …`) — we only need latest state
- Our own analysis (notes, lessons, pattern summaries) lives in
  `docs/inspiration-notes.md` and is freely committable
- Both Candy Box 2 (GPLv3) and A Dark Room (MPL 2.0) are reciprocal
  licenses. Direct code copy would force our project to inherit those
  obligations. Reading and reimplementing is fine; copying is not
- When adding a new source: create `_research/<name>/`, clone into `repo/`
  underneath, update `docs/inspiration-notes.md` with the patterns to lift

**ASCII art references** are a separate kind of source — not cloned repos
but curated per-category indexes under `_research/ascii-<category>/INDEX.md`
(e.g. `ascii-trees/`, `ascii-fire/`). Each `INDEX.md` carries source URL,
attributed pieces with artist signatures, tags, game-relevance notes, plus
a "style takeaways" section.

- Master index: `_research/ascii-co-uk-INDEX.md` (23+ categories from
  ascii.co.uk grouped by theme; logs URLs that returned typography-only
  so we don't refetch)
- Licensing posture: `_research/ascii-co-uk-LICENSING.md`. The site
  publishes no license, no copyright notice, and no contact info, so we
  treat every piece as **study-only** and paraphrase. When a hand-authored
  piece is recognizably derived, cite the source piece and artist in the
  commit message

This rule applies even when "just borrowing a small function" looks
tempting. Always paraphrase by re-deriving the logic in our own style.
