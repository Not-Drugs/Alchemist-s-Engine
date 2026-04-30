# Cowork Agent Template

Standing rules for every coding agent dispatched from the cowork channel.
The orchestrator's dispatch prompt should reference this file ("follow
`cowork/agent-template.md`") rather than restate these rules each time.

## Role

You are a **coding agent** running in an isolated git worktree (created
by `Agent({ isolation: "worktree", ... })`). Your job is to fix ONE
cowork-playtest ticket on a fresh branch and hand the branch back to
the orchestrator. You are NOT the orchestrator — you don't push, you
don't merge, you don't decide ticket priority.

## Setup

Before touching code, read these in order:

1. `CLAUDE.md` — project context, mechanics, structure, workflow rules.
   Pay attention to **"Workflow Rules"** at the bottom (atomic commits,
   APP_VERSION/CACHE lock-step, the orchestrator pattern).
2. The specific ticket text the orchestrator embedded in your prompt.
3. Any relevant section of CLAUDE.md the orchestrator pointed to (e.g.
   the "Trial Location: The Dead Grove" section if you're touching
   grove code).

## Hard rules

These are non-negotiable. Violating any of them creates merge friction
or breaks the orchestrator's bookkeeping.

- **Stay on your branch.** It was created by the Agent tool, named
  `worktree-agent-<id>`. Don't switch, rebase, or merge anything else.
- **Do NOT push** (`git push`). The orchestrator pushes after merging
  your branch into `main`.
- **Do NOT bump `APP_VERSION` in `game.js` or `CACHE` in
  `service-worker.js`.** They must stay in lock-step (a pre-commit
  hook will block your commit if you accidentally bump only one). The
  orchestrator bumps both once on merge to capture the combined delta.
- **Do NOT touch `cowork/inbox.md`.** It's gitignored, so changes
  don't propagate via merge anyway. The orchestrator owns claim and
  ready-for-retest writes.
- **Do NOT skip hooks** (`--no-verify`, `--no-gpg-sign`, `-c
  commit.gpgsign=false`). If a hook fails, fix the underlying issue.
- **Do NOT amend or force-push.** New commit, new push (and only the
  orchestrator pushes anyway).
- **Do NOT add emojis** unless the existing code already has them.
- **One atomic commit per dispatch.** Squash sub-edits before
  committing if needed.

## Commit message format

```
<type>(<scope>): <one-line summary in imperative mood>

<one-paragraph explanation of WHAT changed and WHY — not
the mechanics of HOW; the diff shows that.>

<optional: notes on landmines navigated, prior-related-fix references,
or things the orchestrator should watch when merging.>

Cowork ticket <NNNN>.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

`type`: `feat`, `fix`, `chore`, `docs`, `polish`, `refactor`. Pick one.
`scope`: the area touched (e.g. `grove`, `a11y`, `version`).

Use a HEREDOC to pass the message to git so multi-line formatting
survives:

```bash
git commit -m "$(cat <<'EOF'
fix(grove): example summary

Body paragraph here.

Cowork ticket 0042.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Returning to the orchestrator

After committing, return a **≤200-word report** with:

- Branch name (e.g. `worktree-agent-a824734a1ed65df67`).
- Commit SHA (full or short, both fine).
- Principal edits as `file:line` references — name the 3-5 most
  important locations, not every changed line.
- The high-level approach you took (especially if you picked between
  multiple options the orchestrator listed in the prompt).
- **Landmines you hit** — anything surprising, anything the orchestrator
  should know when merging, anything that might affect future work.
- If you couldn't complete the work for any reason: STOP and explain
  in the report rather than committing a half-fix. The orchestrator
  can re-dispatch with adjusted scope; a half-fix wastes a merge.

## Branch + worktree state when you finish

The Agent tool's result block automatically reports:

```
<worktree>
    <worktreePath>...\.claude\worktrees\agent-<id></worktreePath>
    <worktreeBranch>worktree-agent-<id></worktreeBranch>
</worktree>
```

The orchestrator uses that to find your branch. You don't need to do
anything special — committing is sufficient. (If you make NO changes,
the worktree auto-cleans on agent exit.)

## What the orchestrator does after you finish

1. `git merge --squash worktree-agent-<id>` — stages your diff into
   `main` without committing yet.
2. Bumps `APP_VERSION` (game.js) and `CACHE` (service-worker.js) once
   to reflect the combined delta.
3. `git commit` — composes ONE commit on main with your work plus the
   version bump. The pre-commit hook validates the lock-step.
4. `git push origin main`.
5. Updates `cowork/inbox.md` with the SHA and `[ready-for-retest]`.
6. Optionally cleans up your worktree + branch (after asking the user).

You don't see any of this. Your job ends at the commit.
