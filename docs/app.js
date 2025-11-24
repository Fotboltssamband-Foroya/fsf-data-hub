const FO = 'Atlantic/Faroe';

async function load() {
const res = await fetch('data/matches.json', { cache: 'no-store' });
  const rows = await res.json();
  window.__RAW__ = rows;
  initFilters(rows);
  render();
}

function uniq(arr){ return [...new Set(arr)].filter(Boolean).sort(); }

function initFilters(rows){
  const comps = uniq(rows.map(r => (r.competitionType||'').trim()));
  const sel = document.getElementById('competition');
  sel.innerHTML = '<option value="">(all)</option>' + comps.map(c=>`<option>${c}</option>`).join('');
}

function applyFilters(rows){
  const comp = document.getElementById('competition').value.trim();
  const team = document.getElementById('team').value.trim().toLowerCase();
  const facility = document.getElementById('facility').value.trim().toLowerCase();
  const dateStr = document.getElementById('date').value;

  let out = rows.slice();
  if (comp) out = out.filter(r => (r.competitionType||'').trim() === comp);
  if (team) {
    out = out.filter(r =>
      String(r.homeTeam||'').toLowerCase().includes(team) ||
      String(r.awayTeam||'').toLowerCase().includes(team) ||
      String(r.matchDescription||'').toLowerCase().includes(team)
    );
  }
  if (facility) {
    out = out.filter(r =>
      String(r.facility||'').toLowerCase().includes(facility) ||
      String(r.facilityPlaceName||'').toLowerCase().includes(facility)
    );
  }
  if (dateStr) out = out.filter(r => sameFODate(r.matchDate, dateStr));
  return out;
}

function sameFODate(ms, ymd){
  if (!ms) return false;
  const d = new Date(Number(ms));
  const opt = { timeZone: FO, year:'numeric', month:'2-digit', day:'2-digit' };
  const [m,day,yr] = new Intl.DateTimeFormat('en-GB', opt).format(d).split('/');
  const iso = `${yr}-${m}-${day}`;
  return iso === ymd;
}

function render(){
  const rows = applyFilters(window.__RAW__ || []);
  const view = document.getElementById('view').value;
  if (view === 'weekday') return renderWeekdayByTeam(rows);
  if (view === 'stadium-day') return renderStadiumDay(rows);
}

function foDateTime(ms){
  if (!ms) return '';
  const d = new Date(Number(ms));
  const optD = { timeZone: FO, year:'numeric', month:'2-digit', day:'2-digit' };
  const optT = { timeZone: FO, hour:'2-digit', minute:'2-digit', hour12:false };
  const dstr = new Intl.DateTimeFormat('en-GB', optD).format(d).split('/').reverse().join('-');
  const tstr = new Intl.DateTimeFormat('en-GB', optT).format(d);
  return `${dstr} ${tstr}`;
}

function renderWeekdayByTeam(rows){
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const map = new Map();

  rows.forEach(r=>{
    if (!r.matchDate) return;
    const dayIdx = new Date(new Date(Number(r.matchDate)).toLocaleString('en-US', { timeZone: FO })).getDay();
    [['homeTeam'],['awayTeam']].forEach(([k])=>{
      const id = String(r[k] || '').trim();
      if (!id) return;
      if (!map.has(id)) map.set(id, Array(7).fill(0));
      map.get(id)[dayIdx] += 1;
    });
  });

  const thead = document.querySelector('#tbl thead');
  const tbody = document.querySelector('#tbl tbody');
  thead.innerHTML = `<tr><th>Team ID</th>${dayNames.map(d=>`<th>${d}</th>`).join('')}<th>Total</th></tr>`;
  tbody.innerHTML = '';
  [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([id,counts])=>{
    const total = counts.reduce((a,b)=>a+b,0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${id}</td>${counts.map(n=>`<td>${n}</td>`).join('')}<td>${total}</td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('note').textContent =
    'View: Weekday by team (counts of scheduled matches Mon–Sun in FO time)';
}

function renderStadiumDay(rows){
  rows = rows.filter(r => r.matchDate).sort((a,b)=>Number(a.matchDate)-Number(b.matchDate));
  const thead = document.querySelector('#tbl thead');
  const tbody = document.querySelector('#tbl tbody');
  thead.innerHTML = `
    <tr>
      <th>Time (FO)</th><th>Facility</th><th>Field</th>
      <th>Home</th><th>Away</th><th>Competition</th><th>Round</th><th>Status</th>
    </tr>`;
  tbody.innerHTML = '';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${foDateTime(r.matchDate)}</td>
      <td>${r.facility||''}</td>
      <td>${r.field||''}</td>
      <td>${r.homeTeam||''}</td>
      <td>${r.awayTeam||''}</td>
      <td>${(r.competitionType||'').trim()}</td>
      <td>${r.round ?? ''}</td>
      <td>${r.matchStatus ?? ''}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('note').textContent =
    'View: Matches at stadium on selected date (filter by Date + Facility)';
}

document.getElementById('apply').onclick = render;

document.getElementById('copy').onclick = async () => {
  const table = document.getElementById('tbl');
  const range = document.createRange();
  range.selectNode(table);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  try { await navigator.clipboard.writeText(table.innerText); } catch(e){}
  sel.removeAllRanges();
  alert('Table copied (plain text). Paste anywhere.');
};

document.getElementById('csv').onclick = () => {
  const rows = [...document.querySelectorAll('#tbl tr')].map(tr =>
    [...tr.children].map(td => `"${td.innerText.replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([rows], {type:'text/csv'});
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'fsf_view.csv' });
  a.click();
};

document.getElementById('png').onclick = async () => {
  const node = document.querySelector('main');
  const canvas = await html2canvas(node, { scale: 2 });
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'fsf_view.png';
  a.click();
};

load();
