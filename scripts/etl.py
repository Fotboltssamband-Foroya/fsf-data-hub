import os, json, time, requests
from datetime import datetime, timezone

PAGE_SIZE = 250  # bigger = fewer API calls
BASE = os.getenv("FSF_API_BASE")  # e.g. .../areports/run/{page}/{pageSize}/?API_KEY=...

def fetch_all():
    page = 0
    all_rows = []
    while True:
        url = BASE.replace("{page}", str(page)).replace("{pageSize}", str(PAGE_SIZE))
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        doc = r.json()
        rows = doc.get("results", [])
        all_rows.extend(rows)
        if len(rows) < PAGE_SIZE:
            break
        page += 1
        time.sleep(0.2)
    return all_rows

def add_iso_timestamps(rows):
    for r in rows:
        for k in ("matchDate","inStatusSince","homeTeamInStatusSince","awayTeamInStatusSince"):
            v = r.get(k)
            if isinstance(v, (int, float)) and v:
                r[k + "_iso_utc"] = datetime.fromtimestamp(v/1000, tz=timezone.utc).isoformat()

def main():
    os.makedirs("data", exist_ok=True)
    rows = fetch_all()
    add_iso_timestamps(rows)
    with open("data/matches.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f"Wrote {len(rows)} matches to data/matches.json")

if __name__ == "__main__":
    main()
