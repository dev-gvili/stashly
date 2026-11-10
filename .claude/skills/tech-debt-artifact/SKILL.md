---
name: tech-debt-artifact
description: Use when docs/tech-debt.md has changed and the published "Stashly Tech Debt" artifact must match it — "/tech-debt-artifact", "sync the tech-debt artifact", "publish the tech debt page", "update the tech-debt artifact". Stashly repo.
---

# Tech-debt artifact

Publish `docs/tech-debt.md` as the pinned **Stashly Tech Debt** artifact:
https://claude.ai/artifact/1dAJBVU7hSk6gueAyzgFDt

**Core principle: the markdown is the source; the page is built from it, never edited by hand.** A hand edit to the page is how the two drifted before (25 Oct: the page was a one-off conversion that had fallen two days and two items behind the doc, and carried wording the doc never had).

## Files

| File | What it holds |
|------|---------------|
| `build.mjs` | Renders the doc with `marked` (GFM) and adds the page's own touches: the header chips, heading anchors, pills on statuses, grey rows for struck-through items, `Done:` wording in *What's left* |
| `page-head.html` | The page's fonts link and stylesheet, including the dark-mode tokens |

`marked` isn't a direct dependency. The script picks the newest copy pnpm already installed under `node_modules/.pnpm`. Don't add it to `package.json` to make this work; if none is found, stop and ask (Scope Discipline: no new dependencies without asking).

## Steps

1. **The doc is final.** Finish and commit the `docs/tech-debt.md` change first; the page should never show text `main` doesn't have.
2. **Read the live page** with `Artifact` `action: "read"` on the URL above, then Read the saved file it names **to the last line**. Publishing to an artifact this conversation hasn't read is refused. Skip this step only if this conversation already published it.
   **Cost (measured 10 Nov):** the saved file is 4,005 lines, about 170k tokens, which is more than a session has room for in one go; the tool refuses a publish until every line is read, and reads rejected as over 25k tokens per call. A cheaper check that satisfies the same purpose: build first (step 3), then `diff` the built page against the saved file's body (`awk '/<div class="doc">/{f=1} f'`); the live body matched the build exactly on 10 Nov. That proves no hand edits but does **not** satisfy the tool's read requirement. A shell-plus-`body.html` split was tried (commit `b22062a`) and reverted because the first publish hit this same wall; revisit it only with the owner's go-ahead to publish under a new artifact URL.
   While reading, look for content that isn't in the doc: someone may have edited the page directly. If you find any, **stop and ask** whether to fold it into the markdown first. Rebuilding would delete it.
3. **Build** into the scratchpad, never into the repo:
   ```sh
   node .claude/skills/tech-debt-artifact/build.mjs "<scratchpad>/tech-debt.html"
   ```
   It prints the item count, the item-anchor count and any leftover `~~`, and exits 2 when anchors and items differ or `~~` survives. That's a rendering bug: fix `build.mjs`, not the doc.
   The "Updated" chip comes from the doc's `**Now (<date>):**` line; the script refuses to build without one.
4. **Publish** with `Artifact`: `file_path` = the built file, `url` = the URL above, a short `label` (e.g. "Sync with docs/tech-debt.md 25 Oct"). No `icon` (it's a redeploy). The artifact stays pinned and private.
5. **Report** the version number, and anything step 2 found that the doc didn't have.

## Changing how the page looks

Edit `build.mjs` (structure, pills, chips) or `page-head.html` (styles), rebuild, publish, and commit those files. When `page-head.html` changes, keep its colours as tokens on `:root` with the dark-mode overrides in both places they already appear.

## Common mistakes

| Mistake | Instead |
|---------|---------|
| Editing the published HTML for a quick fix | Fix the markdown (content) or `build.mjs` (presentation), then rebuild |
| Publishing without `url` | That creates a second artifact. Always pass the URL above |
| Building into the repo | Build into the scratchpad. The built page is an output, not a tracked file |
| Treating exit code 2 as a doc problem | It means the renderer missed something; the doc is fine |
