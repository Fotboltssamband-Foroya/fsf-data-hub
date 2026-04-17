import requests
import json
import os

# --- API KEYS ---
NATIONAL_KEY = os.environ.get("FSF_MATCHES_API_KEY")
INTERNATIONAL_KEY = os.environ.get("FSF_INT_MATCHES_API_KEY")

# --- API URLs ---
NATIONAL_URL = f"https://comet.fsf.fo/data-backend/api/public/areports/run/0/10000000/?API_KEY={NATIONAL_KEY}"
INTERNATIONAL_URL = f"https://comet.fsf.fo/data-backend/api/public/areports/run/0/10000000/?API_KEY={INTERNATIONAL_KEY}"

def fetch(url, source):
    res = requests.get(url)
    res.raise_for_status()
    data = res.json()

    # add source tag to every row
    for row in data:
        row["source"] = source

    return data

# --- FETCH ---
national = fetch(NATIONAL_URL, "National")
international = fetch(INTERNATIONAL_URL, "International")

# --- SAVE FILES ---
os.makedirs("docs/data", exist_ok=True)

with open("docs/data/matches_national.json", "w") as f:
    json.dump(national, f)

with open("docs/data/matches_international.json", "w") as f:
    json.dump(international, f)

print(f"Saved {len(national)} national and {len(international)} international matches")
