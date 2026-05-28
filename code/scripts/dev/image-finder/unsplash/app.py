#!/usr/bin/env python3
"""
Unsplash Search Web App — Flask

Start:
  pip install flask
  python3 app.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, render_template_string, jsonify
import unsplash_agent

app = Flask(__name__)

# ── Template ──────────────────────────────────────────────────────────────────

PAGE = """<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsplash Search</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #111;
      color: #e0e0e0;
      margin: 0;
      min-height: 100vh;
    }

    /* ── Header ── */
    header {
      background: #000;
      padding: 18px 32px;
      border-bottom: 1px solid #222;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    header h1 {
      color: #fff;
      font-size: 1.4rem;
      margin: 0;
      flex: 1;
      min-width: 160px;
    }
    .search-bar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .search-bar input[type="text"] {
      padding: 9px 16px;
      border-radius: 8px;
      border: 1px solid #333;
      background: #1a1a1a;
      color: #fff;
      font-size: 1rem;
      width: 300px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-bar input[type="text"]:focus { border-color: #aaa; }
    .search-bar input[type="number"] {
      padding: 9px 10px;
      border-radius: 8px;
      border: 1px solid #333;
      background: #1a1a1a;
      color: #fff;
      font-size: 1rem;
      width: 72px;
      outline: none;
    }
    .search-bar label { font-size: 0.85rem; color: #888; white-space: nowrap; }
    .search-bar button {
      padding: 9px 22px;
      border-radius: 8px;
      border: none;
      background: #fff;
      color: #000;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .search-bar button:hover { background: #ddd; }
    .search-bar button:disabled { background: #555; color: #999; cursor: not-allowed; }

    /* ── Status ── */
    main { padding: 28px 32px; }
    .status {
      font-size: 0.9rem;
      color: #777;
      margin-bottom: 20px;
      min-height: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status.loading { color: #aaa; }
    .status.error   { color: #e07070; }
    .spinner {
      display: none;
      width: 16px; height: 16px;
      border: 2px solid #444;
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; }
    tr {
      border-bottom: 1px solid #1e1e1e;
      transition: background 0.15s;
    }
    tr:hover { background: #1a1a1a; }
    td { padding: 14px 16px; vertical-align: middle; }

    /* Cella immagine */
    .img-cell {
      width: 200px;
      min-width: 160px;
      background: #0a0a0a;
      text-align: center;
    }
    .img-cell img {
      width: 180px;
      height: 120px;
      object-fit: cover;
      border-radius: 6px;
      display: block;
      margin: 0 auto 6px;
    }
    .img-dims {
      font-size: 0.7rem;
      color: #555;
    }

    /* Cella info */
    .info-cell { padding-left: 24px; }

    .info-block {
      margin-bottom: 12px;
    }
    .info-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #555;
      margin-bottom: 4px;
    }
    .row-flex {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      flex-wrap: wrap;
    }
    .mono {
      font-family: 'Courier New', monospace;
      font-size: 0.82rem;
      color: #b0c4d8;
      word-break: break-all;
      flex: 1;
    }
    .plain {
      font-size: 0.88rem;
      color: #ddd;
      flex: 1;
      word-break: break-all;
    }
    .license-text {
      font-size: 0.88rem;
      color: #90ee90;
      flex: 1;
    }

    /* Bottoni copia */
    .btn {
      flex-shrink: 0;
      padding: 3px 11px;
      border: 1px solid #333;
      border-radius: 5px;
      font-size: 0.75rem;
      cursor: pointer;
      background: #1e1e1e;
      color: #bbb;
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .btn:hover { background: #2a2a2a; color: #fff; border-color: #555; }
    .btn.copied { background: #1a3a2a; color: #6fcfa0; border-color: #3a7a5a; }

    .alt-desc {
      font-size: 0.78rem;
      color: #555;
      margin-top: 8px;
      font-style: italic;
    }

    #results { min-height: 40px; }
  </style>
</head>
<body>

<header>
  <h1>📷 Unsplash Search</h1>
  <form class="search-bar" id="searchForm" onsubmit="doSearch(event)">
    <input type="text" id="kwInput" placeholder="e.g., mountain, abstract, city…"
           autocomplete="off" />
    <label>max</label>
    <input type="number" id="maxInput" value="20" min="1" max="300" />
    <button type="submit" id="searchBtn">🔍 Search</button>
  </form>
</header>

<main>
  <div class="status" id="status">
    <span class="spinner" id="spinner"></span>
    <span id="statusText">Enter a keyword and press Search.</span>
  </div>
  <div id="results"></div>
</main>

<script>
  async function doSearch(e) {
    e.preventDefault();
    const q   = document.getElementById('kwInput').value.trim();
    const max = document.getElementById('maxInput').value || 20;
    if (!q) return;

    const btn     = document.getElementById('searchBtn');
    const spinner = document.getElementById('spinner');
    const statusT = document.getElementById('statusText');

    btn.disabled = true;
    spinner.style.display = 'block';
    statusT.textContent   = `Searching for "${q}"…`;
    document.getElementById('status').className = 'status loading';
    document.getElementById('results').innerHTML = '';

    try {
      const resp = await fetch(`/search?q=${encodeURIComponent(q)}&max=${max}`);
      const data = await resp.json();
      if (data.error) {
        statusT.textContent = '❌ ' + data.error;
        document.getElementById('status').className = 'status error';
      } else {
        statusT.textContent = `${data.count} results for "${q}"`;
        document.getElementById('status').className = 'status';
        document.getElementById('results').innerHTML = data.html;
      }
    } catch (err) {
      statusT.textContent = '❌ Network error: ' + err.message;
      document.getElementById('status').className = 'status error';
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  }

  function copyById(id, btn) {
    const el = document.getElementById(id);
    const text = el ? el.textContent || el.value : '';
    navigator.clipboard.writeText(text.trim()).then(() => flash(btn));
  }
  function flash(btn) {
    const orig = btn.textContent;
    btn.textContent = '✅ copied';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  }
</script>

</body>
</html>"""


def _info_block(label: str, uid: str, value: str) -> str:
    """Genera un blocco label + valore mono + bottone copia."""
    escaped = value.replace("<", "&lt;").replace(">", "&gt;")
    return f"""
      <div class="info-block">
        <div class="info-label">{label}</div>
        <div class="row-flex">
          <span class="mono" id="{uid}">{escaped}</span>
          <button class="btn" onclick="copyById('{uid}', this)">📋 Copy</button>
        </div>
      </div>"""


def _build_results_html(results: list) -> str:
    if not results:
        return '<p style="color:#666;">No results found.</p>'

    rows = ""
    for idx, r in enumerate(results):
        base = f"r{idx}"
        alt  = r.get("altDescription", "") or ""
        dims = f"{r.get('width',0)} × {r.get('height',0)} px" if r.get("width") else ""
        license_block = f"""
      <div class="info-block">
        <div class="info-label">License</div>
        <div class="row-flex">
          <span class="license-text" id="{base}-lic">{r['license']} ({r['licenseUrl']})</span>
          <button class="btn" onclick="copyById('{base}-lic', this)">📋 Copy</button>
        </div>
      </div>"""
        author_block = f"""
      <div class="info-block">
        <div class="info-label">Author</div>
        <div class="row-flex">
          <span class="plain" id="{base}-author">{r['authorName']} — {r['authorUrl']}</span>
          <button class="btn" onclick="copyById('{base}-author', this)">📋 Copy</button>
        </div>
      </div>"""

        rows += f"""
      <tr>
        <td class="img-cell">
          <img src="{r['imageUrlSmall'] or r['imageUrl']}"
               alt="{alt}"
               loading="lazy" />
          <div class="img-dims">{dims}</div>
        </td>
        <td class="info-cell">
          {_info_block("Image URL (regular)", f"{base}-img", r['imageUrl'])}
          {_info_block("Unsplash page URL ", f"{base}-page", r['pageUrl'])}
          {author_block}
          {license_block}
          {"<div class='alt-desc'>" + alt + "</div>" if alt else ""}
        </td>
      </tr>"""

    return f"<table><tbody>{rows}</tbody></table>"


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template_string(PAGE)


@app.route("/search")
def search():
    q = request.args.get("q", "").strip()
    try:
        max_results = int(request.args.get("max", 20))
    except ValueError:
        max_results = 20

    if not q:
        return jsonify({"error": "Empty keyword."}), 400

    try:
        results = unsplash_agent.search_photos(q, max_results=max_results)
        html    = _build_results_html(results)
        return jsonify({"count": len(results), "html": html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  Unsplash Search Web App")
    print("  http://localhost:5242")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5242, debug=False)
