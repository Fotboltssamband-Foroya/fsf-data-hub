let RAW = [];
let VIEW = [];
let SORT_DIR = 1;

// Your provided team list (used for multi-select)
const TEAM_NAMES = [
  "07 Vestur","AB","B36","B68","B71","EB/Streymur","FC Hoyvík","FC Suðuroy",
  "HB","ÍF","KÍ","MB","NSÍ","Royn","Skála ÍF","TB","Víkingur"
];

// Selected filters (multi-select as Sets)
const selected = {
  teams: new Set(),
  comps: new Set(),
  stadiums: new Set(),
};

async function loadData() {
  const res = await fetch("data/matches.json", { cache: "no-store" });
  RAW = await res.json();
  VIEW = RAW;

  buildControls();
  fillDynamicLists();
  render();
}

/* ---------------- helpers ---------------- */

function uniq(arr) {
  return [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(v => String(v).trim())
    .sort((a,b) => a.localeCompare(b));
}

function norm(s) { return String(s ?? "").toLowerCase(); }

/**
 * Display date using your local timezone (Faroe on your Mac).
 * This keeps display and filtering consistent in Safari.
 */
function formatDate(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/**
 * Convert timestamp -> YYYY-MM-DD in LOCAL timezone (your Mac, Faroe).
 * This fixes the “00:00 shows as previous day when filtering” bug.
 */
function localDateKey(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // YYYY-MM-DD
}

function textMatch(match, q) {
  if (!q) return true;
  const hay = [
    match.matchDescription,
    match.competitionType,
    match.facility,
    match.facilityPlaceName,
    match.field,
    match.country
  ].map(x => norm(x)).join(" ");
  return hay.includes(q);
}

function matchHasAnyTeam(match) {
  const desc = norm(match.matchDescription);
  for (const t of selected.teams) {
    if (desc.includes(norm(t))) return true;
  }
  return false;
}

/* ---------------- UI: multi-select panels ---------------- */

function buildControls() {
  const el = document.querySelector(".controls");
  el.innerHTML = `
    <input id="q" type="text" placeholder="Search (free text)">

    <div class="picker" id="pickerTeams">
      <button type="button" onclick="togglePanel('panelTeams')">Teams (${selected.teams.size})</button>
      <div class="panel" id="panelTeams"></div>
    </div>

    <div class="picker" id="pickerComps">
      <button type="button" onclick="togglePanel('panelComps')">Competitions (${selected.comps.size})</button>
      <div class="panel" id="panelComps"></div>
    </div>

    <div class="picker" id="pickerStadiums">
      <button type="button" onclick="togglePanel('panelStadiums')">Stadiums (${selected.stadiums.size})</button>
      <div class="panel" id="panelStadiums"></div>
    </div>

    From <input id="from" type="date">
    To <input id="to" type="date">

    <button type="button" onclick="applyFilters()">Apply</button>
    <button type="button" onclick="resetFilters()">Reset</button>
    <button type="button" onclick="downloadCSV()">Export CSV</button>
  `;

  // Close panels when clicking outside
  document.addEventListener("click", (e) => {
    const panels = ["panelTeams","panelComps","panelStadiums"].map(id => document.getElementById(id));
    const pickers = ["pickerTeams","pickerComps","pickerStadiums"].map(id => document.getElementById(id));
    const clickedInside = pickers.some(p => p && p.contains(e.target));
    if (!clickedInside) panels.forEach(p => p && p.classList.remove("open"));
  });

  buildPanel({
    panelId: "panelTeams",
    items: TEAM_NAMES,
    set: selected.teams,
    onChange: () => updatePickerButtons()
  });
}

function togglePanel(panelId) {
  const p = document.getElementById(panelId);
  if (!p) return;
  p.classList.toggle("open");
}

function updatePickerButtons() {
  const btnTeams = document.querySelector("#pickerTeams button");
  const btnComps = document.querySelector("#pickerComps button");
  const btnStad = document.querySelector("#pickerStadiums button");
  if (btnTeams) btnTeams.textContent = `Teams (${selected.teams.size})`;
  if (btnComps) btnComps.textContent = `Competitions (${selected.comps.size})`;
  if (btnStad) btnStad.textContent = `Stadiums (${selected.stadiums.size})`;
}

function buildPanel({ panelId, items, set, onChange }) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const safeItems = items.slice();
  panel.innerHTML = `
    <div class="row">
      <input type="text" placeholder="Filter list…" data-filter="1">
    </div>
    <div class="actions">
      <button type="button" data-all="1">Select all</button>
      <button type="button" data-none="1">Select none</button>
    </div>
    <div data-list="1"></div>
  `;

  const filterInput = panel.querySelector('input[data-filter="1"]');
  const listDiv = panel.querySelector('div[data-list="1"]');
  const btnAll = panel.querySelector('button[data-all="1"]');
  const btnNone = panel.querySelector('button[data-none="1"]');

  function renderList() {
    const q = norm(filterInput.value);
    const show = safeItems.filter(x => norm(x).includes(q));

    listDiv.innerHTML = show.map(x => {
      const checked = set.has(x) ? "checked" : "";
      return `<label><input type="checkbox" data-item="${escapeHtml(x)}" ${checked}> ${escapeHtml(x)}</label>`;
    }).join("");

    listDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        const item = cb.getAttribute("data-item");
        const real = decodeHtml(item);
        if (cb.checked) set.add(real);
        else set.delete(real);
        onChange();
      });
    });
  }

  filterInput.addEventListener("input", renderList);

  btnAll.addEventListener("click", () => {
    safeItems.forEach(x => set.add(x));
    onChange();
    renderList();
  });

  btnNone.addEventListener("click", () => {
    set.clear();
    onChange();
    renderList();
  });

  renderList();
}

function fillDynamicLists() {
  const comps = uniq(RAW.map(r => r.competitionType));
  buildPanel({
    panelId: "panelComps",
    items: comps,
    set: selected.comps,
    onChange: () => updatePickerButtons()
  });

  const stadiums = uniq(RAW.map(r => r.facility));
  buildPanel({
    panelId: "panelStadiums",
    items: stadiums,
    set: selected.stadiums,
    onChange: () => updatePickerButtons()
  });

  updatePickerButtons();
}

/* ---------------- filtering ---------------- */

function applyFilters() {
  const q = norm(document.getElementById("q").value.trim());
  const fromStr = document.getElementById("from").value; // YYYY-MM-DD
  const toStr = document.getElementById("to").value;     // YYYY-MM-DD

  VIEW = RAW.filter(m => {
    if (selected.comps.size > 0) {
      const c = String(m.competitionType ?? "").trim();
      if (!selected.comps.has(c)) return false;
    }

    if (selected.stadiums.size > 0) {
      const s = String(m.facility ?? "").trim();
      if (!selected.stadiums.has(s)) return false;
    }

    if (selected.teams.size > 0) {
      if (!matchHasAnyTeam(m)) return false;
    }

    // ✅ Date range using LOCAL date key (fixes 00:00 issue)
    if (fromStr || toStr) {
      const key = localDateKey(m.matchDate);
      if (!key) return false;
      if (fromStr && key < fromStr) return false;
      if (toStr && key > toStr) return false;
    }

    if (!textMatch(m, q)) return false;

    return true;
  });

  render();
}

function resetFilters() {
  selected.teams.clear();
  selected.comps.clear();
  selected.stadiums.clear();

  const q = document.getElementById("q");
  const from = document.getElementById("from");
  const to = document.getElementById("to");
  if (q) q.value = "";
  if (from) from.value = "";
  if (to) to.value = "";

  buildControls();
  fillDynamicLists();

  VIEW = RAW;
  render();
}

/* ---------------- table + sorting ---------------- */

function render() {
  const cols = [
    { key: "competitionType", label: "Competition" },
    { key: "matchDescription", label: "Match" },
    { key: "facility", label: "Stadium" },
    { key: "matchDate", label: "Date" },
    { key: "round", label: "Round" },
    { key: "matchStatus", label: "Status" }
  ];

  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  thead.innerHTML = `
    <tr>
      ${cols.map(c => `<th onclick="sortBy('${c.key}')">${c.label}</th>`).join("")}
    </tr>
  `;

  tbody.innerHTML = VIEW.map(r => `
    <tr>
      <td>${escapeHtml(r.competitionType || "")}</td>
      <td>${escapeHtml(r.matchDescription || "")}</td>
      <td>${escapeHtml(r.facility || "")}</td>
      <td>${escapeHtml(formatDate(r.matchDate))}</td>
      <td>${escapeHtml(r.round ?? "")}</td>
      <td>${escapeHtml(r.matchStatus ?? "")}</td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${VIEW.length} matches shown (of ${RAW.length})`;
}

function sortBy(field) {
  SORT_DIR *= -1;

  VIEW.sort((a, b) => {
    let av = a[field];
    let bv = b[field];

    if (field === "matchDate") {
      av = Number(av || 0);
      bv = Number(bv || 0);
    }

    if (av > bv) return SORT_DIR;
    if (av < bv) return -SORT_DIR;
    return 0;
  });

  render();
}

/* ---------------- CSV EXPORT ---------------- */

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV() {
  const columns = [
    ["competitionType", "Competition"],
    ["matchDescription", "Match"],
    ["facility", "Stadium"],
    ["matchDate", "Match date"],
    ["round", "Round"],
    ["matchStatus", "Status"]
  ];

  const header = columns.map(c => csvEscape(c[1])).join(",");
  const lines = VIEW.map(r => {
    return columns.map(([key]) => {
      if (key === "matchDate") return csvEscape(formatDate(r.matchDate));
      return csvEscape(r[key]);
    }).join(",");
  });

  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fsf_matches_filtered.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- tiny html helpers ---------------- */

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function decodeHtml(s) {
  const txt = document.createElement("textarea");
  txt.innerHTML = s;
  return txt.value;
}

loadData();
