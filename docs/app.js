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

/* ---------------- LOAD BOTH APIs ---------------- */

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

/* ---------------- HELPERS ---------------- */

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
}

function norm(s) {
  return String(s ?? "").toLowerCase();
}

function formatDate(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleString("en-GB");
}

function formatWeekday(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("fo-FO", {
    weekday: "long",
    timeZone: USE_FAROE_TZ ? "Atlantic/Faroe" : undefined
  }).format(new Date(Number(ms)));
}

function dateKey(ms) {
  const d = new Date(Number(ms));
  return d.toISOString().slice(0,10);
}

function todayKey() {
  return dateKey(Date.now());
}

function setDefaultFromToday() {
  const el = document.getElementById("from");
  if (el) el.value = todayKey();
}

function extractTeams(txt) {
  if (!txt) return [];
  return txt.split(" - ").map(x => x.trim()).filter(Boolean);
}

function joinHuman(arr) {
  if (arr.length <= 1) return arr[0] || "";
  return arr.slice(0,-1).join(", ") + " og " + arr[arr.length-1];
}

/* ---------------- GROUPING ---------------- */

function shouldGroupCompetition(name) {
  const n = norm(name);

  if (
    n.includes("steypakapping u13 gentur 2026") ||
    n.includes("steypakapping u13 dreingir 2026")
  ) return false;

  return (
    n.includes("u13") ||
    n.includes("u11") ||
    n.includes("u9") ||
    n.includes("u8") ||
    n.includes("u7") ||
    n.includes("u6")
  );
}

function rebuildDisplayData() {
  const grouped = new Map();
  const singles = [];

  for (const r of RAW) {
    const comp = r.name || r.competitionType || "";
    const dk = dateKey(r.matchDate);
    const key = `${comp}_${dk}_${r.facility}`;

    const pitch = r.field || "";

    if (shouldGroupCompetition(comp)) {

      if (!grouped.has(key)) {
        grouped.set(key, {
          competitionName: comp,
          facility: r.facility,
          matchDate: r.matchDate,
          dateKey: dk,
          rounds: new Set(),
          teams: new Set(),
          pitches: new Set(),
          statuses: new Set(),
          source: r.source
        });
      }

      const g = grouped.get(key);

      if (r.round) g.rounds.add(String(r.round));
      extractTeams(r.matchDescription).forEach(t => g.teams.add(t));
      if (pitch) g.pitches.add(pitch);
      if (r.matchStatus) g.statuses.add(r.matchStatus);

    } else {
      singles.push({
        competitionName: comp,
        facility: r.facility,
        pitchText: pitch,
        matchDate: r.matchDate,
        dateKey: dk,
        roundsText: String(r.round || ""),
        matchText: r.matchDescription,
        weekday: formatWeekday(r.matchDate),
        statusText: r.matchStatus,
        source: r.source
      });
    }
  }

  const groupedRows = [...grouped.values()].map(g => ({
    competitionName: g.competitionName,
    facility: g.facility,
    pitchText: joinHuman([...g.pitches]),
    matchDate: g.matchDate,
    dateKey: g.dateKey,
    roundsText: joinHuman([...g.rounds]),
    matchText: joinHuman([...g.teams]),
    weekday: formatWeekday(g.matchDate),
    statusText: joinHuman([...g.statuses]),
    source: g.source
  }));

  DISPLAY = [...singles, ...groupedRows];
}

/* ---------------- UI ---------------- */

function buildControls() {
  document.querySelector(".controls").innerHTML = `
    <input id="q" placeholder="Search">

    <select id="source">
      <option value="">All</option>
      <option value="National">National</option>
      <option value="International">International</option>
    </select>

    From <input id="from" type="date">
    To <input id="to" type="date">

    <button onclick="applyFilters()">Apply</button>
    <button onclick="resetFilters()">Reset</button>
  `;
}

function fillDynamicLists(){}

/* ---------------- FILTER ---------------- */

function applyFilters() {
  const q = norm(document.getElementById("q").value);
  const source = document.getElementById("source").value;
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;

  VIEW = DISPLAY.filter(r => {

    if (source && r.source !== source) return false;

    if (q && !(
      norm(r.competitionName).includes(q) ||
      norm(r.matchText).includes(q) ||
      norm(r.facility).includes(q)
    )) return false;

    if (from && r.dateKey < from) return false;
    if (to && r.dateKey > to) return false;

    return true;
  });

  render();
}

function resetFilters() {
  document.getElementById("q").value = "";
  document.getElementById("source").value = "";
  setDefaultFromToday();
  applyFilters();
}

/* ---------------- TABLE ---------------- */

function render() {
  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  thead.innerHTML = `
    <tr>
      <th class="col-comp">Competition</th>
      <th class="col-round">Round</th>
      <th class="col-match">Match / Teams</th>
      <th class="col-stadium">Stadium</th>
      <th class="col-pitch">Pitch</th>
      <th class="col-date">Date</th>
      <th class="col-weekday">Weekday</th>
      <th class="col-status">Status</th>
    </tr>
  `;

  tbody.innerHTML = VIEW.map(r => `
    <tr>
      <td class="col-comp">${r.competitionName}</td>
      <td class="col-round">${r.roundsText}</td>
      <td class="col-match">${r.matchText}</td>
      <td class="col-stadium">${r.facility}</td>
      <td class="col-pitch">${r.pitchText}</td>
      <td class="col-date">${formatDate(r.matchDate)}</td>
      <td class="col-weekday">${r.weekday}</td>
      <td class="col-status">${r.statusText}</td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${VIEW.length} matches shown`;
}

/* ---------------- INIT ---------------- */

loadData();
