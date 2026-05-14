#!/usr/bin/env python3
"""
Game Icons Web App — Flask
Web interface to search icons on game-icons.net.
  Uses the logic from search_agent.py (imported directly).

Starting the app:
  pip install flask
  python3 app.py
  → http://localhost:5050
"""

import sys
import os

# Assicura che search_agent sia importabile dalla stessa cartella
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, render_template_string, jsonify
import search_agent

app = Flask(__name__)

# ── Template HTML ──────────────────────────────────────────────────────────────

PAGE = """<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Icons Search</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1a1a2e;
      color: #e0e0e0;
      margin: 0;
      min-height: 100vh;
    }
    header {
      background: #0d0d1a;
      padding: 20px 32px;
      border-bottom: 1px solid #2e2e4e;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    header h1 {
      color: #a8d8ea;
      font-size: 1.5rem;
      margin: 0;
      flex: 1;
    }
    .search-bar {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .search-bar input[type="text"] {
      padding: 9px 16px;
      border-radius: 8px;
      border: 1px solid #3a3a5e;
      background: #22223b;
      color: #e0e0e0;
      font-size: 1rem;
      width: 280px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-bar input[type="text"]:focus {
      border-color: #a8d8ea;
    }
    .search-bar input[type="number"] {
      padding: 9px 10px;
      border-radius: 8px;
      border: 1px solid #3a3a5e;
      background: #22223b;
      color: #e0e0e0;
      font-size: 1rem;
      width: 80px;
      outline: none;
    }
    .search-bar label {
      font-size: 0.85rem;
      color: #888;
      white-space: nowrap;
    }
    .search-bar button {
      padding: 9px 22px;
      border-radius: 8px;
      border: none;
      background: #2d6a8a;
      color: #e0f0ff;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .search-bar button:hover { background: #3a85b0; }
    .search-bar button:disabled {
      background: #555;
      cursor: not-allowed;
    }

    main { padding: 28px 32px; }

    .status {
      font-size: 0.9rem;
      color: #888;
      margin-bottom: 18px;
      min-height: 22px;
    }
    .status.loading { color: #a8d8ea; }
    .status.error   { color: #e07070; }

    /* Spinner */
    .spinner {
      display: none;
      width: 18px; height: 18px;
      border: 3px solid #3a3a5e;
      border-top-color: #a8d8ea;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Tabella risultati */
    table {
      width: 100%;
      border-collapse: collapse;
    }
    tr {
      border-bottom: 1px solid #2e2e4e;
      transition: background 0.15s;
    }
    tr:hover { background: #22223b; }
    td {
      padding: 12px 16px;
      vertical-align: middle;
    }
    .img-cell {
      width: 120px;
      text-align: center;
      background: #0d0d1a;
    }
    .img-cell img {
      width: 80px;
      height: 80px;
      display: block;
      margin: 0 auto 6px;
    }
    .icon-name {
      font-size: 0.72rem;
      color: #aaa;
      word-break: break-all;
    }
    .url-cell { padding-left: 24px; }
    .row-block {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .url-text {
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      color: #c9d6df;
      word-break: break-all;
    }
    .img-data-label {
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      color: #7a8ca0;
    }
    .btn {
      flex-shrink: 0;
      padding: 4px 12px;
      border: none;
      border-radius: 5px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn:active { transform: scale(0.95); }
    .btn-url  { background: #2d6a8a; color: #e0f0ff; }
    .btn-url:hover  { background: #3a85b0; }
    .btn-url.copied { background: #2a7a50; }
    .btn-img  { background: #5a3d7a; color: #f0e0ff; }
    .btn-img:hover  { background: #7a50a8; }
    .btn-img.copied { background: #2a7a50; }
    .meta {
      margin-top: 8px;
      font-size: 0.78rem;
      color: #666;
    }
    .hidden-data {
      position: absolute;
      left: -9999px;
      width: 1px; height: 1px;
      opacity: 0;
    }
    #results { min-height: 40px; }
  </style>
</head>
<body>

<header>
  <h1>🎮 Game Icons Search</h1>
  <form class="search-bar" id="searchForm" onsubmit="doSearch(event)">
    <input type="text" id="kwInput" name="q" placeholder="e.g., baby, sword, dragon…"
           value="{{ query }}" autocomplete="off" />
    <label>max</label>
    <input type="number" id="maxInput" name="max" value="{{ max_results }}" min="1" max="500" />
    <button type="submit" id="searchBtn">🔍 Search</button>
  </form>
</header>

<main>
  <div class="status" id="status">
    <span class="spinner" id="spinner"></span>
    <span id="statusText">{{ status_text }}</span>
  </div>
  <div id="results">{{ results_html | safe }}</div>
</main>

<script>
  async function doSearch(e) {
    e.preventDefault();
    const q   = document.getElementById('kwInput').value.trim();
    const max = document.getElementById('maxInput').value || 100;
    if (!q) return;

    // UI loading
    const btn     = document.getElementById('searchBtn');
    const spinner = document.getElementById('spinner');
    const statusT = document.getElementById('statusText');
    btn.disabled  = true;
    spinner.style.display = 'inline-block';
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

  function copyText(elementId, btn) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => flash(btn));
  }
  function copyImageData(dataId, btn) {
    const text = document.getElementById(dataId).value;
    navigator.clipboard.writeText(text).then(() => flash(btn));
  }
  function flash(btn) {
    const orig = btn.textContent;
    btn.textContent = '✅ copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  }
</script>

</body>
</html>"""


def _build_results_html(results: list) -> str:
    """Generates only the table markup (without <html> wrapper)."""
    if not results:
        return '<p style="color:#888;">No results found.</p>'

    rows = ""
    for idx, r in enumerate(results):
        uid = f"{id(results)}_{idx}"   # unique id for this result
        rows += f"""
        <tr>
          <td class="img-cell">
            <img src="{r['imageUrl']}" alt="{r['name']}" />
            <div class="icon-name">{r['name']}</div>
          </td>
          <td class="url-cell">
            <div class="row-block">
              <span class="url-text" id="url-{uid}">{r['linkCopyright']}</span>
              <button class="btn btn-url" onclick="copyText('url-{uid}', this)">📋 Copy URL</button>
            </div>
            <div class="row-block" style="margin-top:10px;">
              <span class="img-data-label">data:image/svg+xml;base64,<em>…</em></span>
              <button class="btn btn-img" onclick="copyImageData('img-{uid}', this)">🖼️ Copy imageUrl</button>
            </div>
            <div class="meta">author: {r['author']} &nbsp;|&nbsp; score: {r['score']}</div>
            <textarea id="img-{uid}" class="hidden-data" readonly>{r['imageUrl']}</textarea>
          </td>
        </tr>"""

    return f"<table><tbody>{rows}</tbody></table>"


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template_string(
        PAGE,
        query="",
        max_results=20,
        status_text="Enter a keyword and press Search.",
        results_html="",
    )


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
        results = search_agent.search_and_build_json(q, max_results=max_results)
        html = _build_results_html(results)
        return jsonify({"count": len(results), "html": html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  Game Icons Web App")
    print("  http://localhost:5242")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5242, debug=False)
