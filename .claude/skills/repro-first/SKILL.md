---
name: repro-first
description: Background discipline for any Stashly bug report, regression or "it's wrong" — reproduce with a failing test or a measurement before changing code, fix the root cause, then prove it. Use whenever a bug is reported or a fix is about to be written.
user-invocable: false
---

# Repro first

Order of work for a bug, no exceptions:

1. **Reproduce.** A failing test that fails *for the stated reason*, or a captured measurement/screenshot of the wrong behaviour. Run it against the unfixed code and show the failure. A test that passes on the old code proves nothing. (The gallery scope fix followed this: red test first, then the loader change.)
2. **Find the root cause.** Use `/rootcause` for a non-obvious one. If the owner says "still not working", your diagnosis was wrong: re-derive from evidence, don't patch the same theory. Deferring or debouncing a call that shouldn't happen at all is a workaround; call it that.
3. **Fix** the smallest thing that removes the cause, additively (don't weaken types or delete tests to make errors vanish). Stay inside the scope asked.
4. **Prove it.** The test goes green; for performance or behaviour in the browser use `/verify` with a before and after number from the same capture method. For a database cost use `sql-perf`.
5. **Report honestly:** what was reproduced, the cause, the change, the real numbers, and what you didn't verify.

Don't claim a fix from reading code. Don't loop the full suite chasing a flake: reproduce it in one file.
