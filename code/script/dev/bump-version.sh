#!/usr/bin/env bash

# dalla root del workspace:
# .alnao/bump-version.sh

# bump-version.sh — aggiorna la versione del progetto in tutti i file rilevanti.
# Eseguire dalla root del workspace oppure dalla cartella .alnao (il percorso viene calcolato automaticamente).
set -e

# ── Calcola la root del workspace (la cartella sopra .alnao)
#SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"

ROOT="$(dirname "$PROJECT_ROOT")"
ROOT=$PROJECT_ROOT          # <------------------ TODO Rivedere se serve o se è più chiaro usare PROJECT_ROOT direttamente, visto che è già la root del workspace
echo "Workspace root: $ROOT"

PARENT_POM="$PROJECT_ROOT/code/backend/java/pom.xml"

# ── Legge la versione corrente dal pom.xml padre (rimuove il suffisso -SNAPSHOT)
CURRENT=$(grep -m1 '<version>' "$PARENT_POM" | sed 's|.*<version>\(.*\)-SNAPSHOT</version>.*|\1|')

if [ -z "$CURRENT" ]; then
    echo "ERRORE: impossibile leggere la versione da $PARENT_POM"
    exit 1
fi

echo ""
echo "========================================"
echo "  Paths Games — Bump Version"
echo "========================================"
echo "  Versione attuale : $CURRENT"
echo ""
read -rp "  Nuova versione   : " NEW

if [ -z "$NEW" ]; then
    echo "ERRORE: nessuna versione inserita. Uscita."
    exit 1
fi

if [ "$NEW" = "$CURRENT" ]; then
    echo "AVVISO: la nuova versione è identica a quella attuale. Uscita."
    exit 0
fi

echo ""
echo "  Aggiorno $CURRENT → $NEW ..."
echo ""

# ────────────────────────────────────────────
# 1. Java - tutti i pom.xml sotto code/backend
#    Aggiorna sia <version>X-SNAPSHOT</version> del progetto
#    sia <version>X-SNAPSHOT</version> nei blocchi <parent>
# ────────────────────────────────────────────
echo "  [1/6] pom.xml (Java backend)"
find "$ROOT/code/backend/java" -name "pom.xml" -not -path "*/target/*" \
    -exec sed -i "s|<version>${CURRENT}-SNAPSHOT</version>|<version>${NEW}-SNAPSHOT</version>|g" {} \;

# ────────────────────────────────────────────
# 2. Spring application*.yml (solo src, non target)
# ────────────────────────────────────────────
echo "  [2/6] application*.yml (Spring)"
find "$ROOT/code/backend/java" -name "application*.yml" -not -path "*/target/*" \
    -exec sed -i "s|version: ${CURRENT}|version: ${NEW}|g" {} \;

# ────────────────────────────────────────────
# 3. Python - pyproject.toml 
# ────────────────────────────────────────────
echo "  [3/6] pyproject.toml (Python)"
PYPROJECT="$ROOT/code/backend/python/pyproject.toml"
sed -i "s|^version = \"${CURRENT}\"|version = \"${NEW}\"|" "$PYPROJECT"

# ────────────────────────────────────────────
# 4. Python - app/config.py
# ────────────────────────────────────────────
echo "  [4/6] config.py (Python)"
CONFIG_PY="$ROOT/code/backend/python/app/config.py"
sed -i "s|version: str = \"${CURRENT}\"|version: str = \"${NEW}\"|" "$CONFIG_PY"
# aggiorna i commenti >X.Y.Z se presenti
sed -i "s|# >${CURRENT}|# >${NEW}|g" "$CONFIG_PY"

# ────────────────────────────────────────────
# 5. PHP - EchoService.php (fallback in-code)
# ────────────────────────────────────────────
echo "  [5/6] EchoService.php (PHP fallback)"
ECHO_SVC="$ROOT/code/backend/php/src/Core/Service/EchoService.php"
sed -i "s|'${CURRENT}'|'${NEW}'|g" "$ECHO_SVC"

# ────────────────────────────────────────────
# 6. HTML - index.html (footer)
# ────────────────────────────────────────────
echo "  [6/6] index.html (website footer)"
HTML="$ROOT/code/website/html/index.html"
sed -i "s|<span>${CURRENT}</span>|<span>${NEW}</span>|g" "$HTML"


# ────────────────────────────────────────────
# 7. AWS - handler.py (versione in-code)
# ────────────────────────────────────────────
echo "  [7/6] AWS - handler.py (versione in-code)"
AWS_FILE="$ROOT/code/backend/aws/lambda/echo/handler.py"
sed -i "s|\"${CURRENT}\"|\"${NEW}\"|g" "$AWS_FILE"


# ────────────────────────────────────────────
# 8. React Admin - Navbar.jsx (versione in-code)
# ────────────────────────────────────────────
echo "  [8/6] React Admin - Navbar.jsx (versione in-code)"
NAVBAR_FILE="$ROOT/code/frontend/react-admin/src/components/layout/FooterBar.jsx"
sed -i "s|Version: ${CURRENT}|Version: ${NEW}|g" "$NAVBAR_FILE"


# ────────────────────────────────────────────
# 9. React Game - Footer.jsx (versione in-code)
# ────────────────────────────────────────────
echo "  [9/6] React Game - Footer.jsx (versione in-code)"
FOOTER_FILE="$ROOT/code/frontend/react-game/src/components/layout/Footer.jsx"
sed -i "s|Version: ${CURRENT}|Version: ${NEW}|g" "$FOOTER_FILE"

# ────────────────────────────────────────────
echo ""
echo "  Versione aggiornata: $CURRENT → $NEW"
echo ""
#echo ""
#echo "  Prossimi passi suggeriti:"
#echo "    git add -A && git commit -m \"chore: bump version $CURRENT → $NEW\""
#echo "    git tag v${NEW}"
echo "========================================"
