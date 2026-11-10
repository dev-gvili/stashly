---
name: tech-debt-item
description: Use to add, update, resolve or decline one item in docs/tech-debt.md without reading the whole 1,668-line doc — "/tech-debt-item <n>", "strike item 81", "register a new tech-debt item", "mark #68 resolved". Stashly repo.
disable-model-invocation: true
---

# Tech-debt item

Edit one item consistently, touching only its places.

**Core principle: an item lives in four places and they change together.** Read only those, by item number.

| Place | Find it | Shape |
|---|---|---|
| Register row | `grep -n "^| <n> |" docs/tech-debt.md` (two tables: *What's left* ~line 205 and *Prioritized register* ~line 293) | `\| n \| title \| score \| remains \| blocked \|` and `\| n \| title \| kind \| Impact \| Risk \| Effort \| **score** (band) \| est. \| status \|` |
| Detail section | `grep -n "^### <n>\. " docs/tech-debt.md`, read to the next `###` | `*Kind · Impact · Risk · Effort → **score** · est. · source*`, then **Evidence**, **Fix**, **Status <date>: …** |
| Changes row | `grep -n "\| <n> \|" docs/tech-debt.md` in *Changes since the audit* | `\| date \| \`sha\` \| n \| what changed \|` |
| Date line | `**Now (<d Mon>):**` near the top | The build refuses to run without it; the page's "Updated" chip reads it |

Use a neighbouring item of the same status as the template: read item 80 for a resolved one, item 81 for an open one. Don't read other items.

## Operations

- **Add:** next number = highest `### n.` + 1 (`grep -c "^### [0-9]" docs/tech-debt.md`, check the last heading). Add the register row, the *What's left* row, the detail section, in that order. Score = (Impact + Risk) × (6 − Effort).
- **Update evidence/status:** edit the detail section; fix the *What's left* "remains" cell to match.
- **Resolve:** strike the title (`~~…~~`) in both tables; *What's left* remains cell starts `Resolved YYYY-MM-DD (\`sha\`): …` with the measured result (the build turns it into "Done"); register status `Resolved <d Mon>`; detail **Status YYYY-MM-DD: resolved**; add a Changes row. Never write a result you didn't measure (Data Honesty).
- **Decline:** remains cell starts `Declined YYYY-MM-DD:` with the numbers that justify it.

Then update the **Now** line's date if it's older than today, and note the count of open items only if it's already stated there.

## After

The doc is the source. Commit it (`/ship`), then run the `tech-debt-publisher` subagent. Don't read or edit the published page.
