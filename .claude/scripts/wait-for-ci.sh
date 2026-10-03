#!/usr/bin/env bash
# Block until the CI run for a commit completes, then print its result.
#
# Run it as ONE background command (Bash `run_in_background`) right after a push:
# the session is woken once when it exits, instead of Claude polling every few
# seconds. It waits for `status == completed` rather than trusting `gh run watch`,
# which once returned while the docker job was still building.
#
# Usage: bash .claude/scripts/wait-for-ci.sh [sha]   (default: HEAD)
# Exit:  0 success · 1 any other conclusion (failure, cancelled, …) · 2 no run appeared
set -u

sha=${1:-$(git rev-parse HEAD)}

# The run can take a few seconds to exist after the push; give it up to ~5 min.
id=""
for _ in $(seq 1 30); do
  id=$(gh run list --commit "$sha" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null)
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
[ "$conclusion" = success ]
