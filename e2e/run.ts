/**
 * End-to-end check of the hosting model in a real browser.
 *
 *   npm run dev            # in one terminal
 *   npm run e2e            # in another (re-seeds the database first)
 *
 * Covers the claims the product makes: a viewer can use a hosted tool with
 * identity and shared storage; the tool runs with an opaque origin and can
 * neither read nor send the viewer's session, nor send data off Hangar
 * (framed or opened directly); non-members get 404s; agents deploy through
 * the CLI and MCP server; credentials and root-absolute paths are refused;
 * rollback works; and demoting or removing someone disarms their tokens and
 * tickets immediately.
 *
 * Set E2E_BASE to test another server, and CHROMIUM_PATH if Playwright
 * cannot find a browser on its own.
 */
import { execFileSync, execSync, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { createPrismaClient } from "../src/lib/prisma-client";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Fall back to the ambient environment.
}

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const REPO = process.cwd();
const CLI = path.join(REPO, "public/hangar.mjs");

const results: { name: string; ok: boolean }[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function login(browser: Browser, email: string, password = "hangar123") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL(/\/teams|\/t\//, { timeout: 60_000 }), page.click('button[type="submit"]')]);
  return { context, page };
}

/** Records whether the session cookie went out with requests to /csrf-probe/*. */
function watchProbes(context: BrowserContext) {
  const seen: { path: string; cookie: boolean }[] = [];
  context.on("request", async (request) => {
    if (!request.url().includes("/csrf-probe/")) return;
    const headers = await request.allHeaders();
    seen.push({ path: new URL(request.url()).pathname, cookie: /hangar_session=/.test(headers.cookie ?? "") });
  });
  return seen;
}

async function main() {
  execSync("npm run db:seed", { stdio: "ignore" });
  const db = createPrismaClient();
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );

  // -------------------------------------------------- a viewer uses a hosted tool
  const viewer = await login(browser, "viewer@demo.test");
  const probes = watchProbes(viewer.context);
  await viewer.page.goto(`${BASE}/t/acme-ops`);
  await viewer.page.click("text=Purchase requests");
  await viewer.page.waitForURL(/\/apps\//);
  const appId = viewer.page.url().split("/apps/")[1];
  const frameElement = await viewer.page.waitForSelector("iframe");
  check("iframe sandbox omits allow-same-origin", !(await frameElement.getAttribute("sandbox"))!.includes("allow-same-origin"));
  const frame = (await frameElement.contentFrame())!;
  await frame.waitForSelector("#list li", { timeout: 60_000 });
  check("tool sees the viewer's identity", (await frame.textContent("#who"))!.includes("Jo Whitfield"));
  check("tool sees the viewer's role", (await frame.textContent("#role")) === "viewer");
  check("tool lists shared records", (await frame.$$("#list li")).length === 3);
  check("viewer gets no approve button", (await frame.$$("button.secondary")).length === 0);

  await frame.fill('input[name="title"]', "Ergonomic chair");
  await frame.fill('input[name="amount"]', "320");
  await frame.click('button[type="submit"]');
  await frame.waitForFunction(() => document.querySelectorAll("#list li").length === 4, null, { timeout: 30_000 });
  check("viewer can add a record", (await frame.textContent("#list li:first-child"))!.includes("Ergonomic chair"));

  // Passed as source text: tsx rewrites named inner functions with a helper
  // that does not exist inside the page.
  const probe: Record<string, string> = await frame.evaluate(`(async () => {
    const out = { origin: window.origin };
    const attempt = async (key, fn) => {
      try {
        const value = await fn();
        out[key] = typeof value === "string" ? value : "ok";
      } catch (error) {
        out[key] = "threw " + error.name;
      }
    };
    await attempt("cookie", () => document.cookie);
    await attempt("parent", () => parent.document.title);
    await attempt("storage", () => localStorage.getItem("x"));
    await attempt("hangarPage", () => fetch("/t/acme-ops").then((r) => "status " + r.status));
    await attempt("external", () => fetch("https://example.com/").then(() => "reached"));
    await attempt("probeGet", () => fetch("/csrf-probe/get", { mode: "no-cors", credentials: "include" }));
    await attempt("probePost", () => fetch("/csrf-probe/post", { method: "POST", mode: "no-cors", credentials: "include", body: "x=1" }));
    out.bootstrap = typeof window.__HANGAR__;
    return out;
  })()`);
  check("tool runs with an opaque origin", probe.origin === "null", probe.origin);
  check("tool cannot read cookies", probe.cookie.startsWith("threw"), probe.cookie);
  check("tool cannot reach Hangar's DOM", probe.parent.startsWith("threw"), probe.parent);
  check("tool cannot read Hangar pages", probe.hangarPage.startsWith("threw"), probe.hangarPage);
  check("tool cannot send data off Hangar", probe.external.startsWith("threw"), probe.external);
  check("bootstrap global is removed", probe.bootstrap === "undefined");

  const direct = await viewer.context.newPage();
  await direct.goto(`${BASE}/run/${appId}`);
  await direct.waitForSelector("#list li", { timeout: 30_000 });
  check("direct /run tab is sandboxed too", (await direct.evaluate(() => window.origin)) === "null");
  check("direct /run tab works", (await direct.$$("#list li")).length === 4);
  await direct.evaluate(
    `fetch("/csrf-probe/direct", { method: "POST", mode: "no-cors", credentials: "include", body: "x=1" }).catch(() => {})`,
  );
  await viewer.page.waitForTimeout(1500);
  check("credentialed requests from tools never carry the session", probes.length >= 3 && probes.every((p) => !p.cookie), `${probes.length} probes`);

  const html = await (await viewer.context.request.get(`${BASE}/run/${appId}`)).text();
  const assetBase = /<base href="([^"]+)"/.exec(html)![1];
  const toolToken = /"token":"([^"]+)"/.exec(html)![1];
  const assetUrl = `${BASE}${assetBase}app.js`;
  const anon = await browser.newContext();
  check("asset served under the viewer's ticket", (await anon.request.get(assetUrl)).status() === 200);
  check("HTML is never served from the asset path", (await anon.request.get(`${BASE}${assetBase}index.html`)).status() === 404);
  check("tampered asset ticket rejected", (await anon.request.get(`${BASE}${assetBase.replace(/.\/$/, "x/")}app.js`)).status() === 404);
  const me = await anon.request.get(`${BASE}/api/tool/v1/me`, { headers: { authorization: `Bearer ${toolToken}` } });
  check("tool API accepts the viewer's ticket", me.status() === 200);
  const forged = await browser.newContext({
    storageState: {
      cookies: [{ name: "hangar_session", value: toolToken, domain: new URL(BASE).hostname, path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }],
      origins: [],
    },
  });
  check("a tool ticket is not a login cookie", (await forged.request.get(`${BASE}/teams`, { maxRedirects: 0 })).status() !== 200);

  // -------------------------------------------------- a non-member
  const outsider = await browser.newContext();
  const signup = await outsider.newPage();
  await signup.goto(`${BASE}/signup`);
  await signup.fill('input[name="name"]', "Outsider");
  await signup.fill('input[name="email"]', `outsider-${Date.now()}@example.test`);
  await signup.fill('input[name="password"]', "outsider123");
  await Promise.all([signup.waitForURL(/\/teams/), signup.click('button[type="submit"]')]);
  check("non-member gets 404 on /run", (await outsider.request.get(`${BASE}/run/${appId}`)).status() === 404);
  check("non-member gets 404 on the team", (await outsider.request.get(`${BASE}/t/acme-ops`)).status() === 404);

  // -------------------------------------------------- an editor's agent deploys
  const editor = await login(browser, "editor@demo.test");
  await editor.page.goto(`${BASE}/t/acme-ops/settings`);
  await editor.page.fill('input[aria-label="Token name"]', "e2e laptop");
  await editor.page.click("text=Create token");
  await editor.page.waitForSelector("pre.code-block", { timeout: 30_000 });
  const token = (await editor.page.textContent("pre.code-block"))!.trim();
  check("deploy token shown once", token.startsWith("hgr_"));

  const home = mkdtempSync(path.join(tmpdir(), "hangar-home-"));
  const project = mkdtempSync(path.join(tmpdir(), "hangar-proj-"));
  cpSync(path.join(REPO, "examples/purchase-requests"), path.join(project, "dist"), { recursive: true });
  writeFileSync(path.join(project, "dist/.env"), "SECRET=should-never-ship\n");
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home };
  delete env.HANGAR_URL;
  delete env.HANGAR_TOKEN;
  const cli = (args: string[], cwd = project) => {
    try {
      return { ok: true, out: execFileSync("node", [CLI, ...args], { cwd, env, encoding: "utf8", stdio: "pipe" }) };
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };

  const loggedIn = cli(["login", BASE, token]);
  check("CLI login", loggedIn.ok && loggedIn.out.includes("Sam Okonkwo"));
  const first = cli(["deploy", "dist", "--name", "Team requests (CLI)"]);
  check("CLI deploy creates a tool", first.ok && first.out.includes("version 1 is live"), first.out.split("\n")[0]);
  const link = JSON.parse(readFileSync(path.join(project, ".hangar.json"), "utf8"));
  const second = cli(["deploy", "dist"]);
  check("redeploy makes version 2", second.ok && second.out.includes("version 2 is live"));

  const deployedHtml = await (await editor.context.request.get(`${BASE}/run/${link.appId}`)).text();
  const editorBase = /<base href="([^"]+)"/.exec(deployedHtml)![1];
  check(".env was never uploaded", (await editor.context.request.get(`${BASE}${editorBase}.env`)).status() === 404);

  const bad = mkdtempSync(path.join(tmpdir(), "hangar-bad-"));
  mkdirSync(path.join(bad, "dist"));
  writeFileSync(path.join(bad, "dist/index.html"), `<html><head></head><body><script>const k="sk_live_${"a".repeat(24)}";</script></body></html>`);
  const leaky = cli(["deploy", "dist", "--name", "Leaky"], bad);
  check("deploy containing a Stripe key is refused", !leaky.ok && leaky.out.includes("Stripe secret key"));
  writeFileSync(path.join(bad, "dist/index.html"), `<html><head><script src="/assets/app.js"></script></head></html>`);
  const absolute = cli(["deploy", "dist", "--name", "Abs"], bad);
  check("root-absolute asset paths refused with the fix", !absolute.ok && absolute.out.includes('base: "./"'));

  // -------------------------------------------------- the MCP server
  const mcp = spawn("node", [CLI, "mcp"], { cwd: project, env });
  const responses: { id?: number; result?: Record<string, unknown> }[] = [];
  let buffer = "";
  mcp.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      responses.push(JSON.parse(buffer.slice(0, index)));
      buffer = buffer.slice(index + 1);
    }
  });
  const send = (message: object) => mcp.stdin.write(JSON.stringify(message) + "\n");
  const response = async (id: number) => {
    for (let i = 0; i < 600; i++) {
      const found = responses.find((r) => r.id === id);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`no MCP response for ${id}`);
  };
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", clientInfo: { name: "claude-code", version: "e2e" }, capabilities: {} } });
  const init = await response(1);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const list = await response(2);
  send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hangar_deploy", arguments: { directory: path.join(project, "dist") } } });
  const call = await response(3);
  mcp.kill();
  const tools = (list.result?.tools as { name: string }[] | undefined)?.map((t) => t.name).join(",");
  const callText = (call.result?.content as { text: string }[] | undefined)?.[0]?.text ?? "";
  check("MCP initialize", (init.result?.serverInfo as { name?: string })?.name === "hangar");
  check("MCP lists deploy and guide tools", tools === "hangar_deploy,hangar_build_guide");
  check("MCP deploy makes version 3", !call.result?.isError && callText.includes("version 3 is live"));

  // -------------------------------------------------- rollback and the activity log
  await editor.page.goto(`${BASE}/t/acme-ops/apps/${link.appId}`);
  const makeLive = await editor.page.$$("text=Make live");
  check("versions table offers rollback", makeLive.length === 2);
  await makeLive[makeLive.length - 1].click();
  await editor.page.waitForFunction(() => document.body.innerText.includes("Version 1, deployed"), null, { timeout: 30_000 });
  check("rollback makes v1 live", true);

  const owner = await login(browser, "owner@demo.test");
  await owner.page.goto(`${BASE}/t/acme-ops/activity`);
  const activity = (await owner.page.textContent("main"))!;
  check("activity log records deploys and rollback", activity.includes("deployed Team requests (CLI) v3 via claude-code") && activity.includes("rolled back"));

  // -------------------------------------------------- revocation is immediate
  const editorUser = await db.user.findUniqueOrThrow({ where: { email: "editor@demo.test" } });
  const viewerUser = await db.user.findUniqueOrThrow({ where: { email: "viewer@demo.test" } });
  await db.membership.updateMany({ where: { userId: editorUser.id }, data: { role: "VIEWER" } });
  const demoted = cli(["deploy", "dist"]);
  check("a demoted editor's token stops deploying", !demoted.ok && demoted.out.includes("cannot deploy"));
  await db.membership.deleteMany({ where: { userId: viewerUser.id } });
  check("a removed viewer's asset ticket stops working", (await anon.request.get(assetUrl)).status() === 404);
  check("a removed viewer's tool ticket stops working", (await anon.request.get(`${BASE}/api/tool/v1/me`, { headers: { authorization: `Bearer ${toolToken}` } })).status() === 401);

  await browser.close();
  await db.$disconnect();
  execSync("npm run db:seed", { stdio: "ignore" });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}

// Exit explicitly on failure: an open browser or database connection would
// otherwise keep the process alive after the error is printed.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
