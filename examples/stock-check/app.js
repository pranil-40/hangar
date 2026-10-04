// Reads live stock levels from the store's database through a Hangar
// connector. The tool never sees the database credentials; it can only run
// the "lowStock" query declared in hangar.json, after an owner approved it.
// Crew counts are saved as records, stamped with who counted.

const $ = (id) => document.getElementById(id);
const hangar = window.hangar;

function showError(error) {
  $("error").hidden = !error;
  $("error").textContent = error ? error.message || String(error) : "";
}

function row(text, meta) {
  const item = document.createElement("li");
  const left = document.createElement("div");
  left.textContent = text;
  if (meta) {
    const small = document.createElement("div");
    small.className = "meta";
    small.textContent = meta;
    left.append(small);
  }
  item.append(left);
  return item;
}

async function loadLowStock() {
  try {
    const result = await hangar.connector("stock-db").query("lowStock", ["downtown"]);
    $("low").replaceChildren(
      ...result.rows.map((r) => row(`${r.item}: ${r.on_hand} left`, `par ${r.par} · ${r.sku}`)),
    );
    $("source").textContent = result.rows.length ? "Live from the inventory database." : "Everything is at or above par.";
  } catch (error) {
    $("source").textContent = error.message;
  }
}

async function loadCounts() {
  const counts = await hangar.collection("counts").list();
  $("counts").replaceChildren(
    ...counts.slice(0, 20).map((c) => row(`${c.data.item}: ${c.data.qty}`, `${c.createdBy.name} · ${new Date(c.createdAt).toLocaleString()}`)),
  );
}

$("count").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  hangar
    .collection("counts")
    .add({ item: String(data.get("item")).trim(), qty: Number(data.get("qty")) })
    .then(() => {
      form.reset();
      showError(null);
      return loadCounts();
    }, showError);
});

if (hangar) {
  $("who").textContent = `Signed in as ${hangar.user.name}`;
  loadLowStock();
  loadCounts().catch(showError);
} else {
  $("who").textContent = "Open this tool in Hangar to see live stock.";
}
