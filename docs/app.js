let RAW = [];
let VIEW = [];

/* ---------------- LOAD DATA ---------------- */

async function loadData() {
  const res = await fetch("data/matches.json", { cache: "no-store" });
  RAW = await res.json();

  buildFilters();            // create filter UI
  fillCompetitionDropdown(); // populate competition dropdown

  VIEW = RAW;
  render();
}

/* ---------------- HELPERS ---------------- */

function uniq(arr) {
  return [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
    .map(v => String(v).trim())
    .sort((a,b) => a.localeCompare(b));
}

/* ---------------- FILTER UI ---------------- */

function buildFilters() {
  const controls = document.querySelector(".controls");

  controls.innerHTML = `
    <input id="team" placeholder="Team name">
    <input id="stadium" placeholder="Stadium">

    <select id="competition">
      <option value="">All competitions</option>
    </select>

    From <input type="date" id="from">
    To <input type="date" id="to">

    <button onclick="apply()">Apply</button>
    <button onclick="resetView()">Reset</button>
  `;
}

function fillCompetitionDropdown() {
  const sel = document.getElementById("competition");
  if (!sel) return;

  const comps = uniq(RAW.map(r => r.competitionType));
  sel.innerHTML =
    `<option value="">All competitions</option>` +
    comps.map(c => `<option value="${c.replace(/"/g,'&quot;')}">${c}</option>`).join("");
}

/* ---------------- FILTER LOGIC ---------------- */

function apply() {
  const team = document.getElementById("team").value.toLowerCase();
  const stadium = document.getElementById("stadium").value.toLowerCase();
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;
  const comp = document.getElementById("competition").value.trim();

  VIEW = RAW.filter(m => {

    if (comp) {
      if (String(m.competitionType || "").trim() !== comp) return false;
    }

    if (team) {
      const txt = (m.matchDescription || "").toLowerCase();
      if (!txt.includes(team)) return false;
    }

    if (stadium) {
      const txt = (m.facility || "").toLowerCase();
      if (!txt.includes(stadium)) return false;
    }

    if (from || to) {
      const date = new Date(Number(m.matchDate));
      if (from && date < new Date(from)) return false;
      if (to && date > new Date(to + "T23:59:59")) return false;
    }

    return true;
  });

  render();
}

function resetView() {
  VIEW = RAW;
  render();
}

/* ---------------- TABLE ---------------- */

function render() {

  const cols = [
    "competitionType",
    "matchDescription",
    "facility",
    "matchDate",
    "round"
  ];

  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  thead.innerHTML = `
    <tr>
      ${cols.map(c => `<th onclick="sortBy('${c}')">${c}</th>`).join("")}
    </tr>
  `;

  tbody.innerHTML = VIEW.map(r => `
    <tr>
      <td>${r.competitionType || ""}</td>
      <td>${r.matchDescription || ""}</td>
      <td>${r.facility || ""}</td>
      <td>${formatDate(r.matchDate)}</td>
      <td>${r.round || ""}</td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${VIEW.length} matches shown (of ${RAW.length})`;
}

/* ---------------- SORT ---------------- */

let SORT_DIR = 1;

function sortBy(field) {
  SORT_DIR *= -1;

  VIEW.sort((a,b)=>{
    if(a[field] > b[field]) return SORT_DIR;
    if(a[field] < b[field]) return -SORT_DIR;
    return 0;
  });

  render();
}

/* ---------------- UTIL ---------------- */

function formatDate(ms) {
  if(!ms) return "";
  return new Date(Number(ms)).toLocaleString("en-GB", {
    timeZone: "Atlantic/Faroe",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

loadData();function resetView() {
  VIEW = RAW;
  render();
}

/* ---------------- TABLE ---------------- */

function render() {

  const cols = [
    "competitionType",
    "matchDescription",
    "facility",
    "matchDate",
    "round"
  ];

  const thead = document.querySelector("#tbl thead");
  const tbody = document.querySelector("#tbl tbody");

  thead.innerHTML = `
    <tr>
      ${cols.map(c => `<th onclick="sortBy('${c}')">${c}</th>`).join("")}
    </tr>
  `;

  tbody.innerHTML = VIEW.map(r => `
    <tr>
      <td>${r.competitionType || ""}</td>
      <td>${r.matchDescription || ""}</td>
      <td>${r.facility || ""}</td>
      <td>${formatDate(r.matchDate)}</td>
      <td>${r.round || ""}</td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${VIEW.length} matches shown (of ${RAW.length})`;
}

/* ---------------- SORT ---------------- */

let SORT_DIR = 1;

function sortBy(field) {
  SORT_DIR *= -1;
  VIEW.sort((a,b)=>{
    if(a[field] > b[field]) return SORT_DIR;
    if(a[field] < b[field]) return -SORT_DIR;
    return 0;
  });
  render();
}

/* ---------------- UTIL ---------------- */

function formatDate(ms) {
  if(!ms) return "";
  return new Date(ms).toLocaleString();
}

loadData();
