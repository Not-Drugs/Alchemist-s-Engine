---
description: List or remove agent worktrees under .claude/worktrees/agent-*. Default mode is read-only preview; pass --apply to actually remove.
---

You're cleaning up agent worktrees in this repo. The bash script at
`scripts/cleanup-worktree.sh` does the work — it's non-destructive by
default and only removes worktrees + branches when called with
`--apply`.

## What to do

Run the script in PREVIEW mode first to see what's there:

```bash
bash scripts/cleanup-worktree.sh $ARGUMENTS
```

If `$ARGUMENTS` is empty, the script lists every agent worktree with
its merge status:

- `merged-ff` — branch tip is an ancestor of main (rare; we use squash).
- `merged-squash` — branch's diff against main is empty (the work
  landed via `git merge --squash` and the orchestrator's combined
  commit). Safe to remove.
- `unmerged` — branch has commits not in main. Removing it WILL lose
  those commits. Don't apply unless you've confirmed the work is
  abandoned (e.g. an agent killed mid-work).
- `killed` — worktree directory exists but the branch is missing
  (agent killed before committing). Safe to remove (nothing to lose).

## Modes

- **No args**: list every agent worktree + status. Read-only.
- **`<id>`**: preview removal of one (e.g. `cleanup-worktree
  a824734a1ed65df67`). Read-only.
- **`<id> --apply`**: actually remove that worktree + its branch.
  Destructive.
- **`--all`**: preview removal of every agent worktree. Read-only.
- **`--all --apply`**: actually remove every agent worktree + branch.
  Destructive.

## When the user typed `/cleanup-worktree` with no args

Run the bash script in list mode, summarize what's there, and offer
to apply removal for the merged-squash and killed entries (those are
the safe ones). Always confirm before running with --apply — these
are destructive operations and the user owns the call.

## When the user passed an id (`/cleanup-worktree a824734...`)

Run the script in single-id preview mode first, show the status, ask
confirmation if it's safe (merged-squash / killed) or warn loudly if
it's unmerged. Apply only after the user confirms.

## When the user passed `--all`

Same as the above but at scale — preview, summarize the merge-status
counts, ask confirmation, apply only with explicit user OK.
