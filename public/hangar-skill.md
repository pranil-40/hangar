---
name: hangar
description: Share a tool you built with the user's team by deploying it to Hangar, their private home for team tools. Use when the user asks to share, publish, deploy, host or "send to the team" a small web tool, dashboard, form or internal app, or asks to build one for their team.
---

# Deploying team tools to Hangar

Hangar hosts small tools for one team. A deployed tool is private to the team's
signed-in members, sandboxed, and gets shared storage and the viewer's identity
without any backend code. The user has already connected a deploy token.

## Before building

Build a static front end whose output folder has `index.html` at its top level.

1. **Relative asset paths.** `./assets/app.js`, never `/assets/app.js`. For Vite,
   set `base: "./"` in `vite.config`.
2. **One page.** Use hash routing (`#/settings`) for multiple views.
3. **No secrets.** No API keys, tokens or database URLs in the code. Hangar
   refuses a deploy that contains them, and tells you where they are.
4. **Hangar is the only network.** External APIs, CDNs and web fonts are
   blocked. Bundle every dependency.

## Identity and storage: `window.hangar`

Available before any of the tool's scripts run.

```js
hangar.user            // { id, name, email } of whoever is using the tool
hangar.role            // "OWNER" | "EDITOR" | "VIEWER"
hangar.app             // { id, name }

const requests = hangar.collection("requests");   // shared by the whole team
await requests.add({ title: "New laptop", amount: 1400 });
const all = await requests.list();                 // newest first, up to 500
await requests.update(all[0].id, { ...all[0].data, approved: true });
await requests.remove(all[0].id);
// each record: { id, data, createdBy, updatedBy, createdAt, updatedAt }
```

Records hold any JSON up to 64 KB and are stamped with who wrote them. For local
development outside Hangar, guard with `if (window.hangar)` and fall back to
`localStorage` so the tool still runs.

## Deploying

1. Build the tool (`npm run build` or equivalent).
2. Deploy the **build output folder**:
   - With the Hangar MCP server: call `hangar_deploy` with the absolute path to
     the build folder and a short tool name.
   - Otherwise: `node ~/.hangar/hangar.mjs deploy dist --name "Tool name"`
3. Give the user the URL it prints. Deploying again from the same project
   creates a new version of the same tool, which the team can roll back.

If the deploy is refused, the message says exactly what to change: fix that and
deploy again rather than working around it.
