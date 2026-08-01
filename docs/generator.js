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

// Event Days storage - persists all event data even when cards are hidden
let EVENT_DAYS = [];
let EVENT_DAYS_ARCHIVE = {};

function safeDecode(value) {
  let result = value || "";

  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }

  return result;
}

function getParams() {
  const p = new URLSearchParams(window.location.search);

  const competitionFromUrl = safeDecode(p.get("competition") || "");
  const venueFromUrl = safeDecode(p.get("venue") || "");
  const teamsRaw = safeDecode(p.get("teams") || "");

  const teamsFromUrl = teamsRaw
    .split("|")
    .map(x => x.trim())
    .filter(Boolean);

  if (competitionFromUrl) {
    document.getElementById("competitionName").value = competitionFromUrl;
    document.getElementById("competitionTitle").textContent = competitionFromUrl;
  }

  if (venueFromUrl) {
    document.getElementById("venue").value = venueFromUrl;
    document.getElementById("competitionVenue").textContent = venueFromUrl;
  }

  if (teamsFromUrl.length > 0) {
    document.getElementById("teamsInput").value = teamsFromUrl.join("\n");
  }
}

function getEventDays() {
  return EVENT_DAYS;
}

function updateEventDayCards() {
  const roundRobinType = Number(document.getElementById("roundRobinType").value || 1);
  const container = document.getElementById("eventDaysContainer");
  
  // Save all current values to archive before rebuilding
  const currentEventDays = {};
  document.querySelectorAll(".eventDayCard").forEach((card, idx) => {
    currentEventDays[idx] = {
      date: card.querySelector(`input[id="eventDate${idx}"]`)?.value || "",
      stadium: card.querySelector(`input[id="eventStadium${idx}"]`)?.value || "",
      hostTeam: card.querySelector(`select[id="eventHostTeam${idx}"]`)?.value || ""
    };
  });
  
  // Merge current visible values into archive
  Object.assign(EVENT_DAYS_ARCHIVE, currentEventDays);
  
  // Clear container
  container.innerHTML = "";
  EVENT_DAYS = [];
  
  // Generate new cards, restoring from archive
  for (let i = 0; i < roundRobinType; i++) {
    const archivedValue = EVENT_DAYS_ARCHIVE[i] || {};
    
    const card = document.createElement("div");
    card.className = "eventDayCard";
    
    card.innerHTML = `
      <div class="eventDayCardContent">
        <div class="eventDayTitle">Event Day ${i + 1}</div>
        
        <div class="eventDaySetting">
          <label for="eventDate${i}"><strong>Date</strong></label>
          <input 
            id="eventDate${i}" 
            type="date" 
            value="${archivedValue.date || ""}"
            onchange="updateEventDaysArray()"
          >
        </div>
        
        <div class="eventDaySetting">
          <label for="eventStadium${i}"><strong>Stadium</strong></label>
          <input 
            id="eventStadium${i}" 
            type="text" 
            placeholder="e.g., Løkin"
            value="${archivedValue.stadium || ""}"
            oninput="updateEventDaysArray()"
          >
        </div>
        
        <div class="eventDaySetting">
          <label for="eventHostTeam${i}"><strong>Host Team</strong></label>
          <select 
            id="eventHostTeam${i}"
            onchange="updateEventDaysArray()"
          >
            <option value="">-- Select a team --</option>
          </select>
        </div>
      </div>
    `;
    
    container.appendChild(card);
    EVENT_DAYS.push({
      index: i,
      date: archivedValue.date || "",
      stadium: archivedValue.stadium || "",
      hostTeam: archivedValue.hostTeam || ""
    });
  }
  
  // Update team dropdowns
  updateTeamSelects();
}

function updateTeamSelects() {
  const teamsInput = document.getElementById("teamsInput").value;
  const teamsList = teamsInput
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean);
  
  const roundRobinType = Number(document.getElementById("roundRobinType").value || 1);
  
  // Update each event day's host team dropdown
  for (let i = 0; i < roundRobinType; i++) {
    const select = document.getElementById(`eventHostTeam${i}`);
    if (!select) continue;
    
    select.innerHTML = '<option value="">-- Select a team --</option>';
    
    teamsList.forEach(team => {
      const option = document.createElement("option");
      option.value = team;
      option.textContent = team;
      select.appendChild(option);
    });
    
    // Restore previous selection: try current select value first, then fall back to EVENT_DAYS
    let valueToRestore = select.value || (EVENT_DAYS[i] ? EVENT_DAYS[i].hostTeam : "");
    
    if (valueToRestore && teamsList.includes(valueToRestore)) {
      select.value = valueToRestore;
    }
  }
  
  updateEventDaysArray();
}

function updateEventDaysArray() {
  const roundRobinType = Number(document.getElementById("roundRobinType").value || 1);
  
  for (let i = 0; i < roundRobinType; i++) {
    const dateInput = document.getElementById(`eventDate${i}`);
    const stadiumInput = document.getElementById(`eventStadium${i}`);
    const hostTeamSelect = document.getElementById(`eventHostTeam${i}`);
    
    if (EVENT_DAYS[i]) {
      EVENT_DAYS[i].date = dateInput?.value || "";
      EVENT_DAYS[i].stadium = stadiumInput?.value || "";
      EVENT_DAYS[i].hostTeam = hostTeamSelect?.value || "";
    }
  }
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

function chooseBestRounds(rounds, maxRounds, preferAvoidSameClub, cycles) {
  if (!maxRounds || maxRounds >= rounds.length) {
    return rounds;
  }

  if (!preferAvoidSameClub) {
    return rounds.slice(0, maxRounds);
  }

  const roundsPerCycle = rounds.length / cycles;
  const removeTotal = rounds.length - maxRounds;

  const removePerCycle = Math.floor(removeTotal / cycles);
  let extraRemovals = removeTotal % cycles;

  const keptRounds = [];

  for (let cycle = 0; cycle < cycles; cycle++) {
    const start = cycle * roundsPerCycle;
    const end = start + roundsPerCycle;
    const cycleRounds = rounds.slice(start, end);

    let removeCount = removePerCycle;

    if (extraRemovals > 0) {
      removeCount += 1;
      extraRemovals -= 1;
    }

    const ranked = cycleRounds.map((matches, index) => ({
      index,
      matches,
      badness: roundBadness(matches)
    }));

    ranked.sort((a, b) => {
      if (a.badness !== b.badness) return b.badness - a.badness;
      return a.index - b.index;
    });

    const removeIndexes = new Set(
      ranked.slice(0, removeCount).map(r => r.index)
    );

    cycleRounds.forEach((matches, index) => {
      if (!removeIndexes.has(index)) {
        keptRounds.push(matches);
      }
    });
  }

  return keptRounds;
}

function pairKey(a, b) {
  return [a, b].sort().join("||");
}

function makeCandidateRound(teams, usedPairs, byeCounts, avoidSameClub) {
  let list = shuffle(teams);
  let bye = null;

  if (list.length % 2 === 1) {
    list.sort((a, b) => (byeCounts[a] || 0) - (byeCounts[b] || 0));
    bye = list[0];
    list = list.slice(1);
    list = shuffle(list);
  }

  const matches = [];

  while (list.length > 0) {
    const home = list.shift();

    const options = list
      .map((away, index) => ({
        away,
        index,
        used: usedPairs.has(pairKey(home, away)),
        sameClub: clubName(home) === clubName(away)
      }))
      .filter(x => !x.used);

    if (options.length === 0) return null;

    options.sort((a, b) => {
      if (avoidSameClub && a.sameClub !== b.sameClub) {
        return a.sameClub ? 1 : -1;
      }
      return Math.random() - 0.5;
    });

    const chosen = options[0];
    list.splice(chosen.index, 1);

    matches.push({
      home,
      away: chosen.away
    });
  }

  return { matches, bye };
}

function scoreCandidateRound(candidate, byeCounts, avoidSameClub) {
  if (!candidate) return Infinity;

  let score = 0;

  if (avoidSameClub) {
    score += candidate.matches.filter(isSameClubMatch).length * 10000;
  }

  if (candidate.bye) {
    score += (byeCounts[candidate.bye] || 0) * 500;
  }

  return score;
}

function buildOneCycleSmart(teams, roundsNeeded, avoidSameClub) {
  const usedPairs = new Set();
  const byeCounts = {};
  const rounds = [];

  for (let r = 0; r < roundsNeeded; r++) {
    let best = null;
    let bestScore = Infinity;

    for (let attempt = 0; attempt < 35; attempt++) {
      const candidate = makeCandidateRound(
        teams,
        usedPairs,
        byeCounts,
        avoidSameClub
      );

      const score = scoreCandidateRound(
        candidate,
        byeCounts,
        avoidSameClub
      );

      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) break;

    best.matches.forEach(m => {
      usedPairs.add(pairKey(m.home, m.away));
    });

    if (best.bye) {
      byeCounts[best.bye] = (byeCounts[best.bye] || 0) + 1;
    }

    rounds.push(best.matches);
  }

  return rounds;
}

function scoreSchedule(rounds) {
  return rounds.reduce((sum, round) => {
    return sum + roundBadness(round);
  }, 0);
}

function teamGameCounts(rounds, teams) {
  const counts = {};

  teams.forEach(t => {
    counts[t] = 0;
  });

  rounds.forEach(round => {
    round.forEach(match => {
      counts[match.home]++;
      counts[match.away]++;
    });
  });

  return counts;
}

function globalScheduleScore(rounds, teams, preferAvoidSameClub) {
  const counts = teamGameCounts(rounds, teams);
  const values = Object.values(counts);

  const maxGames = Math.max(...values);
  const minGames = Math.min(...values);

  let sameClubMatches = 0;

  rounds.forEach(round => {
    sameClubMatches += roundBadness(round);
  });

  let score = 0;

  if (preferAvoidSameClub) {
    score += sameClubMatches * 100000;
  }

  score += (maxGames - minGames) * 500000;

  values.forEach(v => {
    score += Math.pow(v - average(values), 2) * 50000;
  });

  return score;
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildBalancedCycles(teams, cycles, maxRounds, preferAvoidSameClub) {
  const fullRoundsPerCycle =
    teams.length % 2 === 0 ? teams.length - 1 : teams.length;

  const fullTotalRounds = fullRoundsPerCycle * cycles;

  const wantedTotalRounds =
    maxRounds && maxRounds < fullTotalRounds
      ? maxRounds
      : fullTotalRounds;

  const baseRoundsPerCycle = Math.floor(wantedTotalRounds / cycles);
  const extraRoundsTemplate = wantedTotalRounds % cycles;

  let bestSchedule = null;
  let bestScore = Infinity;

  for (let fullAttempt = 0; fullAttempt < 25; fullAttempt++) {
    const allRounds = [];
    let extraRounds = extraRoundsTemplate;

    for (let cycle = 0; cycle < cycles; cycle++) {
      const roundsThisCycle =
        baseRoundsPerCycle + (extraRounds > 0 ? 1 : 0);

      if (extraRounds > 0) {
        extraRounds--;
      }

      const cycleRounds = buildOneCycleSmart(
        shuffle(teams),
        roundsThisCycle,
        preferAvoidSameClub
      );

      cycleRounds.forEach(round => {
        const adjustedMatches = round.map(match => {
          if (cycle % 2 === 1) {
            return {
              home: match.away,
              away: match.home
            };
          }

          return {
            home: match.home,
            away: match.away
          };
        });

        allRounds.push({
          matches: adjustedMatches,
          cycleIndex: cycle
        });
      });
    }

    if (allRounds.length !== wantedTotalRounds) {
      continue;
    }

    const plainRounds = allRounds.map(round => round.matches);

    const score = globalScheduleScore(
      plainRounds,
      teams,
      preferAvoidSameClub
    );

    if (score < bestScore) {
      bestScore = score;
      bestSchedule = allRounds;
    }
  }

  if (bestSchedule) {
    return bestSchedule;
  }

  // Fallback, while still preserving cycle information
  const fallback = [];
  let remaining = wantedTotalRounds;

  for (let cycle = 0; cycle < cycles && remaining > 0; cycle++) {
    const baseRounds = roundRobin(teams);
    const roundsToUse = Math.min(baseRounds.length, remaining);

    baseRounds.slice(0, roundsToUse).forEach(round => {
      fallback.push({
        cycleIndex: cycle,
        matches: round.map(match => {
          if (cycle % 2 === 1) {
            return {
              home: match.away,
              away: match.home
            };
          }

          return {
            home: match.home,
            away: match.away
          };
        })
      });
    });

    remaining -= roundsToUse;
  }

  return fallback;
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

  const selectedRounds = buildBalancedCycles(
  teams,
  cycles,
  maxRounds,
  preferAvoidSameClub
);

const allRounds = selectedRounds;

  SCHEDULE = [];


const startTime =
  document.getElementById("startTime").value || "10:00";

const matchMinutes =
  Number(document.getElementById("matchMinutes").value || 12);

const breakMinutes =
  Number(document.getElementById("breakMinutes").value || 3);

const [startHour, startMinute] =
  startTime.split(":").map(Number);

updateEventDaysArray();

selectedRounds.forEach((round, roundIndex) => {
  const event = EVENT_DAYS[round.cycleIndex] || {};

  const roundStart = new Date(
    2000,
    0,
    1,
    startHour,
    startMinute + roundIndex * (matchMinutes + breakMinutes)
  );

  const roundTime = roundStart.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  });

  round.matches.forEach((match, matchIndex) => {
    const pitch = String(matchIndex + 1);

    SCHEDULE.push({
      eventDay: round.cycleIndex + 1,
      date: event.date || "",
      stadium: event.stadium || "",
      hostTeam: event.hostTeam || "",

      umfar: roundIndex + 1,
      tíð: roundTime,
      heimalið: match.home,
      úrslit: "-",
      útilið: match.away,

      pitch,
      vøllur: pitch
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

 const sameClubRounds = selectedRounds
  ? selectedRounds
      .map(round => roundBadness(round.matches))
      .filter(x => x > 0)
      .length
  : 0;

const sameClubMatches = selectedRounds
  ? selectedRounds.reduce(
      (sum, round) => sum + roundBadness(round.matches),
      0
    )
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
  if (SCHEDULE.length === 0) {
    alert("Ger kappingina áðrenn tú tekur Excel niður.");
    return;
  }

  const excelRows = SCHEDULE.map(row => ({
    "Kappingardagur": row.eventDay,
    "Dato": row.date,
    "Stadion": row.stadium,
    "Vøllur": row.pitch,
    "Umfar": row.umfar,
    "Tíð": row.tíð,
    "Heimalið": row.heimalið,
    "Úrslit": row.úrslit,
    "Útilið": row.útilið,
    "Vertslið": row.hostTeam
  }));

  const ws = XLSX.utils.json_to_sheet(excelRows);

  ws["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 24 },
    { wch: 9 },
    { wch: 9 },
    { wch: 9 },
    { wch: 24 },
    { wch: 9 },
    { wch: 24 },
    { wch: 24 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tournament");

  const name =
    document.getElementById("competitionName").value || "tournament";

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
async function exportPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library is not loaded yet. Try refreshing the page.");
    return;
  }

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

  let qrImg = null;

  try {
    const compactData = {
      c: competition,
      v: venue,
      m: SCHEDULE.map(r => [
        r.umfar,
        r.tíð || "",
        r.heimalið,
        r.útilið,
        r.vøllur
      ])
    };

    const scheduleUrl =
      window.location.origin +
      window.location.pathname.replace("generator.html", "schedule.html") +
      "?d=" +
      encodeURIComponent(JSON.stringify(compactData));

    const qrApiUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" +
      encodeURIComponent(scheduleUrl);

    qrImg = await loadImageAsDataUrl(qrApiUrl);
  } catch (e) {
    console.warn("Could not add QR code", e);
  }

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
    startY: 38,
    margin: { left: 10, right: 10 },
    theme: "grid",
    tableWidth: 175,
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
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 48 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 48 },
      5: { cellWidth: 12, halign: "center" }
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

  const finalY = doc.lastAutoTable.finalY;

  try {
    const logo = await loadImageAsDataUrl("fsf-logo.png");
    doc.addImage(logo, "PNG", 10, finalY + 10, 30, 35);
  } catch (e) {
    console.warn("Could not add FSF logo", e);
  }

  if (qrImg) {
    doc.addImage(qrImg, "PNG", 50, finalY + 10, 35, 35);

    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("Skanna fyri skrá", 50, finalY + 48);
  }

  const safeName = competition
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "_");

  doc.save(`${safeName || "kapping"}.pdf`);
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = reject;
    img.src = url;
  });
}

getParams();
updateEventDayCards();

if (document.getElementById("teamsInput").value.trim()) {
  generate();
}
