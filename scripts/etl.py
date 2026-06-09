import requests
import json
import os
import time

# --- API KEYS ---
NATIONAL_KEY = os.environ.get("FSF_MATCHES_API_KEY")
INTERNATIONAL_KEY = os.environ.get("FSF_INT_MATCHES_API_KEY")

if not NATIONAL_KEY:
    raise Exception("Missing FSF_MATCHES_API_KEY")

if not INTERNATIONAL_KEY:
    raise Exception("Missing FSF_INT_MATCHES_API_KEY")

PAGE_SIZE = 25

def build_url(api_key, page):
    return f"https://comet.fsf.fo/data-backend/api/public/areports/run/{page}/{PAGE_SIZE}/?API_KEY={api_key}"

def fetch_all(api_key, source):
    print(f"Fetching {source} matches...")

    page = 0
    all_rows = []

    while True:
        url = build_url(api_key, page)
        res = requests.get(url, timeout=120)
        res.raise_for_status()
        data = res.json()

        if not isinstance(data, dict) or "results" not in data:
            raise Exception(f"{source} API did not return expected report format")

        rows = data["results"]

        for row in rows:
            row["source"] = source

        all_rows.extend(rows)

        print(f"{source}: page {page + 1}/{data.get('lastPage', '?') + 1 if data.get('lastPage') is not None else '?'} -> {len(rows)} rows")

        # stop when we reached the last page
        if data.get("lastPage") is not None and data.get("page") is not None:
            if int(data["page"]) >= int(data["lastPage"]):
                break
        else:
            if len(rows) < PAGE_SIZE:
                break

        page += 1
        time.sleep(0.2)

    print(f"{source}: total {len(all_rows)} matches")
    return all_rows

# --- FETCH BOTH ---
national = fetch_all(NATIONAL_KEY, "National")
international = fetch_all(INTERNATIONAL_KEY, "International")

# --- SAVE FILES ---
os.makedirs("docs/data", exist_ok=True)

with open("docs/data/matches_national.json", "w", encoding="utf-8") as f:
    json.dump(national, f, ensure_ascii=False)

with open("docs/data/matches_international.json", "w", encoding="utf-8") as f:
    json.dump(international, f, ensure_ascii=False)

print(f"✅ Saved {len(national)} national and {len(international)} international matches")
