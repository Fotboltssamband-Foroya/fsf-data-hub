const params = new URLSearchParams(window.location.search);

const raw = params.get("data");

if (!raw) {
  document.body.innerHTML = "<h2>Ongin skrá funnin</h2>";
  throw new Error("No data");
}

const decoded = JSON.parse(
  decodeURIComponent(raw)
);

document.getElementById("competition").textContent =
  decoded.competition || "";

document.getElementById("venue").textContent =
  decoded.venue
    ? `Vøllur: ${decoded.venue}`
    : "";

const tbody =
  document.getElementById("tbody");

tbody.innerHTML =
  decoded.matches.map(m => `
    <tr class="${m.umfar % 2 === 0 ? "roundEven" : ""}">
      <td>${m.umfar}</td>
      <td>${m.tið || ""}</td>
      <td>${m.heimalið}</td>
      <td>${m.útilið}</td>
      <td>${m.vøllur}</td>
    </tr>
  `).join("");
