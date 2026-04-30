#!/usr/bin/env bash
# scripts/cleanup-worktree.sh
#
# List or remove agent worktrees under .claude/worktrees/agent-*.
# Non-destructive by default — must pass --apply to actually remove.
#
# Usage:
#   scripts/cleanup-worktree.sh                # list all agent worktrees + status
#   scripts/cleanup-worktree.sh <id>           # preview removal of one (no-op)
#   scripts/cleanup-worktree.sh <id> --apply   # actually remove that one
#   scripts/cleanup-worktree.sh --all          # preview removal of all (no-op)
#   scripts/cleanup-worktree.sh --all --apply  # actually remove all
#
# Status detection (per worktree):
#   merged-ff       branch tip is an ancestor of main (FF-style)
#   merged-squash   branch tip not in main but no remaining diff against main
#                   (this is what `git merge --squash` produces)
#   unmerged        branch has diff vs main — DO NOT auto-remove
#   killed          worktree exists but the branch is missing (agent killed
#                   mid-work without committing)
#
# Removes worktree (`git worktree remove --force`) and branch (`git branch -D`)
# only with --apply. Both ops are destructive — require explicit opt-in.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

apply=0
target=""
all=0

# parse args — order doesn't matter, but only one positional id allowed
for arg in "$@"; do
  case "$arg" in
    --apply) apply=1 ;;
    --all)   all=1 ;;
    -h|--help)
      sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | head -n -1
      exit 0
      ;;
    *)
      if [ -n "$target" ]; then
        echo "error: multiple ids specified" >&2
        exit 1
      fi
      target="$arg"
      ;;
  esac
done

# Status check for a single worktree id.
# Echoes one of: merged-ff | merged-squash | unmerged | killed
status_of() {
  local id="$1"
  local branch="worktree-agent-$id"
  if ! git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
    echo "killed"
    return
  fi
  if git merge-base --is-ancestor "$branch" main 2>/dev/null; then
    echo "merged-ff"
    return
  fi
  # Squash-merged check: the orchestrator's squash-merge commit body
  # references the agent's branch tip SHA via the conventional message
  # "Squash-merged from <branch> (<short-sha>)". Search the main log for
  # that short SHA in any commit body.
  local tip
  tip=$(git rev-parse --short "$branch")
  if git log main --grep="$tip" --oneline 2>/dev/null | grep -q .; then
    echo "merged-squash"
    return
  fi
  echo "unmerged"
}

remove_one() {
  local id="$1"
  local path=".claude/worktrees/agent-$id"
  local branch="worktree-agent-$id"
  if [ ! -d "$path" ]; then
    echo "  no worktree at $path"
  else
    echo "  removing worktree $path ..."
    git worktree remove "$path" --force
  fi
  if git rev-parse --verify "refs/heads/$branch" >/dev/null 2>&1; then
    echo "  deleting branch $branch ..."
    git branch -D "$branch"
  fi
}

# Find all agent worktrees by name under .claude/worktrees/
# Handle paths with spaces (e.g. "Apps/Alchemist's Engine") by stripping
# the "worktree " prefix instead of awk-fielding on whitespace.
mapfile -t paths < <(git worktree list --porcelain | sed -n 's|^worktree \(.*\)|\1|p' | grep '/\.claude/worktrees/agent-')

if [ ${#paths[@]} -eq 0 ]; then
  echo "No agent worktrees registered with git."
  # Also check for stray directories that aren't tracked as worktrees
  if compgen -G ".claude/worktrees/agent-*" > /dev/null; then
    echo "Note: untracked directories exist under .claude/worktrees/ — these are leftover state. Inspect manually."
  fi
  exit 0
fi

# List mode (no target, no --all)
if [ -z "$target" ] && [ $all -eq 0 ]; then
  echo "Agent worktrees:"
  for path in "${paths[@]}"; do
    id="$(basename "$path" | sed 's/^agent-//')"
    s=$(status_of "$id")
    echo "  $path  [$s]"
  done
  echo ""
  echo "Pass an <id> to preview removal of one, or --all to preview all."
  echo "Add --apply to actually remove (destructive)."
  exit 0
fi

# Single-target mode
if [ -n "$target" ]; then
  path=".claude/worktrees/agent-$target"
  if [ ! -d "$path" ] && ! git rev-parse --verify "refs/heads/worktree-agent-$target" >/dev/null 2>&1; then
    echo "error: no worktree or branch found for id '$target'" >&2
    exit 1
  fi
  s=$(status_of "$target")
  echo "Target: $path  [$s]"
  if [ "$s" = "unmerged" ]; then
    echo "  WARNING: branch has un-merged work — removing it will lose those commits."
    echo "  Re-run with --apply only if you're sure."
  fi
  if [ $apply -eq 0 ]; then
    echo "(preview — re-run with --apply to remove)"
    exit 0
  fi
  remove_one "$target"
  echo "Done."
  exit 0
fi

# --all mode
echo "All agent worktrees:"
for path in "${paths[@]}"; do
  id="$(basename "$path" | sed 's/^agent-//')"
  s=$(status_of "$id")
  echo "  $path  [$s]"
  if [ "$s" = "unmerged" ]; then
    echo "    WARNING: un-merged work — would be lost on --apply."
  fi
done
if [ $apply -eq 0 ]; then
  echo ""
  echo "(preview — re-run with --all --apply to remove all)"
  exit 0
fi
echo ""
echo "Removing all..."
for path in "${paths[@]}"; do
  id="$(basename "$path" | sed 's/^agent-//')"
  remove_one "$id"
done
echo "Done."
