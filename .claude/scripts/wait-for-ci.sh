#!/usr/bin/env bash
# Block until the CI run for a commit completes, then print its result.
#
# Run it as ONE background command (Bash `run_in_background`) right after a push:
# the session is woken once when it exits, instead of Claude polling every few
# seconds. It waits for `status == completed` rather than trusting `gh run watch`,
# which once returned while the docker job was still building.
#
# On success it also fast-forwards the main checkout to that commit (see below).
#
# Usage: bash .claude/scripts/wait-for-ci.sh [sha]   (default: HEAD)
# Exit:  0 success · 1 any other conclusion (failure, cancelled, …) · 2 no run appeared
set -u

# Full SHA: `gh run list --commit` finds nothing for an abbreviated one.
sha=$(git rev-parse "${1:-HEAD}")

# The run can take a few seconds to exist after the push; give it up to ~5 min.
id=""
for _ in $(seq 1 30); do
  # Only the CI workflow: since the repo went public, GitHub also runs a
  # "Dependency Graph" workflow per push, and taking any run for the commit
  # once reported that one's success as CI's and synced main early.
  id=$(gh run list --commit "$sha" --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null)
  [ -n "$id" ] && break
  sleep 10
done
if [ -z "$id" ]; then
  echo "no CI run found for $sha"
  exit 2
fi

# A failed `gh` call yields an empty status, which just keeps the loop going.
until [ "$(gh run view "$id" --json status --jq .status 2>/dev/null)" = completed ]; do
  sleep 30
done

conclusion=$(gh run view "$id" --json conclusion --jq .conclusion)
gh run view "$id" --json conclusion,url,jobs \
  --jq '"\(.conclusion) \(.url)", (.jobs[] | select(.conclusion != "success") | "  \(.conclusion): \(.name)")'

# Green: fast-forward the main checkout (the first worktree, where the owner's
# dev server runs) to exactly this commit, so local main only ever holds code
# CI passed. Only when that checkout is on main and the commit is on main's
# history; --ff-only refuses rather than merge or touch conflicting local edits.
if [ "$conclusion" = success ]; then
  main_dir=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
  if [ -n "$main_dir" ] && [ "$(git -C "$main_dir" rev-parse --abbrev-ref HEAD)" = main ]; then
    if git -C "$main_dir" fetch -q origin main &&
      git -C "$main_dir" merge-base --is-ancestor "$sha" origin/main &&
      git -C "$main_dir" merge --ff-only -q "$sha" 2>/dev/null; then
      echo "synced $main_dir to $(git -C "$main_dir" rev-parse --short HEAD)"
    else
      echo "did not sync $main_dir: $sha is not on origin/main, is behind it, or the fast-forward was refused"
    fi
  fi
fi
[ "$conclusion" = success ]
