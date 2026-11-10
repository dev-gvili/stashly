---
name: ui-verify
description: Use to verify a UI change in the browser in light and dark mode before calling it done or pushing — "/ui-verify <url>", "check this in the browser", "verify the UI". Delegates to the ui-verifier subagent. Stashly repo.
disable-model-invocation: true
---

# UI verify

CLAUDE.md → UI Verification: a UI change is not done until it has been seen rendering correctly in both themes.

**Core principle: measure the live DOM, don't infer from the source.** Stale Tailwind CSS has caused false negatives, and a signed-in-as-another-account browser answers 403 that looks like a bug.

## Steps

1. Give the `ui-verifier` subagent: the URL(s) (the dev server is on port 80; never start or restart one), and what the change should look like (new classes, text, elements, states). It returns a pass/fail table and one `VERDICT:` line, with no screenshots.
2. For a change built from a design, also run `mockup-diff-auditor` with the design source.
3. Act on the verdict:
   - **pass**: say what was checked (both themes, console, class resolution, account) and that is the evidence.
   - **fail**: fix the first failing check, re-run only that URL.
   - **blocked** (sign-in, pane issues, wrong account): say so explicitly and **don't push**. Ask the owner to sign in to the MCP Chrome; browser verification doesn't need a session for static checks (`http://localhost/auth/sign-in` loads the same stylesheet), but an authenticated page does.
4. A "Tailwind class not applying" result is usually a stale stylesheet: hard reload (Ctrl+Shift+R) before changing any code.

## Report

Pages checked, theme(s), console errors, and the verdict. If nothing was seen rendering, say "unverified".
