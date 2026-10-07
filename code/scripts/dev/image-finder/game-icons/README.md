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


# &lt; Paths Games /&gt;
All source code and informations in this repository are the result of careful and patient development work by developer team, who has made every effort to verify their correctness to the greatest extent possible. If part of the code or any content has been taken from external sources, the original provenance is always cited, in respect of transparency and intellectual property.

Some content and portions of code in this repository were also produced with the support of artificial intelligence tools, whose contribution helped enrich and accelerate the creation of the material. Every piece of information and code fragment has nevertheless been carefully checked and validated with the goal of ensuring the highest quality and reliability of the provided content.

For all details, in-depth information, or requests for clarification, please visit [Paths.Games](https://paths.games/) website



## License
Made with ❤️ by <a href="https://github.com/gamespaths/pathsgames">paths.games dev team</a>
&bull; 
Public projects 
<a href="https://www.gnu.org/licenses/gpl-3.0"  valign="middle"> <img src="https://img.shields.io/badge/License-GPL%20v3-blue?style=plastic" alt="GPL v3" valign="middle" /></a>
*Free Software!*


The software is distributed under the terms of the GNU General Public License v3.0. Use, modification, and redistribution are permitted, provided that any copy or derivative work is released under the same license. The content is provided "as is", without any warranty, express or implied.


Narrative Content & Assets: The story, dialogues, characters, sounds, musics, paint, all artist contents and world-building (located on /data folder) are NOT open source. They are licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0).


(ITA) Il software è distribuito secondo i termini della GNU General Public License v3.0. L'uso, la modifica e la ridistribuzione sono consentiti, a condizione che ogni copia o lavoro derivato sia rilasciato con la stessa licenza. Il contenuto è fornito "così com'è", senza alcuna garanzia, esplicita o implicita.
