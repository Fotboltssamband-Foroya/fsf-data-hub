let SCHEDULE = [];

function getParams() {
  const p = new URLSearchParams(window.location.search);

  const teams = (p.get("teams") || "")
    .split("|")
    .map(x => x.trim())
    .filter(Boolean);

  document.getElementById("competitionName").value = p.get("competition") || "";
  document.getElementById("venue").value = p.get("venue") || "";
  document.getElementById("teamsInput").value = teams.join("\n");
}

function roundRobin(teams) {
  let list = [...teams];

  if (list.length % 2 === 1) {
    list.push("FRÍ");
  }

  const rounds = [];
  const n = list.length;

  for (let r = 0; r < n - 1; r++) {
    const matches = [];

    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];

      if (home !== "FRÍ" && away !== "FRÍ") {
        matches.push({ home, away });
      }
    }

    rounds.push(matches);

    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list = [fixed, ...rest];
  }

  return rounds;
}

function generate() {
  const teams = document.getElementById("teamsInput").value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const venue = document.getElementById("venue").value.trim();
  const roundCount = Number(document.getElementById("roundCount").value || 1);

  SCHEDULE = [];

  for (let cycle = 0; cycle < roundCount; cycle++) {
    const rounds = roundRobin(teams);

    rounds.forEach((matches, index) => {
  matches.forEach((m, matchIndex) => {
    let home = m.home;
    let away = m.away;

    if (cycle % 2 === 1) {
      home = m.away;
      away = m.home;
    }

    SCHEDULE.push({
      umfar: index + 1 + (cycle * rounds.length),
      heimalið: home,
      úrslit: "-",
      útilið: away,
      vøllur: `${matchIndex + 1}`
    });
  });
});
  }

  render();
}

function render() {
  const tbody = document.querySelector("#tbl tbody");

  tbody.innerHTML = SCHEDULE.map(r => `
    <tr>
      <td>${escapeHtml(r.umfar)}</td>
      <td>${escapeHtml(r.heimalið)}</td>
      <td>${escapeHtml(r.úrslit)}</td>
      <td>${escapeHtml(r.útilið)}</td>
      <td>${escapeHtml(r.vøllur)}</td>
    </tr>
  `).join("");

  document.getElementById("note").textContent =
    `${SCHEDULE.length} matches generated`;
}

function exportExcel() {
  const ws = XLSX.utils.json_to_sheet(SCHEDULE.map(r => ({
    "Umfar": r.umfar,
    "Heimalið": r.heimalið,
    "Úrslit": r.úrslit,
    "Útilið": r.útilið,
    "Vøllur": r.vøllur
  })));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tournament");

  const name = document.getElementById("competitionName").value || "tournament";
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

getParams();
generate();
