let RAW = [];
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
  VIEW = RAW;

  buildControls();
  fillDynamicLists();
  render();
}

/* ---------------- helpers ---------------- */

function uniq(arr) {
  return [...new Set(arr.filter(v => v && String(v).trim() !== ""))]
    .map(v => String(v).trim())
    .sort((a,b) => a.localeCompare(b));
}

function norm(s){ return String(s ?? "").toLowerCase(); }

function formatDate(ms){
  if(!ms) return "";
  return new Date(Number(ms)).toLocaleString("en-GB",{
    year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false
  });
}

function faroeDateKey(ms){
  if(!ms) return "";
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Atlantic/Faroe",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(Number(ms)));
  return `${parts.find(p=>p.type==="year").value}-${parts.find(p=>p.type==="month").value}-${parts.find(p=>p.type==="day").value}`;
}

function localDateKey(ms){
  if(!ms) return "";
  const d=new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function dateKey(ms){ return USE_FAROE_TZ?faroeDateKey(ms):localDateKey(ms); }

function textMatch(match,q){
  if(!q) return true;
  return [
    match.matchDescription,
    match.name,
    match.facility
  ].map(norm).join(" ").includes(q);
}

function matchHasAnyTeam(match){
  const desc=norm(match.matchDescription);
  for(const t of selected.teams) if(desc.includes(norm(t))) return true;
  return false;
}

/* ---------------- UI ---------------- */

function buildControls(){
  const el=document.querySelector(".controls");
  el.innerHTML=`
    <input id="q" placeholder="Search">

    <label><input id="tzToggle" type="checkbox" checked>Use Faroe time</label>

    <div class="picker"><button onclick="togglePanel('panelTeams')">Teams (${selected.teams.size})</button><div class="panel" id="panelTeams"></div></div>
    <div class="picker"><button onclick="togglePanel('panelComps')">Competitions (${selected.comps.size})</button><div class="panel" id="panelComps"></div></div>
    <div class="picker"><button onclick="togglePanel('panelStadiums')">Stadiums (${selected.stadiums.size})</button><div class="panel" id="panelStadiums"></div></div>

    From <input id="from" type="date"> To <input id="to" type="date">
    <button onclick="applyFilters()">Apply</button>
    <button onclick="resetFilters()">Reset</button>
    <button onclick="downloadCSV()">Export CSV</button>
  `;

  document.getElementById("tzToggle").addEventListener("change",e=>{
    USE_FAROE_TZ=e.target.checked;
    applyFilters();
  });

  buildPanel("panelTeams",TEAM_NAMES,selected.teams);
}

function buildPanel(id,items,set){
  const panel=document.getElementById(id);
  panel.innerHTML=items.map(x=>`<label><input type="checkbox" ${set.has(x)?"checked":""} onchange="this.checked?selected.${id.includes('Teams')?'teams':id.includes('Comps')?'comps':'stadiums'}.add('${x}'):selected.${id.includes('Teams')?'teams':id.includes('Comps')?'comps':'stadiums'}.delete('${x}')">${x}</label>`).join("<br>");
}

function togglePanel(id){document.getElementById(id).classList.toggle("open");}

function fillDynamicLists(){
  buildPanel("panelComps",uniq(RAW.map(r=>r.name)),selected.comps);
  buildPanel("panelStadiums",uniq(RAW.map(r=>r.facility)),selected.stadiums);
}

/* ---------------- filtering ---------------- */

function applyFilters(){
  const q=norm(document.getElementById("q").value);
  const from=document.getElementById("from").value;
  const to=document.getElementById("to").value;

  VIEW=RAW.filter(m=>{
    if(selected.comps.size && !selected.comps.has(m.name)) return false;
    if(selected.stadiums.size && !selected.stadiums.has(m.facility)) return false;
    if(selected.teams.size && !matchHasAnyTeam(m)) return false;
    if(from||to){
      const k=dateKey(m.matchDate);
      if(from&&k<from) return false;
      if(to&&k>to) return false;
    }
    if(!textMatch(m,q)) return false;
    return true;
  });

  render();
}

function resetFilters(){
  selected.teams.clear();selected.comps.clear();selected.stadiums.clear();
  document.getElementById("q").value="";
  document.getElementById("from").value="";
  document.getElementById("to").value="";
  fillDynamicLists();
  VIEW=RAW;
  render();
}

/* ---------------- table ---------------- */

function render(){
  const thead=document.querySelector("#tbl thead");
  const tbody=document.querySelector("#tbl tbody");

  thead.innerHTML=`<tr><th onclick="sortBy('name')">Competition</th><th>Match</th><th>Stadium</th><th onclick="sortBy('matchDate')">Date</th><th>Round</th><th>Status</th></tr>`;

  tbody.innerHTML=VIEW.map(r=>`
    <tr>
      <td>${r.name||""}</td>
      <td>${r.matchDescription||""}</td>
      <td>${r.facility||""}</td>
      <td>${formatDate(r.matchDate)}</td>
      <td>${r.round||""}</td>
      <td>${r.matchStatus||""}</td>
    </tr>`).join("");

  document.getElementById("note").textContent=`${VIEW.length} matches shown`;
}

function sortBy(f){SORT_DIR*=-1;VIEW.sort((a,b)=>a[f]>b[f]?SORT_DIR:-SORT_DIR);render();}

/* ---------------- CSV ---------------- */

function downloadCSV(){
  const rows=VIEW.map(r=>`${r.name},${r.matchDescription},${r.facility},${formatDate(r.matchDate)},${r.round},${r.matchStatus}`);
  const blob=new Blob(["Competition,Match,Stadium,Date,Round,Status\n"+rows.join("\n")]);
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="matches.csv";a.click();
}

loadData();
