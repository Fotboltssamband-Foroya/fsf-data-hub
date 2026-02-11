import os, json, time, requests

PAGE_SIZE = 500
BASE = os.getenv("FSF_API_BASE")  # .../run/{page}/{pageSize}/?API_KEY=...

def fetch_all():
    if not BASE:
        raise RuntimeError("Missing env var FSF_MATCHES_API_BASE")

    page = 0
    out = []

    while True:
        url = BASE.replace("{page}", str(page)).replace("{pageSize}", str(PAGE_SIZE))
        r = requests.get(url, timeout=90)
        r.raise_for_status()
        doc = r.json()

        # COMET report shape: usually {results:[...]}
        rows = doc.get("results", doc) if isinstance(doc, dict) else doc
        if not isinstance(rows, list):
            raise ValueError("Unexpected API response shape (expected list or {results:list})")

        out.extend(rows)

        if len(rows) < PAGE_SIZE:
            break

        page += 1
        time.sleep(0.2)

    return out

def main():
    os.makedirs("docs/data", exist_ok=True)
    rows = fetch_all()

    with open("docs/data/matches.json", "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)

    print(f"Wrote {len(rows)} rows to docs/data/matches.json")

if __name__ == "__main__":
    main()
