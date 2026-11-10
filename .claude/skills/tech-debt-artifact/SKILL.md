---
name: tech-debt-artifact
description: Use when docs/tech-debt.md has changed and the published "Stashly Tech Debt" artifact must match it — "/tech-debt-artifact", "sync the tech-debt artifact", "publish the tech debt page", "update the tech-debt artifact". Stashly repo.
---

# Tech-debt artifact

Publish `docs/tech-debt.md` as the pinned **Stashly Tech Debt** artifact:
https://claude.ai/artifact/1dAJBVU7hSk6gueAyzgFDt

**Core principle: the markdown is the source; the page is built from it, never edited by hand.** A hand edit to the page is how the two drifted before (25 Oct).

**Cheapest way to run it: delegate to the `tech-debt-publisher` subagent** (haiku). It does every step below in its own context and returns only the version number.

## Shape of the page (since 10 Nov)

The page is two files, built together:

| File | What it holds | Changes |
|------|---------------|---------|
| `index.html` | A small fixed shell: the stylesheet from `page-head.html`, and a script that fetches `body.html` into the page | Only when `page-head.html` or the shell in `build.mjs` changes |
| `body.html` | The rendered register: header chips, tables, pills, item sections (~380 KB) | Every sync |

A sync therefore republishes `body.html` and never has to read the old 4,000-line page. The page needs JavaScript to load the register.

## Files in this skill

| File | What it holds |
|------|---------------|
| `build.mjs` | Renders the doc with `marked` (GFM) into `<out-dir>/index.html` + `body.html`, adding the header chips, heading anchors, status pills, grey rows for struck-through items, `Done:` wording in *What's left* |
| `page-head.html` | The page's fonts link and stylesheet, including the dark-mode tokens |

`marked` isn't a direct dependency. The script picks the newest copy pnpm already installed under `node_modules/.pnpm`. Don't add it to `package.json`; if none is found, stop and ask.

## Steps

1. **The doc is final.** Commit the `docs/tech-debt.md` change first; the page should never show text `main` doesn't have.
2. **Build** into the scratchpad, never into the repo:
   ```sh
   node .claude/skills/tech-debt-artifact/build.mjs "<scratchpad>/tech-debt"
   ```
   It prints the item count, the item-anchor count and any leftover `~~`, and exits 2 when anchors and items differ or `~~` survives. That's a rendering bug: fix `build.mjs`, not the doc. The "Updated" chip comes from the doc's `**Now (<date>):**` line; the script refuses to build without one.
3. **Publish** with `Artifact`: `url` = the URL above, `file_path` = `<scratchpad>/tech-debt/index.html`, `files` = `{"body.html": "<scratchpad>/tech-debt/body.html"}`, `overwrite_unread: ["body.html"]`, a short `label` (e.g. "Sync with docs/tech-debt.md 10 Nov"). No `icon` (redeploy). It stays pinned and private.
   - A publish to an artifact this conversation hasn't read is refused and hands back the live page. That page is now the ~7 KB shell, so reading it is cheap. Merge nothing into it; publish the built `index.html` again.
   - **First publish after the 10 Nov shell change only:** the live page is still the old 4,000-line monolith and the refusal hands back all of it. Skim only to confirm there is no content the doc lacks (the old hand-edit check), then publish. Open the result and confirm the register renders (the `fetch('body.html')` path is the one untested part); if it shows "Could not load the register", report it rather than retrying.
4. **Report** the version number and the item count.

## Changing how the page looks

Edit `build.mjs` (structure, pills, chips, the shell script) or `page-head.html` (styles), rebuild, publish **both** files, and commit those source files. Keep colours as tokens on `:root` with the dark-mode overrides in both places they already appear.

## Common mistakes

| Mistake | Instead |
|---------|---------|
| Editing the published HTML for a quick fix | Fix the markdown (content) or `build.mjs` (presentation), then rebuild |
| Publishing without `url` | That creates a second artifact. Always pass the URL above |
| Publishing only `index.html` after a doc change | The doc lives in `body.html`; publish it in `files` |
| Building into the repo | Build into the scratchpad. The built page is an output, not a tracked file |
| Treating exit code 2 as a doc problem | It means the renderer missed something; the doc is fine |
| Reading the whole old monolith every sync | Don't; the shell is tiny now |
