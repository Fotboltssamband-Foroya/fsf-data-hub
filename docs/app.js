let RAW = [];
let VIEW = [];

async function loadData() {
  const res = await fetch("data/matches.json", { cache: "no-store" });
  RAW = await res.json();
  VIEW = RAW;
  buildFilters();
  render();
}

/* ---------------- FILTER UI ---------------- */

function unique(field) {
  return [...new Set(RAW.map(r => r[field]).filter(Boolean))].sort();
}

function buildFilters() {
  const controls = document.querySelector(".controls");

  controls.innerHTML = `
    <input id="team" placeholder="Team name">
    <input id="stadium" placeholder="Stadium">
    From <input type="date" id="from">
    To <input type="date" id="to">
    <button onclick="apply()">Apply</button>
    <button onclick="resetView()">Reset</button>
  `;
}

/* ---------------- FILTER LOGIC ---------------- */

function apply() {
  const team = document.getElementById("team").value.toLowerCase();
  const stadium = document.getElementById("stadium").value.toLowerCase();
  const from = document.getElementById("from").value;
  const to = document.getElementById("to").value;

  VIEW = RAW.filter(m => {

    if (team) {
      const txt = (m.matchDescription || "").toLowerCase();
      if (!txt.includes(team)) return false;
    }

    if (stadium) {
      const txt = (m.facility || "").toLowerCase();
      if (!txt.includes(stadium)) return false;
    }

    if (from || to) {
      const date = new Date(m.matchDate);
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
  return new Date(ms).toLocaleString();
}

loadData();
