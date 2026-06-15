const params = new URLSearchParams(window.location.search);
const raw = params.get("d");

if (!raw) {
  document.getElementById("scheduleList").innerHTML =
    "<p>Ongin skrá funnin.</p>";
  throw new Error("No schedule data");
}
const compact = JSON.parse(decodeURIComponent(raw));

const data = {
  competition: compact.c,
  venue: compact.v,
  matches: compact.m.map(x => ({
    umfar: x[0],
    tíð: x[1],
    heimalið: x[2],
    útilið: x[3],
    vøllur: x[4]
  }))
};

document.getElementById("competition").textContent = data.competition || "Kappingarskrá";
document.getElementById("venue").textContent = data.venue ? `Vøllur: ${data.venue}` : "";

const grouped = {};

(data.matches || []).forEach(match => {
  if (!grouped[match.umfar]) grouped[match.umfar] = [];
  grouped[match.umfar].push(match);
});

const html = Object.keys(grouped)
  .sort((a, b) => Number(a) - Number(b))
  .map(round => {
    const matches = grouped[round];

    return `
      <section class="roundCard">
        <div class="roundTitle">
          <strong>Umfar ${round}</strong>
          <span>${matches[0]?.tíð || ""}</span>
        </div>

        ${matches.map(m => `
          <div class="matchCard">
            <div class="pitch">Vøllur ${m.vøllur}</div>
            <div class="teams">
              <span>${escapeHtml(m.heimalið)}</span>
              <span class="dash">-</span>
              <span>${escapeHtml(m.útilið)}</span>
            </div>
          </div>
        `).join("")}
      </section>
    `;
  })
  .join("");

document.getElementById("scheduleList").innerHTML = html;

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
