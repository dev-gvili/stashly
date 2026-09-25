---
name: new-stage
description: Scaffold a new file viewer stage that conforms to the existing stage pattern (audio, video, text, and similar). Use when adding support for a new file type to the viewer, when asked to "add a stage", "create a viewer for <format>", or when a file category renders no preview because no stage exists for it. Do not use for modifying existing stages, panels, or facets.
---

# New Viewer Stage

## Purpose

Add a new stage component to the file viewer so that an additional file type
renders correctly, while preserving the layout, props contract, and registration
conventions already established by the existing stages.

This skill produces a working, type-checked stage and nothing else. It is
deliberately narrow: scope creep into surrounding systems is the primary failure
mode it exists to prevent.

## Required inputs

Confirm these before writing any code. Ask the user for anything missing rather
than guessing.

| Input | Description |
| --- | --- |
| Stage name | The file type or format the stage handles (e.g. `pdf`, `image`, `markdown`). |
| Match criteria | The MIME types and/or file extensions that should resolve to this stage. |
| Rendering approach | How the content is displayed — native element, existing library already in the project, or plain text fallback. |
| Reference stage | The closest existing stage to model. Default to the audio stage if the user has no preference. |

## Workflow

### 1. Establish the pattern

Locate the stage directory (conventionally `src/components/stages/`) and list its
contents. Read the reference stage in full, plus one other stage, so the shared
contract is inferred from more than a single example.

Record the following before proceeding:

- The exported component signature and its props type.
- The container/layout structure shared across stages (spacing, centering,
  sizing, overflow handling).
- How loading, empty, and error states are represented.
- Any shared hooks, context, or utility imports every stage depends on.
- Naming and file conventions (file name casing, named vs. default export,
  colocated types).

### 2. Locate the registration point

Find the stage resolver — the map or switch that associates a file type with its
stage component. Note its exact shape and key format. Do not modify it yet.

### 3. Implement the stage

Create the new stage file alongside the existing ones. It must:

- Accept and satisfy the same props contract as the reference stage, without
  widening or narrowing it.
- Reuse the shared layout wrapper rather than reimplementing equivalent styling.
- Handle loading, empty, and error states consistently with its peers.
- Clean up any resources it creates (object URLs, listeners, observers, timers).
- Contain no type assertions used to bypass the existing contract.

Prefer composition over abstraction: if the new stage is similar to an existing
one, mirror it rather than refactoring both into a shared base.

### 4. Register the stage

Add exactly one entry to the stage resolver map, mapping the agreed match
criteria to the new component. This is the only file outside the new stage that
may be modified.

### 5. Verify

Run the project's type check and report the result verbatim:

```
pnpm typecheck
```

If the project also exposes a lint or test script covering this area, run it. Do
not modify unrelated files to make an unrelated pre-existing failure disappear;
report it instead and leave it in place.

### 6. Report

Summarize concisely:

- Files created and files modified, with paths.
- The props contract the stage implements.
- Type check output.
- Any assumption made in the absence of a confirmed input.
- Anything intentionally left undone, and why.

## Constraints

These are hard boundaries. Violating one means stopping and asking.

- **Do not install or add dependencies.** If the stage appears to require a new
  package, stop and propose it with a brief rationale and at least one
  dependency-free alternative.
- **Do not modify panels, facets, or any other surrounding subsystem.** If the
  stage cannot work without such a change, stop and describe what is needed.
- **Do not refactor existing stages,** even when duplication is obvious.
- **Do not alter the shared props contract or the resolver's structure** — add a
  single entry only.
- **Do not delete or replace existing files.** New stages are additive.

## Definition of done

- [ ] Reference stage and one peer stage read in full.
- [ ] New stage file created, matching the established layout and props contract.
- [ ] Exactly one entry added to the stage resolver map.
- [ ] No new dependencies; no changes to panels or facets.
- [ ] `pnpm typecheck` passes, or failures are reported and attributed.
- [ ] Summary delivered listing files touched and assumptions made.
