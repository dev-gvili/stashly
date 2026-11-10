---
name: design-intake
description: Use to turn a design source — a published artifact URL, a mockup HTML file, or a Claude Design project — into a one-page implementation spec before any code is written. Called by ui-port; also "/design-intake <url or path>". Stashly repo.
disable-model-invocation: true
---

# Design intake

Produce `<scratchpad>/design-spec.md`: everything an implementer needs, so the design is read once.

**Core principle: describe the design in Stashly's vocabulary.** A spec that says "16px Inter, #f5f5f5" produces a rebuild; one that says "`text-sm`, `bg-muted`, `ItemCard`" produces a port.

## Reading the source

| Source | How |
|---|---|
| Artifact URL | `Artifact` `action: "read"`, then Read the saved file it names. Read only what you need to extract components, tokens and states; do not paste it back. |
| HTML mockup | Read the file. Never edit it. |
| Claude Design project | Use the `DesignSync` tool (load it with ToolSearch). The project id, key files and round-trip workflow are in memory `reference_claude_design_project`. |

## What the spec contains

Keep it to one page.

1. **Regions**: each distinct area of the page, in order, with its purpose.
2. **Components**: for each region, the existing Stashly component it maps to (grep `app/components/` and `app/components/ui/`; check `ItemCard` parts, `DataTable`, dialogs, `SelectionProvider`). Mark "no match" explicitly.
3. **Tokens**: the design's colours, radii, spacing and type, translated to Stashly tokens and the type scale (see `app/styles/globals.css`). Raw fonts become `font-stashly`. List anything with no token.
4. **States**: empty, loading, error, selected, hover, dark mode. Mark states the design omits as "not in design" — do not invent them.
5. **Data**: for each region, the field it needs and whether it exists today (loader/action/Prisma select). List missing fields as backend dependencies.
6. **Not in spec**: controls, avatars or behaviours the design does not show. The implementer must not add them.
7. **Routes**: new routes (in `app/routes.ts`) vs edited ones.

## Rules

- Never invent a value the design doesn't give (Data Honesty): write "unspecified".
- Don't read `prisma/models/*.prisma` unless a data row needs it, and then only the model named.
- Report the spec path and a three-line summary. Nothing else.
