// A team approvals tool with no backend of its own. Who is using it, the
// shared storage, and the rules about who may approve all come from Hangar
// (see hangar.json): anyone can request, only editors and owners can
// approve, nobody can edit a request after the fact, and the approver's
// name is stamped by Hangar's server, so it cannot be forged from the page.
//
// Outside Hangar it falls back to localStorage so it can be developed by
// opening index.html directly.

const local = {
  user: { id: "local", name: "You (local)", email: null },
  role: "OWNER",
  collection(name) {
    const key = `hangar-local:${name}`;
    const read = () => JSON.parse(localStorage.getItem(key) || "[]");
    const write = (rows) => localStorage.setItem(key, JSON.stringify(rows));
    const me = { id: "local", name: "You (local)" };
    return {
      list: async () => read(),
      add: async (data) => {
        const now = new Date().toISOString();
        const row = { id: String(Date.now()), data, createdBy: me, updatedBy: me, createdAt: now, updatedAt: now };
        write([row, ...read()]);
        return row;
      },
      can: () => true,
    };
  },
};

const hangar = window.hangar ?? local;
const requests = hangar.collection("requests");
const approvals = hangar.collection("approvals");

const $ = (id) => document.getElementById(id);
const money = (n) => `$${Number(n).toLocaleString("en-US")}`;

function showError(error) {
  $("error").hidden = !error;
  $("error").textContent = error ? error.message || String(error) : "";
}

function render(rows, approvalRows) {
  const approvedBy = new Map(approvalRows.map((a) => [a.data.requestId, a.createdBy.name]));
  const list = $("list");
  list.replaceChildren();
  for (const row of rows) {
    const item = document.createElement("li");
    const left = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = `${row.data.title} · ${money(row.data.amount)}`;
    const meta = document.createElement("div");
    meta.className = "meta";
    // createdBy comes from Hangar, not from what the page wrote.
    meta.textContent = `${row.createdBy.name} · ${new Date(row.createdAt).toLocaleDateString()}`;
    left.append(title, meta);

    const right = document.createElement("div");
    const approver = approvedBy.get(row.id);
    if (approver) {
      right.className = "status-approved";
      right.textContent = `Approved by ${approver}`;
    } else if (approvals.can("create")) {
      const approve = document.createElement("button");
      approve.className = "secondary";
      approve.textContent = "Approve";
      approve.onclick = () => approvals.add({ requestId: row.id }).then(refresh, showError);
      right.append(approve);
    } else {
      right.className = "status-pending";
      right.textContent = "Pending";
    }
    item.append(left, right);
    list.append(item);
  }
  $("footnote").textContent = rows.length
    ? `${rows.length} request${rows.length === 1 ? "" : "s"}, shared with everyone on the team.`
    : "No requests yet.";
}

function refresh() {
  return Promise.all([requests.list(), approvals.list()]).then(([rows, approvalRows]) => {
    showError(null);
    render(rows, approvalRows);
  }, showError);
}

$("who").textContent = `Signed in as ${hangar.user.name}`;
$("role").textContent = hangar.role.toLowerCase();

$("new-request").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  requests
    .add({ title: String(data.get("title")).trim(), amount: Number(data.get("amount")) })
    .then(() => {
      form.reset();
      return refresh();
    }, showError);
});

refresh();
