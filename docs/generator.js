const params = new URLSearchParams(window.location.search);

const competition =
  params.get("competition") || "";

const venue =
  params.get("venue") || "";

const teams =
  (params.get("teams") || "")
    .split("|")
    .filter(Boolean);

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

function clubName(team) {
  return String(team || "")
    .trim()
    .replace(/\s+[a-z]$/i, "")
    .trim();
}

function isSameClubMatch(match) {
  return clubName(match.home) === clubName(match.away);
}

function roundBadness(matches) {
  return matches.filter(isSameClubMatch).length;
}

function shuffle(arr) {
  const a = [...arr];

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
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

function buildRoundRobinCycles(teams, cycles) {
  const allRounds = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    const baseRounds = roundRobin(teams);

    baseRounds.forEach((matches) => {
      const roundMatches = matches.map(m => {
        if (cycle % 2 === 1) {
          return { home: m.away, away: m.home };
        }

        return { home: m.home, away: m.away };
      });

      allRounds.push(roundMatches);
    });
  }

  return allRounds;
}

function concentrationScore(rounds) {
  const badnesses = rounds.map(roundBadness).sort((a, b) => b - a);

  let score = 0;

  badnesses.forEach((b, i) => {
    score += (b * b * 1000) - i;
  });

  return score;
}

function optimizeSameClubConcentration(teams, cycles) {
  const attempts = 1200;
  let bestRounds = buildRoundRobinCycles(teams, cycles);
  let bestScore = concentrationScore(bestRounds);

  for (let i = 0; i < attempts; i++) {
    const shuffledTeams = shuffle(teams);
    const candidate = buildRoundRobinCycles(shuffledTeams, cycles);
    const score = concentrationScore(candidate);

    if (score > bestScore) {
      bestScore = score;
      bestRounds = candidate;
    }
  }

  return bestRounds;
}

function chooseBestRounds(rounds, maxRounds, preferAvoidSameClub) {
  if (!maxRounds || maxRounds >= rounds.length) {
    return rounds;
  }

  if (!preferAvoidSameClub) {
    return rounds.slice(0, maxRounds);
  }

  const ranked = rounds.map((matches, index) => ({
    index,
    matches,
    badness: roundBadness(matches)
  }));

  ranked.sort((a, b) => {
    if (a.badness !== b.badness) return a.badness - b.badness;
    return a.index - b.index;
  });

  const chosenIndexes = ranked
    .slice(0, maxRounds)
    .map(r => r.index)
    .sort((a, b) => a - b);

  return chosenIndexes.map(i => rounds[i]);
}

function generate() {
  const teams = document.getElementById("teamsInput").value
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  const cycles = Number(document.getElementById("roundRobinType").value || 1);
  const maxRoundsInput = document.getElementById("maxRounds").value;
  const maxRounds = maxRoundsInput ? Number(maxRoundsInput) : null;
  const concentrateSameClub = document.getElementById("concentrateSameClub").checked;
  const preferAvoidSameClub = document.getElementById("preferAvoidSameClub").checked;

  const allRounds = concentrateSameClub
    ? optimizeSameClubConcentration(teams, cycles)
    : buildRoundRobinCycles(teams, cycles);

  const selectedRounds = chooseBestRounds(allRounds, maxRounds, preferAvoidSameClub);

  SCHEDULE = [];


const startTime =
  document.getElementById("startTime").value || "10:00";

const matchMinutes =
  Number(document.getElementById("matchMinutes").value || 12);

const breakMinutes =
  Number(document.getElementById("breakMinutes").value || 3);

const [startHour, startMinute] =
  startTime.split(":").map(Number);

selectedRounds.forEach((matches, roundIndex) => {

  const roundStart =
    new Date(
      2000,
      0,
      1,
      startHour,
      startMinute +
      roundIndex * (matchMinutes + breakMinutes)
    );

  const roundTime =
    roundStart.toLocaleTimeString(
      "en-GB",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  matches.forEach((m, matchIndex) => {

    SCHEDULE.push({
      umfar: roundIndex + 1,
      tíð: roundTime,
      heimalið: m.home,
      úrslit: "-",
      útilið: m.away,
      vøllur: String(matchIndex + 1)
    });

  });

});

  render(selectedRounds, allRounds.length);
}

function render(selectedRounds, totalRounds) {
  const tbody = document.querySelector("#tbl tbody");

  tbody.innerHTML = SCHEDULE.map(r => `
    <tr>
<td>${escapeHtml(r.umfar)}</td>
<td>${escapeHtml(r.tíð)}</td>
<td>${escapeHtml(r.heimalið)}</td>
<td>${escapeHtml(r.úrslit)}</td>
<td>${escapeHtml(r.útilið)}</td>
<td>${escapeHtml(r.vøllur)}</td>
    </tr>
  `).join("");

  const keptRounds = selectedRounds ? selectedRounds.length : 0;
  const sameClubRounds = selectedRounds
    ? selectedRounds.map(roundBadness).filter(x => x > 0).length
    : 0;

  const sameClubMatches = selectedRounds
    ? selectedRounds.reduce((sum, r) => sum + roundBadness(r), 0)
    : 0;

 document.getElementById("pdfCompetition").textContent =
  document.getElementById("competitionName").value;

document.getElementById("pdfVenue").textContent =
  "Vøllur: " + document.getElementById("venue").value;

document.getElementById("pdfTeams").textContent =
  "Lið: " +
  document.getElementById("teamsInput")
    .value
    .split("\n")
    .filter(Boolean)
    .length;

document.getElementById("pdfRounds").textContent =
  "Umfør: " + keptRounds;
}

function exportExcel() {
  const ws = XLSX.utils.json_to_sheet(SCHEDULE.map(r => ({
    "Umfar": r.umfar,
"Tíð": r.tíð,
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
function exportPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library is not loaded yet. Try refreshing the page.");
    return;
  }

const qrDiv = document.createElement("div");

new QRCode(qrDiv, {
  text: window.location.href,
  width: 120,
  height: 120
});

const qrCanvas = qrDiv.querySelector("canvas");

if (qrCanvas) {
  const qrImg = qrCanvas.toDataURL("image/png");

  doc.addImage(
    qrImg,
    "PNG",
    165,   // x
    8,     // y
    30,    // width
    30     // height
  );
}

  const logo = await loadImage("fsf-logo.png");

doc.addImage(
  logo,
  "PNG",
  10,
  270,
  25,
  12
);
  
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const competition = document.getElementById("competitionName").value || "Kapping";
  const venue = document.getElementById("venue").value || "";
  const generated = new Date().toLocaleString("fo-FO");

  doc.setFontSize(16);
  doc.setTextColor(0, 59, 122);
  doc.text(competition, 10, 12);

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Vøllur: ${venue}`, 10, 20);
  doc.text(`Útskrivað: ${generated}`, 10, 24);

  const rows = SCHEDULE.map(r => [
    r.umfar,
    r.tíð || "",
    r.heimalið,
    r.úrslit,
    r.útilið,
    r.vøllur
  ]);

doc.autoTable({
  head: [["Umfar", "Tíð", "Heimalið", "Úrslit", "Útilið", "Vøllur"]],
  body: rows,
  startY: 30,
  margin: { left: 10, right: 10 },
  theme: "grid",
  tableWidth: 190,

  styles: {
    fontSize: 7.2,
    cellPadding: 1,
    overflow: "linebreak",
    valign: "middle",
    lineWidth: 0.12
  },

  headStyles: {
    fillColor: [0, 59, 122],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    halign: "center"
  },

  columnStyles: {
    0: { cellWidth: 13, halign: "center" },
    1: { cellWidth: 16, halign: "center" },
    2: { cellWidth: 52 },
    3: { cellWidth: 13, halign: "center" },
    4: { cellWidth: 52 },
    5: { cellWidth: 13, halign: "center" }
  },

  didParseCell: function (data) {
    if (data.section === "body") {
      const round = Number(data.row.raw[0]);

      if (round % 2 === 0) {
        data.cell.styles.fillColor = [238, 242, 247];
      }

      if ([0, 1, 3, 5].includes(data.column.index)) {
        data.cell.styles.halign = "center";
      }
    }
  }
});

  const safeName = competition
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "_");

  doc.save(`${safeName || "kapping"}.pdf`);
}
getParams();
generate();
