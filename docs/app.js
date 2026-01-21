async function loadData() {
  const res = await fetch("data/licenses.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("licenses.json not found yet (run the workflow)");
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("licenses.json must be an array");
  }
  return data;
}

function buildTable(rows) {
  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  tbody.innerHTML = "";
  thead.innerHTML = "";

  if (rows.length === 0) {
    document.getElementById("note").textContent = "No rows to display.";
    return;
  }

  const columns = Object.keys(rows[0]);

  // Header
  const trh = document.createElement("tr");
  columns.forEach(c => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  // Rows
  rows.forEach(r => {
    const tr = document.createElement("tr");
    columns.forEach(c => {
      const td = document.createElement("td");
      td.textContent = r[c] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  document.getElementById("note").textContent =
    `${rows.length} rows shown.`;
}

let RAW = [];

function applySearch() {
  const q = document.getElementById("q").value.toLowerCase().trim();
  if (!q) {
    buildTable(RAW);
    return;
  }

  const filtered = RAW.filter(row =>
    Object.values(row).some(v =>
      String(v ?? "").toLowerCase().includes(q)
    )
  );

  buildTable(filtered);
}

async function init() {
  try {
    RAW = await loadData();
    buildTable(RAW);
    document.getElementById("apply").onclick = applySearch;
  } catch (e) {
    document.getElementById("note").textContent = e.message;
    console.error(e);
  }
}

init();