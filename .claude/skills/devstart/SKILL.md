# Dev Start
1. Kill any orphan process on port 80 (HMR uses 24678 — leave it alone unless explicitly asked)
   ```bash
   netstat -ano | grep LISTENING | grep -E ':80\s' | awk '{print $5}' | sort -u | xargs -I{} taskkill /PID {} /F 2>/dev/null
   ```
2. Run `pnpm dev` in the background, capturing output to a temp log file:
   ```bash
   pnpm dev > /tmp/devstart.log 2>&1 &
   ```
3. Wait 5 seconds, then check if the server is responding:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost
   ```
   Expect `302`.
4. If the response is NOT `302`:
   - Read `/tmp/devstart.log` to find the error
   - Fix the error automatically (edit the relevant file)
   - Restart from step 1
5. Report: server is running at http://localhost

Do NOT use `pnpm build` or `pnpm start`. Do NOT loop on the curl check more than once — if it fails, read the log and fix, then re-check once. Port 5173 is not used — Vite runs as Express middleware on port 80 (`PORT` env, default 80).
