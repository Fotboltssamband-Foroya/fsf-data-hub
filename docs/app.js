let RAW = [];
let GROUPED = [];
let VIEW = [];
let SORT_DIR = 1;

const TEAM_NAMES = [
  "07 Vestur","AB","B36","B68","B71","EB/Streymur","FC Hoyvík","FC Suðuroy",
  "HB","ÍF","KÍ","MB","NSÍ","Royn","Skála ÍF","TB","Víkingur"
];

const selected = {
  teams: new Set(),
  comps: new Set(),
  stadiums: new Set(),
};

let USE_FAROE_TZ = true;

async function loadData() {
  const res = await fetch("data/matches.json", { cache: "no-store" });
  RAW = await res.json();

  buildControls();
  rebuildGroupedData();
  fillDynamicLists();
  setDefaultFromToday();
  applyFilters();
}

/* ---------------- helpers ---------------- */

function uniq(arr) {
  return [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(v => String(v).trim())
    .sort((a,b) => a.localeCompare(b));
}

function norm(s) {
  return String(s ?? "").toLowerCase();
}

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

function formatWeekday(ms) {
  if (!ms) return "";
  const opts = USE_FAROE_TZ
    ? { weekday: "long", timeZone: "Atlantic/Faroe" }
    : { weekday: "long" };

  const day = new Intl.DateTimeFormat("fo-FO", opts).format(new Date(Number(ms)));
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function faroeDateKey(ms) {
  if (!ms) return "";
  const dt = new Date(Number(ms));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Atlantic/Faroe",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(dt);

  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = parts.find(p => p.type === "month")?.value ?? "";
  const d = parts.find(p => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function localDateKey(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateKey(ms) {
  return USE_FAROE_TZ ? faroeDateKey(ms) : localDateKey(ms);
}

function todayKey() {
  return dateKey(Date.now());
}

function setDefaultFromToday() {
  const from = document.getElementById("from");
  if (!from) return;
  from.value = todayKey();
}

function joinHuman(arr) {
  const clean = arr.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} og ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} og ${clean[clean.length - 1]}`;
}

function sortMixed(arr) {
  return [...arr].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    const aNum = !isNaN(an);
    const bNum = !isNaN(bn);

    if (aNum && bNum) return an - bn;
    return String(a).localeCompare(String(b));
  });
}

function extractTeams(matchDescription) {
  if (!matchDescription) return [];
  let left = String(matchDescription);

  if (left.includes(" -:-")) {
    left = left.split(" -:-")[0];
  } else if (left.match(/\s\d+:\d+$/)) {
    left = left.replace(/\s\d+:\d+$/, "");
  }

  const parts = left.split(" - ").map(x => x.trim()).filter(Boolean);
  return parts;
}

function matchesAnySelectedTeam(group) {
  if (selected.teams.size === 0) return true;

  for (const selectedTeam of selected.teams) {
    const sel = norm(selectedTeam);
    for (const team of group.teamsList) {
      if (norm(team).includes(sel)) return true;
    }
  }
  return false;
}

function textMatch(group, q) {
  if (!q) return true;
  const hay = [
    group.competitionName,
    group.matchText,
    group.facility,
    group.weekday,
    group.roundsText,
    group.statusText
  ].map(norm).join(" ");
  return hay.includes(q);
}

/* ---------------- grouping ---------------- */

function rebuildGroupedData() {
  const map = new Map();

  for (const row of RAW) {
    const compId = row.id ?? row.competitionId ?? row.name ?? "";
    const dk = dateKey(row.matchDate);
    const stadium = String(row.facility ?? "").trim();

    const groupKey = `${compId}||${dk}||${stadium}`;

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        competitionId: compId,
        competitionName: String(row.name ?? row.competitionType ?? "").trim(), // full comp name first
        facility: stadium,
        matchDate: row.matchDate,
        dateKey: dk,
        weekday: formatWeekday(row.matchDate),
        rounds: new Set(),
        teams: new Set(),
        statuses: new Set(),
        rawCount: 0
      });
    }

    const g = map.get(groupKey);

    g.rawCount += 1;

    if (row.round !== undefined && row.round !== null && String(row.round).trim() !== "") {
      g.rounds.add(String(row.round).trim());
    }

    const teams = extractTeams(row.matchDescription);
    teams.forEach(t => g.teams.add(t));

    if (row.matchStatus) {
      g.statuses.add(String(row.matchStatus).trim());
    }
  }

  GROUPED = [...map.values()].map(g => {
    const teamsList = sortMixed([...g.teams]);
    const roundsList = sortMixed([...g.rounds]);
    const statusesList = sortMixed([...g.statuses]);

    return {
      competitionId: g.competitionId,
      competitionName: g.competitionName,
      facility: g.facility,
      matchDate: g.matchDate,
      dateKey: g.dateKey,
      weekday: g.weekday,
      teamsList,
      roundsList,
      statusList: statusesList,
      teamsText: joinHuman(teamsList),
      roundsText: joinHuman(roundsList),
      statusText: joinHuman(statusesList),
      matchText: `${joinHuman(teamsList)}`
    };
  });
}

/* ---------------- controls ---------------- */

function buildControls() {
  const el = document.querySelector(".controls");
  el.innerHTML = `
    <input id="q" type="text" placeholder="Search (free text)">

    <label style="display:flex;align-items:center;gap:8px;">
      <input id="tzToggle" type="checkbox" checked>
      Use Faroe time
    </label>

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

  const tz = document.getElementById("tzToggle");
  tz.addEventListener("change", () => {
    USE_FAROE_TZ = tz.checked;
    rebuildGroupedData();
    fillDynamicLists();
    setDefaultFromToday();
    applyFilters();
  });

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
  buildPanel({
    panelId: "panelComps",
    items: uniq(GROUPED.map(r => r.competitionName)),
    set: selected.comps,
    onChange: () => updatePickerButtons()
  });

  buildPanel({
    panelId: "panelStadiums",
    items: uniq(GROUPED.map(r => r.facility)),
    set: selected.stadiums,
    onChange: () => updatePickerButtons()
  });

  updatePickerButtons();
}

/* ---------------- filtering ---------------- */

function applyFilters() {
  const q = norm(document.getElementById("q").value.trim());
  const fromStr = document.getElementById("from").value;
  const toStr = document.getElementById("to").value;

  VIEW = GROUPED.filter(g => {
    if (selected.comps.size > 0 && !selected.comps.has(g.competitionName)) {
      return false;
    }

    if (selected.stadiums.size > 0 && !selected.stadiums.has(g.facility)) {
      return false;
    }

    if (!matchesAnySelectedTeam(g)) {
      return false;
    }

    if (fromStr || toStr) {
      if (!g.dateKey) return false;
      if (fromStr && g.dateKey < fromStr) return false;
      if (toStr && g.dateKey > toStr) return false;
    }

    if (!textMatch(g, q)) return false;

    return true;
  });

  render();
}

function resetFilters() {
  selected.teams.clear();
  selected.comps.clear();
  selected.stadiums.clear();

  const q = document.getElementById("q");
  const to = document.getElementById("to");
  if (q) q.value = "";
  if (to) to.value = "";

  buildControls();
  fillDynamicLists();
  setDefaultFromToday();
  applyFilters();
}

/* ---------------- table ---------------- */

function render() {
  const cols = [
    { key: "competitionName", label: "Competition" },
    { key: "weekday", label: "Weekday" },
    { key: "matchText", label: "Teams" },
    { key: "facility", label: "Stadium" },
    { key: "matchDate", label: "Date" },
    { key: "roundsText", label: "Rounds" },
    { key: "statusText", label: "Status" }
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
      <td>${escapeHtml(r.competitionName || "")}</td>
      <td>${escapeHtml(r.weekday || "")}</td>
      <td>${escapeHtml(r.matchText || "")}</td>
      <td>${escapeHtml(r.facility || "")}</td>
      <td>${escapeHtml(formatDate(r.matchDate))}</td>
      <td>${escapeHtml(r.roundsText || "")}</td>
      <td>${escapeHtml(r.statusText || "")}</td>
    </tr>
  `).join("");

  const tzLabel = USE_FAROE_TZ ? "Faroe time" : "Local time";
  document.getElementById("note").textContent =
    `${VIEW.length} grouped rows shown (from ${RAW.length} original matches) — date filter: ${tzLabel}`;
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

/* ---------------- CSV ---------------- */

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV() {
  const columns = [
    ["competitionName", "Competition"],
    ["weekday", "Weekday"],
    ["matchText", "Teams"],
    ["facility", "Stadium"],
    ["matchDate", "Date"],
    ["roundsText", "Rounds"],
    ["statusText", "Status"]
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
  a.download = "fsf_matches_grouped.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------------- html helpers ---------------- */

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
