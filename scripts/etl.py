import os, json, time, requests

BASE = os.getenv("FSF_API_BASE")  # .../run/{page}/{pageSize}/?API_KEY=...
PAGE_SIZE = 250
MAX_RETRIES = 6

def get_json(url):
    delay = 2
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            return r.json()
        except Exception:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 30)

def fetch_all():
    if not BASE:
        raise RuntimeError("Missing env var FSF_API_BASE")

    page = 0
    out = []

    while True:
        url = BASE.replace("{page}", str(page)).replace("{pageSize}", str(PAGE_SIZE))
        doc = get_json(url)

        if not isinstance(doc, dict) or "results" not in doc:
            raise ValueError("Expected COMET report response with {results, page, lastPage}")

        rows = doc["results"]
        out.extend(rows)

        print(f"Page {doc.get('page')} / {doc.get('lastPage')} -> {len(rows)} rows (total so far {len(out)})")

        # Stop when we reached lastPage
        if doc.get("lastPage") is not None and doc.get("page") is not None:
            if int(doc["page"]) >= int(doc["lastPage"]):
                break
        else:
            # fallback: stop on short page
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

    print(f"Done. Total rows: {len(rows)}")

if __name__ == "__main__":
    main()
