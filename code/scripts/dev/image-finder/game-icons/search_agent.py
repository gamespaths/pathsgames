#!/usr/bin/env python3
"""
game-icons.net Search Agent
============================
Search icon on game-icons.net by keyword (also in Italian) and produces a JSON with:
  - imageUrl: data URI SVG in Base64 with applied transformations
  - linkCopyright: URL of the icon page on game-icons.net
  - name: icon name

Transformations applied to the original SVG:
  - background=none        → removes the black background path
  - foreground-shrink x4  → scales to 65.6% (0.9^4) centered on the canvas
  - foreground-Position=-20px → moves vertically by -20 SVG units

Usage:
  python3 search_agent.py "baby"
  python3 search_agent.py "baby" --max 5
  python3 search_agent.py "sword warrior" --max 3 --output icons.json
"""

import urllib.request
import urllib.error
import urllib.parse
import base64
import json
import re
import sys
import os
import time
import argparse
import difflib
import xml.etree.ElementTree as ET
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────────

GITHUB_API_TREE = (
    "https://api.github.com/repos/game-icons/icons/git/trees/master?recursive=1"
)
GITHUB_RAW_BASE = (
    "https://raw.githubusercontent.com/game-icons/icons/master"
)
GAME_ICONS_BASE = "https://game-icons.net/1x1"

# Local cache of the GitHub tree (avoids re-downloading on every run)
CACHE_FILE = Path(__file__).parent / ".icons_tree_cache.json"
CACHE_TTL_SECONDS = 60 * 60 * 24  # 24 hours

# SVG transformations
SHRINK_FACTOR = 1 # 0.9 ** 4          # 4 click di shrink = 0.6561
POSITION_Y_OFFSET = 0 #ex -75            # foreground-Position=-20px (unità SVG)
SVG_CENTER = 256                   # viewBox è 0 0 512 512, centro = 256

# ── IT→EN dictionary for common keywords ──────────────────────────────────────

ITALIAN_TO_ENGLISH = {
    "bambino": "baby child",
    "bimbo": "baby child",
    "bambina": "baby girl",
    "spada": "sword",
    "guerriero": "warrior",
    "mostro": "monster creature",
    "drago": "dragon",
    "fuoco": "fire",
    "acqua": "water",
    "erba": "grass",
    "albero": "tree",
    "casa": "house",
    "castello": "castle",
    "re": "king",
    "regina": "queen",
    "cavaliere": "knight",
    "mago": "wizard",
    "arco": "bow",
    "freccia": "arrow",
    "scudo": "shield",
    "elmo": "helmet",
    "armatura": "armor",
    "veleno": "poison",
    "magia": "magic",
    "morte": "death",
    "cuore": "heart",
    "stella": "star",
    "luna": "moon",
    "sole": "sun",
    "montagna": "mountain",
    "mare": "sea ocean",
    "foresta": "forest",
    "cibo": "food",
    "moneta": "coin",
    "tesoro": "treasure",
    "cranio": "skull",
    "scheletro": "skeleton",
    "robot": "robot",
    "nave": "ship",
    "cavallo": "horse",
    "lupo": "wolf",
    "orso": "bear",
    "serpente": "snake",
    "ragno": "spider",
    "leone": "lion",
    "aquila": "eagle",
    "pesce": "fish",
    "fiore": "flower",
    "chiave": "key",
    "porta": "door gate",
    "libro": "book",
    "pozione": "potion",
    "bomba": "bomb",
    "esplosione": "explosion",
    "veloce": "speed sprint",
    "forza": "strength",
    "corsa": "run sprint",
    "salto": "jump",
    "volo": "fly wing",
    "invisibile": "invisible",
    "fantasma": "ghost",
    "demone": "demon",
    "angelo": "angel",
    "dio": "god",
    "cristallo": "crystal gem",
    "diamante": "diamond",
    "oro": "gold",
    "argento": "silver",
    "ferro": "iron",
    "ossa": "bones",
    "sangue": "blood",
    "ferita": "wound",
    "cura": "heal cure",
    "trappola": "trap",
    "timore": "fear",
    "coraggio": "courage",
    "saggio": "wise",
    "bambola": "doll",
    "giocattolo": "toy",
    "dado": "dice",
    "carta": "card",
    "torre": "tower",
    "dungeon": "dungeon",
    "goblin": "goblin",
    "elfo": "elf",
    "nano": "dwarf",
    "umano": "human",
    "arma": "weapon",
    "ascia": "axe",
    "martello": "hammer",
    "lancia": "spear lance",
    "bastone": "staff",
    "veleno di": "venom of",
    "pianta": "plant",
    "fungo": "mushroom",
    "veleno verde": "green poison",
    "nebbia": "fog mist",
    "tempesta": "storm thunder",
    "ghiaccio": "ice frost",
    "terra": "earth",
    "vento": "wind",
    "energia": "energy power",
    "mente": "mind brain",
    "occhio": "eye",
    "mano": "hand",
    "piede": "foot",
    "testa": "head face",
    "drago alato": "wyvern dragon wings",
    "mappa": "map",
    "bussola": "compass",
    "labirinto": "maze",
    "portale": "portal",
    "freccia su": "arrow up",
    "freccia giù": "arrow down",
    "scrigno": "chest treasure",
    "sacco": "bag sack",
    "zaino": "backpack",
    "coltello": "knife dagger",
    "pistola": "gun pistol",
}


# ── GitHub Tree Cache Management ───────────────────────────────────────────────

def _load_cache() -> list[str] | None:
    """Load the local cache if valid and not expired."""
    if not CACHE_FILE.exists():
        return None
    try:
        stat = CACHE_FILE.stat()
        if time.time() - stat.st_mtime > CACHE_TTL_SECONDS:
            return None
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _save_cache(paths: list[str]) -> None:
    """Save the path list to the local cache."""
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(paths, f)
    except Exception:
        pass


def get_all_icon_paths() -> list[str]:
    """
    Returns all SVG paths from the game-icons repo.
    Format: "author/icon-name"
    Uses local cache to avoid repeated API calls.
    """
    cached = _load_cache()
    if cached is not None:
        print(f"  [cache] {len(cached)} icons loaded from local cache.")
        return cached

    print("  [github] Downloading icon list from GitHub API (first run only)...")
    req = urllib.request.Request(
        GITHUB_API_TREE,
        headers={"User-Agent": "game-icons-search-agent/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [error] GitHub API: {e}")
        return []

    paths = []
    for item in data.get("tree", []):
        path = item.get("path", "")
        if item.get("type") == "blob" and path.endswith(".svg") and path.count("/") == 1:
            # path = "author/icon-name.svg" → "author/icon-name"
            parts = path.rsplit(".svg", 1)[0]  # "author/icon-name"
            paths.append(parts)

    print(f"  [github] {len(paths)} icons found.")
    _save_cache(paths)
    return paths


# ── Icon Search ────────────────────────────────────────────────────────────────

def _translate_keyword(keyword: str) -> list[str]:
    """
    Expands an Italian keyword into English search terms.
    Returns a list of words to search for.
    """
    keywords = []
    lower = keyword.lower().strip()

    # Add the original keyword
    keywords.append(lower)

    # Try direct translation
    if lower in ITALIAN_TO_ENGLISH:
        for word in ITALIAN_TO_ENGLISH[lower].split():
            keywords.append(word)

    # Search for partial words in multi-word keywords
    for it, en in ITALIAN_TO_ENGLISH.items():
        if it in lower:
            for word in en.split():
                keywords.append(word)

    return list(dict.fromkeys(keywords))  # deduplicate preserving order


def _icon_score(icon_slug: str, search_terms: list[str]) -> float:
    """
    Calculates a relevance score for an icon against the search terms.
    icon_slug: "author/icon-name" (e.g. "delapouite/baby-face")
    """
    name = icon_slug.split("/")[-1]       # "baby-face"
    name_parts = set(name.split("-"))      # {"baby", "face"}

    score = 0.0
    for term in search_terms:
        term_lower = term.lower()
        # Exact match in name
        if term_lower in name:
            score += 10.0
        # Exact word match
        if term_lower in name_parts:
            score += 8.0
        # Fuzzy match
        ratio = difflib.SequenceMatcher(None, term_lower, name).ratio()
        score += ratio * 5.0
        # Bonus if term starts the name
        if name.startswith(term_lower):
            score += 5.0

    return score


def search_icons(keyword: str, max_results: int = 5) -> list[dict]:
    """
    Searches for the most relevant icons for the keyword.
    Returns a list of dicts: {"slug": "author/name", "score": float}
    """
    all_paths = get_all_icon_paths()
    if not all_paths:
        return []

    search_terms = _translate_keyword(keyword)
    print(f"  [search] Search terms: {search_terms}")

    scored = []
    for path in all_paths:
        s = _icon_score(path, search_terms)
        if s > 0:
            scored.append((s, path))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, slug in scored[:max_results]:
        author, icon_name = slug.split("/", 1)
        results.append({
            "slug": slug,
            "author": author,
            "name": icon_name,
            "score": round(score, 2),
        })
    return results


# ── SVG Processing ─────────────────────────────────────────────────────────────

def _download_svg(author: str, icon_name: str) -> str | None:
    """Downloads the raw SVG file from GitHub."""
    url = f"{GITHUB_RAW_BASE}/{author}/{icon_name}.svg"
    # Fallback: some authors have subfolders (e.g. delapouite)
    # The direct raw URL works because the repo is flat (author/icon.svg)
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": "game-icons-search-agent/1.0"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8")
    except Exception as e:
        print(f"  [error] Download SVG {url}: {e}")
        return None


def _transform_svg(svg_text: str) -> str:
    """
    Applies the required transformations to the SVG:
      1. background=none    → removes the background path
      2. foreground-shrink x4 → scales to SHRINK_FACTOR centered on the canvas
      3. foreground-Position=-20px → Y translation by POSITION_Y_OFFSET
    """
    # Register SVG namespace to avoid ns0: prefixes
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError:
        # Attempt inline namespace cleanup
        clean = re.sub(r'\s+xmlns[^"]*"[^"]*"', "", svg_text, count=1)
        root = ET.fromstring(clean)

    ns = "http://www.w3.org/2000/svg"

    # ── 1. Remove background (first <path> with black fill or id="bg") ─────────
    to_remove = []
    for child in root:
        tag = child.tag.replace(f"{{{ns}}}", "")
        fill = child.get("fill", "").lower()
        elem_id = child.get("id", "").lower()
        d = child.get("d", "")
        # Identify background path: path covering the entire canvas
        if tag == "path" and (
            elem_id == "bg"
            or (fill in ("#000", "#000000", "black") and "h512" in d and "v512" in d)
            or d.strip().lower().startswith("m0 0h512v512")
        ):
            to_remove.append(child)

    for child in to_remove:
        root.remove(child)

    # ── 2. & 3. Apply shrink and position to the foreground <g> group ──────────
    # Calculate the new transform:
    #   - center on (SVG_CENTER, SVG_CENTER)
    #   - apply scale
    #   - un-center + vertical offset
    dx = SVG_CENTER * (1 - SHRINK_FACTOR)
    dy = SVG_CENTER * (1 - SHRINK_FACTOR) + POSITION_Y_OFFSET
    new_transform = (
        f"translate({dx:.2f},{dy:.2f}) scale({SHRINK_FACTOR:.4f})"
    )

    # Find existing foreground group or create a new one
    fg_group = None
    for child in root:
        tag = child.tag.replace(f"{{{ns}}}", "")
        if tag == "g":
            fg_group = child
            break

    if fg_group is not None:
        fg_group.set("transform", new_transform)
    else:
        # Wrap all content in a <g>
        wrapper = ET.Element("g", {"transform": new_transform})
        children = list(root)
        for child in children:
            root.remove(child)
            wrapper.append(child)
        root.append(wrapper)

    return ET.tostring(root, encoding="unicode", xml_declaration=False)


def _svg_to_data_uri(svg_text: str) -> str:
    """Converts SVG to a Base64 data URI."""
    b64 = base64.b64encode(svg_text.encode("utf-8")).decode("utf-8")
    return f"data:image/svg+xml;base64,{b64}"


# ── Main Agent Class ────────────────────────────────────────────────────────────

def search_and_build_json(
    keyword: str,
    max_results: int = 5,
) -> list[dict]:
    """
    Searches icons by keyword and returns a list of JSON objects with:
      - keyword: searched word
      - name: icon name
      - author: author
      - imageUrl: transformed SVG data URI
      - linkCopyright: URL of the icon page on game-icons.net
      - score: relevance score (debug)
    """
    print(f"\n[SEARCH] Keyword: '{keyword}'")
    candidates = search_icons(keyword, max_results=max_results)

    if not candidates:
        print(f"  [!] No icons found for '{keyword}'")
        return []

    results = []
    for c in candidates:
        author = c["author"]
        name = c["name"]
        print(f"  [download] {author}/{name} (score={c['score']})")

        svg_raw = _download_svg(author, name)
        if not svg_raw:
            continue

        svg_transformed = _transform_svg(svg_raw)
        image_url = _svg_to_data_uri(svg_transformed)
        link_copyright = f"{GAME_ICONS_BASE}/{author}/{name}.html"

        results.append({
            "keyword": keyword,
            "name": name,
            "author": author,
            "imageUrl": image_url,
            "linkCopyright": link_copyright,
            "score": c["score"],
        })

    return results


# ── HTML output ───────────────────────────────────────────────────────────────

def build_html(results: list[dict], keyword: str) -> str:
    """Generates an HTML page with a table: image on the left, URL on the right."""
    rows = ""
    for idx, r in enumerate(results):
        rows += f"""
        <tr>
          <td class="img-cell">
            <img src="{r['imageUrl']}" alt="{r['name']}" />
            <div class="icon-name">{r['name']}</div>
          </td>
          <td class="url-cell">
            <div class="row-block">
              <span class="url-text" id="url-{idx}">{r['linkCopyright']}</span>
              <button class="btn btn-url" onclick="copyText('url-{idx}', this)" title="Copy URL">📋 Copy URL</button>
            </div>
            <div class="row-block" style="margin-top:10px;">
              <span class="img-data-label">data:image/svg+xml;base64,<em>…</em></span>
              <button class="btn btn-img" onclick="copyImageData({idx}, this)" title="Copy imageUrl">🖼️ Copy imageUrl</button>
            </div>
            <div class="meta">author: {r['author']} &nbsp;|&nbsp; score: {r['score']}</div>
            <textarea id="imgdata-{idx}" class="hidden-data" readonly>{r['imageUrl']}</textarea>
          </td>
        </tr>"""

    count = len(results)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Icons – "{keyword}" – Search</title>
  <style>
    *, *::before, *::after {{ box-sizing: border-box; }}
    body {{
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      margin: 0;
      padding: 24px;
    }}
    h1 {{
      color: #a8d8ea;
      margin-bottom: 4px;
      font-size: 1.6rem;
    }}
    .subtitle {{
      color: #888;
      margin-bottom: 24px;
      font-size: 0.9rem;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
    }}
    tr {{
      border-bottom: 1px solid #2e2e4e;
      transition: background 0.15s;
    }}
    tr:hover {{
      background: #22223b;
    }}
    td {{
      padding: 12px 16px;
      vertical-align: middle;
    }}
    .img-cell {{
      width: 120px;
      text-align: center;
      background: #0d0d1a;
    }}
    .img-cell img {{
      width: 80px;
      height: 80px;
      display: block;
      margin: 0 auto 6px;
      background: transparent;
    }}
    .icon-name {{
      font-size: 0.72rem;
      color: #aaa;
      word-break: break-all;
    }}
    .url-cell {{
      padding-left: 24px;
    }}
    .row-block {{
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }}
    .url-text {{
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      color: #c9d6df;
      word-break: break-all;
    }}
    .img-data-label {{
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: #7a8ca0;
    }}
    .btn {{
      flex-shrink: 0;
      padding: 4px 12px;
      border: none;
      border-radius: 5px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }}
    .btn:active {{ transform: scale(0.95); }}
    .btn-url {{
      background: #2d6a8a;
      color: #e0f0ff;
    }}
    .btn-url:hover {{ background: #3a85b0; }}
    .btn-url.copied {{ background: #2a7a50; }}
    .btn-img {{
      background: #5a3d7a;
      color: #f0e0ff;
    }}
    .btn-img:hover {{ background: #7a50a8; }}
    .btn-img.copied {{ background: #2a7a50; }}
    .meta {{
      margin-top: 8px;
      font-size: 0.78rem;
      color: #666;
    }}
    .hidden-data {{
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0;
    }}
  </style>
</head>
<body>
  <h1>🎮 Game Icons — search: "{keyword}"</h1>
  <div class="subtitle">{count} results found &nbsp;|&nbsp; source: game-icons.net (CC BY 3.0)</div>
  <table>
    <tbody>
      {rows}
    </tbody>
  </table>
  <script>
    function copyText(elementId, btn) {{
      const text = document.getElementById(elementId).textContent;
      navigator.clipboard.writeText(text).then(() => {{
        const orig = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {{ btn.textContent = orig; btn.classList.remove('copied'); }}, 1800);
      }}).catch(() => {{
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }});
    }}
    function copyImageData(idx, btn) {{
      const text = document.getElementById('imgdata-' + idx).value;
      navigator.clipboard.writeText(text).then(() => {{
        const orig = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {{ btn.textContent = orig; btn.classList.remove('copied'); }}, 1800);
      }}).catch(() => {{
        const ta = document.getElementById('imgdata-' + idx);
        ta.style.cssText = 'position:static;width:100%;height:30px;opacity:1;';
        ta.select();
        document.execCommand('copy');
        ta.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;';
      }});
    }}
  </script>
</body>
</html>"""
    return html


# ── Interactive CLI ────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  game-icons.net Search Agent")
    print("=" * 60)

    # Interactive input
    keyword = input("\nEnter keywords (Italian or English): ").strip()
    if not keyword:
        print("[!] No keyword entered. Exiting.")
        sys.exit(1)

    max_str = input(f"Maximum number of results [default=100]: ").strip()
    try:
        max_results = int(max_str) if max_str else 100
    except ValueError:
        print("[!] Invalid value, using 100.")
        max_results = 100

    # Compute output file names
    safe_keyword = re.sub(r"[^\w\-]", "_", keyword.lower())
    json_path = Path(__file__).parent / f"output_{safe_keyword}.json"
    html_path = Path(__file__).parent / f"output_{safe_keyword}.html"

    # Search and build
    results = search_and_build_json(keyword, max_results=max_results)

    if not results:
        print(f"\n[!] No results for '{keyword}'.")
        sys.exit(0)

    # Save JSON
    json_out = json.dumps(results, indent=2, ensure_ascii=False)
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(json_out)
    print(f"\n[OK] JSON saved to:  {json_path}")

    # Save HTML
    html_out = build_html(results, keyword)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_out)
    print(f"[OK] HTML saved to:  {html_path}")
    print(f"\nOpen the HTML file in a browser to view the results.")


if __name__ == "__main__":
    main()
