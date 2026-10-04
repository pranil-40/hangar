#!/usr/bin/env node
// Hangar CLI and MCP server. One file, no dependencies, Node 18+.
//
//   node hangar.mjs login <hangar-url> <deploy-token>
//   node hangar.mjs deploy [dir] [--name "Tool name"] [--description "..."] [--new]
//   node hangar.mjs whoami
//   node hangar.mjs mcp            # speak MCP over stdio, for coding agents
//
// HANGAR_URL and HANGAR_TOKEN override the saved login, for CI and agents.

import { mkdir, readFile, readdir, stat, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

const VERSION = "0.2.0";
const CONFIG_DIR = path.join(homedir(), ".hangar");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const LINK_FILE = ".hangar.json";
const LIMITS = { maxFiles: 500, maxTotalBytes: 3 * 1024 * 1024 };
const SKIP_DIRS = new Set(["node_modules"]);

export const GUIDE = `Hangar hosts small tools for one team: a single web page plus its assets, served
privately to signed-in team members, sandboxed, with shared storage built in.

BUILD RULES
1. Static front end only. Deploy the folder that contains index.html at its top
   level (for Vite, React, Svelte etc. that is the build output, e.g. dist/).
2. Relative asset paths: "./assets/app.js", never "/assets/app.js".
   Vite: set base: "./" in vite.config.
3. One page. Use hash routing (#/settings) if you need more than one view.
4. No secrets: no API keys, tokens or database URLs anywhere in the code.
   Hangar refuses a deploy that contains them.
5. The page can only talk to Hangar. External APIs, CDNs and web fonts are
   blocked, so bundle every dependency into the build.

RUNTIME API (window.hangar exists before your scripts run)
  hangar.user                 { id, name, email } of the person using the tool
  hangar.role                 "OWNER" | "EDITOR" | "VIEWER"
  hangar.app                  { id, name }
  hangar.collection(name)     shared, team-wide storage. Returns:
    .list()                   -> Promise<Record[]> (newest first, up to 500)
    .add(data)                -> Promise<Record>
    .update(id, data)         -> Promise<Record>
    .remove(id)               -> Promise<void>
  Record = { id, data, createdBy, updatedBy, createdAt, updatedAt }; data is
  any JSON value up to 64 KB. Collection names: letters, numbers, - and _.

For local development outside Hangar, check \`if (window.hangar)\` and fall back
to localStorage so the tool still runs.

DEPLOY
  MCP: call hangar_deploy with the build directory and a tool name.
  CLI: node ~/.hangar/hangar.mjs deploy dist --name "Tool name"
Deploying again from the same project updates the same tool as a new version.`;

// ---------------------------------------------------------------- config

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function loadConfig() {
  const saved = (await readJson(CONFIG_FILE)) ?? {};
  const url = process.env.HANGAR_URL ?? saved.url;
  const token = process.env.HANGAR_TOKEN ?? saved.token;
  if (!url || !token) {
    throw new UserError(
      "Not logged in. Create a deploy token in Hangar (Settings → Deploy tokens), then run:\n" +
        "  node hangar.mjs login <hangar-url> <token>",
    );
  }
  return { url: url.replace(/\/+$/, ""), token };
}

class UserError extends Error {}

async function api(config, method, route, body) {
  let response;
  try {
    response = await fetch(`${config.url}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${config.token}`,
        ...(body ? { "content-type": "application/json" } : {}),
        "user-agent": `hangar-cli/${VERSION}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new UserError(`Could not reach ${config.url}: ${error.message}`);
  }
  const json = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

// ---------------------------------------------------------------- bundle

async function collectFiles(root) {
  const info = await stat(root).catch(() => null);
  if (!info || !info.isDirectory()) {
    throw new UserError(`${root} is not a directory. Point deploy at your build folder (e.g. dist/).`);
  }

  const files = [];
  let total = 0;

  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      // Dotfiles never ship: a stray .env is the classic leak.
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = await readFile(full);
      total += bytes.length;
      if (files.length >= LIMITS.maxFiles) {
        throw new UserError(`More than ${LIMITS.maxFiles} files. Deploy the build folder, not the project.`);
      }
      if (total > LIMITS.maxTotalBytes) {
        throw new UserError("Bigger than 3 MB. Deploy the build folder (dist/), not the project folder.");
      }
      files.push({
        path: path.relative(root, full).split(path.sep).join("/"),
        data: bytes.toString("base64"),
      });
    }
  }

  await walk(root);
  if (!files.some((file) => file.path === "index.html")) {
    throw new UserError(
      `No index.html at the top of ${root}. Build the tool first and deploy the output folder.`,
    );
  }
  return { files, total };
}

function detectAgent() {
  if (process.env.CLAUDECODE === "1") return "claude-code";
  return undefined;
}

// ---------------------------------------------------------------- deploy

async function deploy({ dir, name, description, fresh, agent, source, cwd }) {
  const config = await loadConfig();
  const base = cwd ?? process.cwd();
  const root = path.resolve(base, dir ?? ".");
  const linkPath = path.join(base, LINK_FILE);
  const link = fresh ? null : await readJson(linkPath);
  const sameHangar = link && link.url === config.url;

  if (!sameHangar && !name) {
    throw new UserError('This is a new tool, so give it a name: --name "Refund approvals".');
  }

  const { files, total } = await collectFiles(root);
  const body = {
    files,
    source,
    ...(name ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(sameHangar && link.appId ? { appId: link.appId } : {}),
    ...(agent ? { agent } : {}),
  };

  const result = await api(config, "POST", "/api/v1/deploy", body);
  if (!result.ok) {
    const lines = [result.json.error ?? `Deploy failed (${result.status}).`];
    for (const finding of result.json.findings ?? []) {
      lines.push(`  ${finding.kind} in ${finding.path}:${finding.line} (${finding.preview})`);
    }
    for (const ref of result.json.refs ?? []) lines.push(`  ${ref}`);
    if (result.status === 404 && body.appId) {
      lines.push(`The tool linked in ${LINK_FILE} is gone. Deploy with --new to create a fresh one.`);
    }
    throw new UserError(lines.join("\n"));
  }

  await writeFile(
    linkPath,
    JSON.stringify({ url: config.url, team: result.json.team, appId: result.json.app.id, name: result.json.app.name }, null, 2) + "\n",
  );

  return {
    ...result.json,
    fileCount: files.length,
    totalBytes: total,
    linkFile: linkPath,
  };
}

function summarise(result) {
  const lines = [
    `${result.created ? "Created" : "Updated"} "${result.app.name}": version ${result.version} is live.`,
    `Open it: ${result.url}`,
    `${result.fileCount} files, ${Math.max(1, Math.round(result.totalBytes / 1024))} KB. Only members of ${result.team} can open it.`,
  ];
  for (const warning of result.warnings ?? []) lines.push(`Warning: ${warning}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else flags[key] = argv[++i];
    } else positional.push(arg);
  }
  return { positional, flags };
}

async function login(url, token) {
  if (!url || !token) throw new UserError("Usage: node hangar.mjs login <hangar-url> <token>");
  const config = { url: url.replace(/\/+$/, ""), token };
  const result = await api(config, "GET", "/api/v1/whoami");
  if (!result.ok) throw new UserError(result.json.error ?? `Login failed (${result.status}).`);
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await chmod(CONFIG_FILE, 0o600);
  const { user, team, role } = result.json;
  return `Logged in as ${user.name} (${role.toLowerCase()}) in ${team.name}. Saved to ${CONFIG_FILE}.`;
}

async function whoami() {
  const config = await loadConfig();
  const result = await api(config, "GET", "/api/v1/whoami");
  if (!result.ok) throw new UserError(result.json.error ?? `Failed (${result.status}).`);
  const { user, team, role } = result.json;
  return `${user.name} <${user.email}>, ${role.toLowerCase()} in ${team.name} on ${config.url}`;
}

// ---------------------------------------------------------------- MCP

const MCP_TOOLS = [
  {
    name: "hangar_deploy",
    description:
      "Publish a built web tool to the user's team on Hangar, behind their team sign-in. " +
      "Deploy the BUILD OUTPUT folder (the one with index.html at the top, e.g. dist/). " +
      "Deploying again from the same project updates the same tool. Read hangar_build_guide first if you have not.",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Absolute path to the build output folder." },
        name: { type: "string", description: "Tool name shown to the team. Required for a new tool." },
        description: { type: "string", description: "One sentence on what the tool is for." },
        new: { type: "boolean", description: "Create a new tool even if this project was deployed before." },
      },
      required: ["directory"],
    },
  },
  {
    name: "hangar_build_guide",
    description:
      "How to build a tool that runs on Hangar: build rules and the window.hangar API for the current user and shared team storage. Read before writing a tool meant for Hangar.",
    inputSchema: { type: "object", properties: {} },
  },
];

function runMcp() {
  let clientName;
  const send = (message) => process.stdout.write(JSON.stringify(message) + "\n");
  const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
  const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return fail(null, -32700, "Parse error");
    }
    const { id, method, params } = message;
    const isRequest = id !== undefined && id !== null;

    try {
      switch (method) {
        case "initialize":
          clientName = params?.clientInfo?.name;
          return reply(id, {
            protocolVersion: params?.protocolVersion ?? "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "hangar", version: VERSION },
            instructions:
              "Use hangar_deploy to share a built tool with the user's team. Call hangar_build_guide before building a tool for Hangar.",
          });
        case "ping":
          return reply(id, {});
        case "tools/list":
          return reply(id, { tools: MCP_TOOLS });
        case "tools/call": {
          const args = params?.arguments ?? {};
          if (params?.name === "hangar_build_guide") {
            return reply(id, { content: [{ type: "text", text: GUIDE }] });
          }
          if (params?.name === "hangar_deploy") {
            try {
              const agent = (clientName ?? detectAgent() ?? "").replace(/[^A-Za-z0-9 ._-]/g, "").slice(0, 40);
              const directory = String(args.directory ?? "");
              const result = await deploy({
                dir: directory,
                name: args.name,
                description: args.description,
                fresh: Boolean(args.new),
                agent: agent || undefined,
                source: "MCP",
                // Remember the tool per project: the folder above the build output.
                cwd: path.dirname(path.resolve(directory)),
              });
              return reply(id, { content: [{ type: "text", text: summarise(result) }] });
            } catch (error) {
              return reply(id, {
                content: [{ type: "text", text: error instanceof UserError ? error.message : String(error) }],
                isError: true,
              });
            }
          }
          return fail(id, -32602, `Unknown tool: ${params?.name}`);
        }
        default:
          if (isRequest) return fail(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      if (isRequest) fail(id, -32603, String(error));
    }
  });
}

// ---------------------------------------------------------------- main

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case "login":
      return console.log(await login(positional[0], positional[1]));
    case "whoami":
      return console.log(await whoami());
    case "deploy": {
      const result = await deploy({
        dir: positional[0],
        name: typeof flags.name === "string" ? flags.name : undefined,
        description: typeof flags.description === "string" ? flags.description : undefined,
        fresh: Boolean(flags.new),
        agent: typeof flags.agent === "string" ? flags.agent : detectAgent(),
        source: "CLI",
      });
      return console.log(summarise(result));
    }
    case "guide":
      return console.log(GUIDE);
    case "mcp":
      return runMcp();
    case "--version":
    case "version":
      return console.log(VERSION);
    default:
      console.log(`hangar ${VERSION}
  login <url> <token>     save a deploy token
  deploy [dir] --name N   publish a built tool (dir defaults to .)
  whoami                  show who the saved token acts as
  guide                   how to build a tool for Hangar
  mcp                     run as an MCP server for coding agents`);
  }
}

main().catch((error) => {
  console.error(error instanceof UserError ? error.message : error);
  process.exit(1);
});
