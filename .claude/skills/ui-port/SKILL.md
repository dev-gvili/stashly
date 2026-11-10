---
name: ui-port
description: Use to build a Stashly page, route, feature or component from an artifact, an HTML mockup or a Claude Design project — "/ui-port <url or path>", "port this design", "build this redesign", "implement this mockup". Runs intake, a plan gate, phased commits and browser verification. Stashly repo.
disable-model-invocation: true
---

# UI port

Turn a design into real Stashly UI without a rejected build. This skill is CLAUDE.md → UI Verification as one procedure; do not re-ask the owner anything it already answers.

**Core principle: nothing is edited until the plan is approved, and nothing is reported done until it has been seen rendering in both themes.** Most reverted redesigns were built before scope was agreed, or declared done on inference.

Load `stashly-ui-conventions` first. Also load `stashly-gallery-views` (gallery), `stashly-prisma-data` (a new query or select) or `stashly-file-viewer-stage` (item page) when the design touches them.

## 1. Intake (no edits)

Run the `design-intake` skill on the source. It writes a one-page spec to the scratchpad: components, tokens, states, data each region needs, missing backend fields.

If the source is a prototype HTML, the real `.tsx` is what gets edited, never the prototype.

## 2. Plan (the gate)

Run the `ui-port-planner` subagent with the spec path. It returns, per CLAUDE.md:

1. components, utilities, hooks and helpers to reuse (found by grep; a "reuse" plan adds no new files unless justified)
2. missing backend or data dependencies
3. a phased plan, one commit per phase
4. what is out of scope

Show that output to the owner as-is and **stop**. Edit nothing until they approve. If they cut or change scope, update the spec and re-plan only the affected phases.

## 3. Revert point

Run `ui-checkpoint` once the plan is approved, before the first edit.

## 4. Build, one phase at a time

For each approved phase:

- Edit existing components rather than writing parallel ones. Fonts: `font-stashly` and the type scale (`text-xs` smallest), never raw `font-sans`/`font-mono`; a mockup's font classes are translated, not copied.
- No circular avatars or extra controls (pickers, toggles) the design doesn't show. No arbitrary Tailwind sizes. No ThemeProvider-dependent components.
- Authorization stays in actions, never loaders. New data goes through an `app/.server/*-actions.ts` function.
- Do not run typecheck mid-edit.

Then verify the phase:

- Run the `ui-verifier` subagent (light + dark, console, account, class resolution).
- Run the `mockup-diff-auditor` subagent against the design.
- Fix what they report. Re-run only the one that failed.

If browser verification is blocked (sign-in, pane issues), say so explicitly, do not commit, do not push.

## 5. Commit the phase

Run `ui-phase-commit`. Then next phase. After the last one, run `node .claude/hooks/check-staged-types.mjs --all` once.

## Red flags — stop

| Signal | Do instead |
|---|---|
| About to edit before the plan is approved | Stop; show the plan |
| "It should look right" | Run `ui-verifier` |
| A phase touching 3+ files nobody approved | Re-plan that phase |
| New file for something that exists | Grep, extend the existing one |
| Verification blocked and tempted to push | Report the block; do not push |
