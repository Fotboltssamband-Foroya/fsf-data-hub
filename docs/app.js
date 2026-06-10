let RAW = [];
let DISPLAY = [];
let VIEW = [];

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

const SORT_FIELDS = [
  { key: "", label: "(none)" },
  { key: "competitionName", label: "Competition" },
  { key: "roundsText", label: "Round" },
  { key: "matchText", label: "Match / Teams" },
  { key: "facility", label: "Stadium" },
  { key: "pitchText", label: "Pitch" },
  { key: "matchDate", label: "Date" },
  { key: "weekday", label: "Weekday" },
  { key: "statusText", label: "Status" },
  { key: "source", label: "Source" }
];

async function loadData() {
  try {
    const [natRes, intRes] = await Promise.all([
      fetch("data/matches_national.json", { cache: "no-store" }),
      fetch("data/matches_international.json", { cache: "no-store" })
    ]);

    const national = await natRes.json();
    const international = await intRes.json();

    RAW = [...national, ...international];

    buildControls();
    rebuildDisplayData();
    fillDynamicLists();
    setDefaultFromToday();
    applyFilters();
  } catch (err) {
    console.error(err);
    document.getElementById("note").textContent = "Error loading data.";
  }
}

/* ---------------- helpers ---------------- */

function cometMatchUrl(matchId) {
  if (!matchId) return "";
  return `https://comet.fsf.fo/resources/jsf/match/index.xhtml?id=${matchId}`;
}

function generatorUrl(row) {
  const teams = (row.teamsList || []).join("|");

  return `generator.html?competition=${encodeURIComponent(row.competitionName || "")}` +
    `&venue=${encodeURIComponent(row.facility || "")}` +
    `&teams=${encodeURIComponent(teams)}`;
}

function cometCompetitionUrl(competitionId) {
  if (!competitionId) return "";
  return `https://comet.fsf.fo/resources/jsf/competition/index.xhtml?id=${competitionId}`;
}

function uniq(arr) {
  return [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(v => String(v).trim())
    .sort((a, b) => a.localeCompare(b));
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
    day: "2-digit"
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
  if (from) from.value = todayKey();
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

function compareValues(a, b, direction) {
  const dir = direction === "desc" ? -1 : 1;

  if (a === b) return 0;
  if (a === null || a === undefined) return 1 * dir;
  if (b === null || b === undefined) return -1 * dir;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * dir;
  }

  return String(a).localeCompare(String(b)) * dir;
}

function extractTeams(matchDescription) {
  if (!matchDescription) return [];
  let left = String(matchDescription);

  if (left.includes(" -:-")) {
    left = left.split(" -:-")[0];
  } else if (left.match(/\s\d+:\d+$/)) {
    left = left.replace(/\s\d+:\d+$/, "");
  }

  return left.split(" - ").map(x => x.trim()).filter(Boolean);
}

function matchesAnySelectedTeam(row) {
  if (selected.teams.size === 0) return true;

  const hayTeams = row.teamsList && row.teamsList.length
    ? row.teamsList
    : extractTeams(row.matchText);

  for (const wanted of selected.teams) {
    const w = norm(wanted);

    for (const team of hayTeams) {
      const t = norm(team);

      if (t === w || t.startsWith(w + " ")) {
        return true;
      }
    }
  }

  return false;
}

function textMatch(row, q) {
  if (!q) return true;

  const hay = [
    row.competitionName,
    row.matchText,
    row.facility,
    row.pitchText,
    row.weekday,
    row.roundsText,
    row.statusText,
    row.source
  ].map(norm).join(" ");

  return hay.includes(q);
}

function shouldGroupCompetition(name) {
  const n = norm(name);

  if (
    n.includes("steypakapping u13 gentur 2026") ||
    n.includes("steypakapping u13 dreingir 2026")
  ) {
    return false;
  }

  return (
    n.includes("gentur u16 ½ vøll 2026") ||
    n.includes("old boys +35") ||
    n.includes("old boys +45") ||
    n.includes("old girls 2026") ||
    n.includes("u15 dreingir ½ vøll") ||
    n.includes("u6/u7") ||
    n.includes("u13") ||
    n.includes("u11") ||
    n.includes("u9") ||
    n.includes("u8") ||
    n.includes("u7") ||
    n.includes("u6")
  );
}

/* ---------------- build display rows ---------------- */

function rebuildDisplayData() {
  const groupedMap = new Map();
  const singles = [];

  for (const row of RAW) {
    const competitionName = String(row.name ?? row.competitionType ?? "").trim();
    const dk = dateKey(row.matchDate);
    const facility = String(row.facility ?? "").trim();
    const weekday = formatWeekday(row.matchDate);
    const teams = extractTeams(row.matchDescription);
    const status = String(row.matchStatus ?? "").trim();
    const round = row.round !== undefined && row.round !== null ? String(row.round).trim() : "";
    const pitch = String(row.field ?? "").trim();
    const source = String(row.source ?? "").trim();
    const matchId = row.matchId;
    const competitionId = row.id ?? row.competitionId ?? "";

    if (shouldGroupCompetition(competitionName)) {
      const compId = competitionId || competitionName;
      const timeKey = String(row.matchDate ?? "");
      const groupKey = `${compId}||${dk}||${timeKey}||${facility}||${source}`;

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, {
          competitionId: compId,
          competitionName,
          facility,
          matchDate: row.matchDate,
          dateKey: dk,
          weekday,
          rounds: new Set(),
          teams: new Set(),
          pitches: new Set(),
          statuses: new Set(),
          matchIds: new Set(),
          source
        });
      }

      const g = groupedMap.get(groupKey);

      if (round) g.rounds.add(round);
      teams.forEach(t => g.teams.add(t));
      if (pitch) g.pitches.add(pitch);
      if (status) g.statuses.add(status);
      if (matchId) g.matchIds.add(matchId);

    } else {
      singles.push({
        competitionId,
        competitionName,
        facility,
        pitchText: pitch,
        matchDate: row.matchDate,
        dateKey: dk,
        weekday,
        roundsText: round,
        teamsList: teams,
        matchText: String(row.matchDescription ?? "").trim(),
        statusText: status,
        source,
        matchId,
        cometUrl: cometMatchUrl(matchId),
        cometLabel: "Match"
      });
    }
  }

  const groupedRows = [...groupedMap.values()].map(g => {
    const teamsList = sortMixed([...g.teams]);
    const roundsList = sortMixed([...g.rounds]);
    const pitchesList = sortMixed([...g.pitches]);
    const statusesList = sortMixed([...g.statuses]);
    const matchIds = [...g.matchIds];

    return {
      competitionId: g.competitionId,
      competitionName: g.competitionName,
      facility: g.facility,
      pitchText: joinHuman(pitchesList),
      matchDate: g.matchDate,
      dateKey: g.dateKey,
      weekday: g.weekday,
      teamsList,
      roundsText: joinHuman(roundsList),
      matchText: joinHuman(teamsList),
      statusText: joinHuman(statusesList),
      source: g.source,
      matchIds,
      cometUrl: cometCompetitionUrl(g.competitionId),
      cometLabel: "Competition"
    };
  });

  DISPLAY = [...singles, ...groupedRows];
}

/* ---------------- controls ---------------- */

function buildControls() {
  const el = document.querySelector(".controls");
  const sortOptions = SORT_FIELDS.map(f => `<option value="${f.key}">${f.label}</option>`).join("");

  el.innerHTML = `
    <input id="q" type="text" placeholder="Search (free text)">

    <label style="display:flex;align-items:center;gap:8px;">
      <input id="tzToggle" type="checkbox" checked>
      Use Faroe time
    </label>

    <select id="source">
      <option value="">All</option>
      <option value="National">National</option>
      <option value="International">International</option>
    </select>

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

    <div class="picker" id="pickerSort">
      <button type="button" onclick="togglePanel('panelSort')">Sort</button>
      <div class="panel" id="panelSort">
        <div class="row"><strong>Sort 1</strong></div>
        <div class="row">
          <select id="sort1Field">${sortOptions}</select>
          <select id="sort1Dir">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div class="row"><strong>Sort 2</strong></div>
        <div class="row">
          <select id="sort2Field">${sortOptions}</select>
          <select id="sort2Dir">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div class="row"><strong>Sort 3</strong></div>
        <div class="row">
          <select id="sort3Field">${sortOptions}</select>
          <select id="sort3Dir">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <div class="actions">
          <button type="button" onclick="applyFilters()">Apply sorting</button>
        </div>
      </div>
    </div>

    <button type="button" onclick="applyFilters()">Apply</button>
    <button type="button" onclick="resetFilters()">Reset</button>
    <button type="button" onclick="downloadExcel()">Export Excel</button>
  `;

  document.getElementById("sort1Field").value = "matchDate";
  document.getElementById("sort1Dir").value = "asc";
  document.getElementById("sort2Field").value = "facility";
  document.getElementById("sort2Dir").value = "asc";
  document.getElementById("sort3Field").value = "competitionName";
  document.getElementById("sort3Dir").value = "asc";

  const qInput = document.getElementById("q");

  if (qInput) {
    qInput.addEventListener("input", () => applyFilters());

    qInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters();
    });
  }

  ["from", "to", "source"].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener("change", () => applyFilters());

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters();
    });
  });

  document.getElementById("tzToggle").addEventListener("change", (e) => {
    USE_FAROE_TZ = e.target.checked;
    rebuildDisplayData();
    fillDynamicLists();
    setDefaultFromToday();
    applyFilters();
  });

  document.addEventListener("click", (e) => {
    const ids = ["pickerTeams","pickerComps","pickerStadiums","pickerSort"];
    const clickedInside = ids.some(id => {
      const elem = document.getElementById(id);
      return elem && elem.contains(e.target);
    });

    if (!clickedInside) {
      ["panelTeams","panelComps","panelStadiums","panelSort"].forEach(id => {
        const p = document.getElementById(id);
        if (p) p.classList.remove("open");
      });
    }
  });

  buildPanel({
    panelId: "panelTeams",
    items: TEAM_NAMES,
    set: selected.teams,
    onChange: updatePickerButtons
  });
}

function togglePanel(panelId) {
  const p = document.getElementById(panelId);
  if (p) p.classList.toggle("open");
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
        const real = decodeHtml(cb.getAttribute("data-item"));

        if (cb.checked) set.add(real);
        else set.delete(real);

        onChange();
        applyFilters();
      });
    });
  }

  filterInput.addEventListener("input", renderList);

  btnAll.addEventListener("click", () => {
    safeItems.forEach(x => set.add(x));
    onChange();
    renderList();
    applyFilters();
  });

  btnNone.addEventListener("click", () => {
    set.clear();
    onChange();
    renderList();
    applyFilters();
  });

  renderList();
}

function fillDynamicLists() {
  const nationalRows = DISPLAY.filter(r => r.source === "National");

  buildPanel({
    panelId: "panelComps",
    items: uniq(nationalRows.map(r => r.competitionName)),
    set: selected.comps,
    onChange: updatePickerButtons
  });

  buildPanel({
    panelId: "panelStadiums",
    items: uniq(nationalRows.map(r => r.facility)),
    set: selected.stadiums,
    onChange: updatePickerButtons
  });

  updatePickerButtons();
}

/* ---------------- sorting ---------------- */

function applySort(data) {
  const sortConfig = [
    {
      field: document.getElementById("sort1Field")?.value || "",
      dir: document.getElementById("sort1Dir")?.value || "asc"
    },
    {
      field: document.getElementById("sort2Field")?.value || "",
      dir: document.getElementById("sort2Dir")?.value || "asc"
    },
    {
      field: document.getElementById("sort3Field")?.value || "",
      dir: document.getElementById("sort3Dir")?.value || "asc"
    }
  ].filter(x => x.field);

  data.sort((a, b) => {
    for (const s of sortConfig) {
      const result = compareValues(a[s.field], b[s.field], s.dir);
      if (result !== 0) return result;
    }

    return 0;
  });

  return data;
}

/* ---------------- filtering ---------------- */

function applyFilters() {
  const q = norm(document.getElementById("q").value.trim());
  const source = document.getElementById("source").value;
  const fromStr = document.getElementById("from").value;
  const toStr = document.getElementById("to").value;

  VIEW = DISPLAY.filter(r => {
    if (source && r.source !== source) return false;
    if (selected.comps.size > 0 && !selected.comps.has(r.competitionName)) return false;
    if (selected.stadiums.size > 0 && !selected.stadiums.has(r.facility)) return false;
    if (!matchesAnySelectedTeam(r)) return false;

    if (fromStr || toStr) {
      if (!r.dateKey) return false;
      if (fromStr && r.dateKey < fromStr) return false;
      if (toStr && r.dateKey > toStr) return false;
    }

    if (!textMatch(r, q)) return false;

    return true;
  });

  VIEW = applySort(VIEW);
  render();
}

function resetFilters() {
  selected.teams.clear();
  selected.comps.clear();
  selected.stadiums.clear();

  const q = document.getElementById("q");
  const to = document.getElementById("to");
  const source = document.getElementById("source");

  if (q) q.value = "";
  if (to) to.value = "";
  if (source) source.value = "";

  buildControls();
  rebuildDisplayData();
  fillDynamicLists();
  setDefaultFromToday();
  applyFilters();
}

/* ---------------- table ---------------- */

function render() {
  const cols = [
    { key: "competitionName", label: "Competition", className: "col-comp" },
    { key: "roundsText", label: "Round", className: "col-round" },
    { key: "matchText", label: "Match / Teams", className: "col-match" },
    { key: "facility", label: "Stadium", className: "col-stadium" },
    { key: "pitchText", label: "Pitch", className: "col-pitch" },
    { key: "matchDate", label: "Date", className: "col-date" },
    { key: "weekday", label: "Weekday", className: "col-weekday" },
    { key: "statusText", label: "Status", className: "col-status" },
    { key: "source", label: "Source", className: "col-source" },
    { key: "comet", label: "COMET", className: "col-comet" }
  ];

<td class="col-comet">
  ${r.teamsList && r.teamsList.length > 2
    ? `<a href="${escapeHtml(generatorUrl(r))}" target="_blank" rel="noopener">Generator</a>`
    : ""
  }
</td>
  
  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  thead.innerHTML = `<tr>${cols.map(c => `<th class="${c.className}">${c.label}</th>`).join("")}</tr>`;

  tbody.innerHTML = VIEW.map(r => `
    <tr>
      <td class="col-comp">${escapeHtml(r.competitionName || "")}</td>
      <td class="col-round">${escapeHtml(r.roundsText || "")}</td>
      <td class="col-match">${escapeHtml(r.matchText || "")}</td>
      <td class="col-stadium">${escapeHtml(r.facility || "")}</td>
      <td class="col-pitch">${escapeHtml(r.pitchText || "")}</td>
      <td class="col-date">${escapeHtml(formatDate(r.matchDate))}</td>
      <td class="col-weekday">${escapeHtml(r.weekday || "")}</td>
      <td class="col-status">${escapeHtml(r.statusText || "")}</td>
      <td class="col-source">${escapeHtml(r.source || "")}</td>
      <td class="col-comet">
        ${r.cometUrl
          ? `<a href="${escapeHtml(r.cometUrl)}" target="_blank" rel="noopener">${escapeHtml(r.cometLabel || "Open")}</a>`
          : ""
        }
      </td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${VIEW.length} rows shown (${RAW.length} total raw matches loaded)`;
}

/* ---------------- Excel export ---------------- */

function downloadExcel() {
  const data = VIEW.map(r => ({
    Competition: r.competitionName,
    Round: r.roundsText,
    "Match / Teams": r.matchText,
    Stadium: r.facility,
    Pitch: r.pitchText,
    Date: formatDate(r.matchDate),
    Weekday: r.weekday,
    Status: r.statusText,
    Source: r.source,
    COMET: r.cometUrl || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Matches");
  XLSX.writeFile(workbook, "fsf_matches.xlsx");
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
