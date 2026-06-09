#!/usr/bin/env python3
"""
Unsplash Search Agent
=====================
Searches images on Unsplash via the official API and returns a list of dicts with:
  - imageUrl:      Direct image URL (size "regular")
  - imageUrlFull:  Full-size image URL (for download)
  - pageUrl:       Unsplash page URL where the image is hosted
  - authorName:    Photographer name
  - authorUrl:     Unsplash profile URL of the photographer
  - license:       License text (always "Unsplash License")
  - licenseUrl:    Unsplash license terms URL
  - altDescription: Alt description of the image

Standalone usage:
  python3 unsplash_agent.py "mountain" --max 10
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import sys
import argparse

from config import UNSPLASH_ACCESS_KEY

# ── Unsplash API Constants ────────────────────────────────────────────────────────

API_BASE        = "https://api.unsplash.com"
SEARCH_ENDPOINT = f"{API_BASE}/search/photos"
LICENSE_TEXT    = "Unsplash License"
LICENSE_URL     = "https://unsplash.com/license"


# ── Search ──────────────────────────────────────────────────────────────────────

def search_photos(query: str, max_results: int = 20) -> list[dict]:
    """
    Searches photos on Unsplash and returns a list of normalised dicts.
    """
    if not UNSPLASH_ACCESS_KEY or UNSPLASH_ACCESS_KEY == "YOUR_ACCESS_KEY_HERE":
        raise ValueError(
            "Unsplash Access Key not configured. "
            "Edit unsplash/config.py or set the UNSPLASH_ACCESS_KEY environment variable."
        )

    per_page = min(max_results, 30)           # API max 30 per call
    pages_needed = (max_results + per_page - 1) // per_page

    results = []
    for page in range(1, pages_needed + 1):
        remaining = max_results - len(results)
        if remaining <= 0:
            break
        fetch = min(remaining, 30)

        params = urllib.parse.urlencode({
            "query":    query,
            "per_page": fetch,
            "page":     page,
        })
        url = f"{SEARCH_ENDPOINT}?{params}"
        req = urllib.request.Request(url, headers={
            "Authorization":  f"Client-ID {UNSPLASH_ACCESS_KEY}",
            "Accept-Version": "v1",
            "User-Agent":     "unsplash-search-agent/1.0",
        })

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Unsplash API error {e.code}: {body}")

        photos = data.get("results", [])
        if not photos:
            break

        for photo in photos:
            urls  = photo.get("urls", {})
            user  = photo.get("user", {})
            links = photo.get("links", {})
            results.append({
                "id":             photo.get("id", ""),
                "imageUrl":       urls.get("regular", ""),
                "imageUrlFull":   urls.get("full", ""),
                "imageUrlSmall":  urls.get("small", ""),
                "pageUrl":        links.get("html", ""),
                "downloadUrl":    links.get("download", ""),
                "authorName":     user.get("name", ""),
                "authorUrl":      user.get("links", {}).get("html", ""),
                "authorUsername": user.get("username", ""),
                "license":        LICENSE_TEXT,
                "licenseUrl":     LICENSE_URL,
                "altDescription": photo.get("alt_description", "") or photo.get("description", "") or "",
                "width":          photo.get("width", 0),
                "height":         photo.get("height", 0),
            })
            if len(results) >= max_results:
                break

    return results


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Search images on Unsplash and produce JSON."
    )
    parser.add_argument("query", nargs="+", help="Search keyword(s)")
    parser.add_argument("--max", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--output", type=str, default=None, help="JSON output file")
    args = parser.parse_args()

    query = " ".join(args.query)
    print(f"[SEARCH] Query: '{query}', max={args.max}")

    try:
        results = search_photos(query, max_results=args.max)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    print(f"[OK] Found {len(results)} results.")

    json_out = json.dumps(results, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_out)
        print(f"[OK] Saved to: {args.output}")
    else:
        print(json_out)


if __name__ == "__main__":
    main()
