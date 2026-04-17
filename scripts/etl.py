import requests
import json
import os

# --- API KEYS ---
NATIONAL_KEY = os.environ.get("FSF_MATCHES_API_KEY")
INTERNATIONAL_KEY = os.environ.get("FSF_INT_MATCHES_API_KEY")

if not NATIONAL_KEY:
    raise Exception("Missing FSF_MATCHES_API_KEY")

if not INTERNATIONAL_KEY:
    raise Exception("Missing FSF_INT_MATCHES_API_KEY")

# --- API URLs ---
NATIONAL_URL = f"https://comet.fsf.fo/data-backend/api/public/areports/run/0/10000000/?API_KEY={NATIONAL_KEY}"
INTERNATIONAL_URL = f"https://comet.fsf.fo/data-backend/api/public/areports/run/0/10000000/?API_KEY={INTERNATIONAL_KEY}"

def fetch(url, source):
    print(f"Fetching {source} matches...")

    res = requests.get(url)
    res.raise_for_status()

    data = res.json()

    if not isinstance(data, list):
        raise Exception(f"{source} API did not return a list")

    for row in data:
        row["source"] = source

    print(f"{source}: {len(data)} matches")

    return data

# --- FETCH ---
national = fetch(NATIONAL_URL, "National")
international = fetch(INTERNATIONAL_URL, "International")

# --- SAVE FILES ---
os.makedirs("docs/data", exist_ok=True)

with open("docs/data/matches_national.json", "w") as f:
    json.dump(national, f, ensure_ascii=False)

with open("docs/data/matches_international.json", "w") as f:
    json.dump(international, f, ensure_ascii=False)

print(f"✅ Saved {len(national)} national and {len(international)} international matches")
