---
name: rootcause
description: Use when diagnosing a bug before any fix — "/rootcause", "why is this broken", "find the root cause", an error or unexpected behaviour. Stashly repo.
---
1. Reproduce: capture the exact error/console/network output.
2. State the root cause in ONE sentence + the evidence line that proves it.
3. List the minimal file set to change. If it includes prisma/ or migrations/, STOP and ask.
4. Wait for approval before editing.
5. After the fix, prove it with the `verify` skill. For a performance or count problem, make step 1's reproduction record the number, or `verify` will have to set the fix aside to measure it.
