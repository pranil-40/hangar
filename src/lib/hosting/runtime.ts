/**
 * How a hosted tool's page is served.
 *
 * A tool is code written by an agent on behalf of one team member and run
 * in every other member's browser. It must never be able to act as the
 * person viewing it, and the data it shows should not leave Hangar.
 *
 * 1. Opaque origin. The page is served with a CSP `sandbox` directive (and
 *    framed with the matching iframe attribute) without allow-same-origin,
 *    so it cannot read Hangar's cookies, storage or DOM and its requests to
 *    Hangar carry no session.
 * 2. Requests stay on Hangar. `connect-src 'self'` and friends block fetch,
 *    XHR, WebSocket, beacons, images and scripts from anywhere else, and
 *    `form-action 'self'` blocks posting a form out.
 * 3. Navigation stays on Hangar. No allow-popups or allow-top-navigation,
 *    so the tool cannot open a window or move the page. The tool is always
 *    framed by a Hangar page whose `frame-src 'self'` stops the frame itself
 *    from navigating elsewhere; /run refuses to be a top-level document and
 *    sends direct visits to the framed /open view instead.
 * 4. No credentials. The only thing a tool holds is a ticket for its own
 *    data API, scoped to one tool and one viewer, re-checked against
 *    membership on each call, and limited by the tool's collection rules.
 *
 * Known residual channel: WebRTC (STUN) requests, which no browser lets a
 * page's CSP block. See SECURITY.md.
 */

export const TOOL_SANDBOX = ["allow-scripts", "allow-forms", "allow-modals", "allow-downloads"].join(" ");

export const TOOL_CSP = [
  `sandbox ${TOOL_SANDBOX}`,
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-src 'none'",
  "frame-ancestors 'self'",
].join("; ");

/** For static assets: inert if someone opens an SVG or HTML file directly. */
export const ASSET_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export const TOOL_API_BASE = "/api/tool/v1";

export type Bootstrap = {
  api: string;
  token: string;
  user: { id: string; name: string; email: string | null };
  role: string;
  app: { id: string; name: string };
  /** The tool's collection rules, so it can hide what the server would refuse. */
  rules: { collections: Record<string, Record<string, string>>; strict: boolean; defaults: Record<string, string> };
};

/** JSON that is safe to place inside an inline <script>. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * The `window.hangar` object every tool gets. Kept dependency-free and
 * small so an agent can read the whole contract in one glance; the same
 * contract is documented in integrations/claude-code/hangar/SKILL.md.
 */
export const CLIENT_SCRIPT = `(function () {
  var cfg = window.__HANGAR__;
  try { delete window.__HANGAR__; } catch (e) { window.__HANGAR__ = undefined; }
  function call(method, path, body) {
    return fetch(cfg.api + path, {
      method: method,
      headers: { authorization: "Bearer " + cfg.token, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "omit",
      cache: "no-store"
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var error = new Error(json.error || "Hangar request failed (" + res.status + ")");
          error.status = res.status;
          throw error;
        }
        return json;
      });
    });
  }
  var rank = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
  function allowed(rule, record) {
    if (rule === "anyone") return true;
    if (rule === "nobody") return false;
    if (rule === "owner") return cfg.role === "OWNER";
    if (rule === "editor") return rank[cfg.role] >= 1;
    return rank[cfg.role] >= 1 || !record || (record.createdBy && record.createdBy.id === cfg.user.id);
  }
  function collection(name) {
    var base = "/records/" + encodeURIComponent(name);
    var rules = cfg.rules.collections[name] || (cfg.rules.strict ? null : cfg.rules.defaults);
    return Object.freeze({
      list: function () { return call("GET", base).then(function (j) { return j.records; }); },
      add: function (data) { return call("POST", base, { data: data }).then(function (j) { return j.record; }); },
      update: function (id, data) { return call("PUT", base + "/" + encodeURIComponent(id), { data: data }).then(function (j) { return j.record; }); },
      remove: function (id) { return call("DELETE", base + "/" + encodeURIComponent(id)).then(function () {}); },
      // For showing or hiding buttons only. The server enforces the same rules.
      can: function (action, record) { return !!rules && allowed(rules[action], record); }
    });
  }
  function connector(slug) {
    var base = "/connectors/" + encodeURIComponent(slug) + "/query";
    return Object.freeze({
      query: function (name, params) { return call("POST", base, { query: name, params: params || [] }); }
    });
  }
  window.hangar = Object.freeze({
    user: Object.freeze(cfg.user),
    role: cfg.role,
    app: Object.freeze(cfg.app),
    collection: collection,
    connector: connector
  });
})();`;

/**
 * Puts the asset <base> and the runtime script at the very top of <head>,
 * ahead of anything the tool declares. The first <base> in a document wins,
 * which is what makes relative asset paths resolve to the ticketed prefix.
 */
export function injectRuntime(html: string, assetBase: string, bootstrap: Bootstrap): string {
  const escapedBase = assetBase.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const snippet =
    `<base href="${escapedBase}">` +
    `<script>window.__HANGAR__=${scriptSafeJson(bootstrap)};</script>` +
    `<script>${CLIENT_SCRIPT}</script>`;

  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + snippet + html.slice(at);
  }
  const root = /<html(\s[^>]*)?>/i.exec(html);
  if (root) {
    const at = root.index + root[0].length;
    return `${html.slice(0, at)}<head>${snippet}</head>${html.slice(at)}`;
  }
  return `<!doctype html><head>${snippet}</head>${html}`;
}
