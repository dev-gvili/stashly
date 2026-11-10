# Dev Stop

1. Kill any process on port 80:
   ```bash
   lsof -ti:80 | xargs kill -9 2>/dev/null || true # allow-dev-kill
   ```
   On Windows (bash fallback):
   ```bash
   netstat -ano | grep LISTENING | grep -E ':80\s' | awk '{print $5}' | sort -u | xargs -I{} taskkill /PID {} /F 2>/dev/null || true # allow-dev-kill
   ```
   The `# allow-dev-kill` comment is what lets this past `.claude/hooks/dev-server-guard.mjs`; keep it on any command this skill runs. Only run this skill when the owner invoked it.
   Note: `pnpm dev` spawns `node server.js` as a child — killing the pnpm wrapper alone leaves the node listener orphaned, so always kill by port, not by task.

2. Confirm port 80 is free:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost
   ```
   Expect a connection refused error (empty response or non-200). If a process is still listening, repeat step 1 once.

3. Report: port 80 is free.
