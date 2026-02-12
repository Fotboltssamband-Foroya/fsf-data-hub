import os, json, time, requests

API_KEY = os.getenv("FSF_MATCHES_API_KEY")
PAGE_SIZE = 250
MAX_RETRIES = 6

def get_url(page: int) -> str:
    return (
        "https://comet.fsf.fo/data-backend/api/public/areports/run/"
        f"{page}/{PAGE_SIZE}/?API_KEY={API_KEY}"
    )

def get_json(url: str):
    delay = 2
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt == MAX_RETRIES:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 30)

def fetch_all():
    if not API_KEY:
        raise RuntimeError("Missing env var FSF_MATCHES_API_KEY")

    out = []
    page = 0
    last_page = None

    while True:
        url = get_url(page)
        doc = get_json(url)

        if not isinstance(doc, dict) or "results" not in doc:
            raise ValueError("Expected COMET report response with {results, page, lastPage}")

        rows = doc["results"]
        out.extend(rows)

        # these exist in your matches report JSON
        page_now = int(doc.get("page", page))
        last_page = int(doc.get("lastPage", page_now))

        print(f"Page {page_now}/{last_page}: {len(rows)} rows (total {len(out)})")

        if page_now >= last_page:
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
