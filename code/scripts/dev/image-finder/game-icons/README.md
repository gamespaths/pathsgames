# game-icons Search Agent

Cerca icone su [game-icons.net](https://game-icons.net/) e produce JSON con `imageUrl` e `linkCopyright`.

## Uso

```bash
# Ricerca singola (italiano o inglese)
python3 search_agent.py bambino

# Più risultati
python3 search_agent.py spada --max 10

# Salva su file
python3 search_agent.py guerriero --max 5 --output icons.json

# Multi-parola
python3 search_agent.py "lupo mannaro"

python3 .alnao/game-icons/search_agent.py bambino --max 3
python3 .alnao/game-icons/search_agent.py vecchio --max 5 --output output.json

```

## Output JSON

```json
[
  {
    "keyword": "bambino",
    "name": "baby-face",
    "author": "delapouite",
    "imageUrl": "data:image/svg+xml;base64,PHN2Zy...",
    "linkCopyright": "https://game-icons.net/1x1/delapouite/baby-face.html",
    "score": 28.67
  }
]
```

## Trasformazioni SVG applicate

| Parametro | Valore |
|-----------|--------|
| background | none (rimosso) |
| foreground-shrink | 4x → scale(0.6561) centrato sul canvas |
| foreground-Position | -20px (traslazione Y) |

## Cache

Al primo avvio scarica la lista delle ~4200 icone da GitHub API e la salva in `.icons_tree_cache.json` (TTL 24h).

## Licenza icone

[CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) — Lorc, Delapouite & contributors
