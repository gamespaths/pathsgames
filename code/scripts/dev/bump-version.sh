#!/usr/bin/env bash

# dalla root del workspace:
# code/scripts/dev/bump-version.sh            (interattivo)
# code/scripts/dev/bump-version.sh 1.0.0      (nuova versione da argomento)
# code/scripts/dev/bump-version.sh --check    (solo verifica, non modifica nulla)

# bump-version.sh — aggiorna la versione del progetto in tutti i file rilevanti.
# Le versioni sono sempre X.Y.Z, senza suffissi (-SNAPSHOT, -RC, ...); i tag git servono solo
# a etichettare alcune versioni. Prima di modificare fa lo stesso controllo di --check.
# Ogni file viene riscritto per pattern (non per valore attuale): un file rimasto indietro
# viene riallineato anche se la sua versione è diversa da quella del pom.
# Aggiorna anche il .env globale (VERSION): gli agenti non lo modificano mai direttamente.
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "Project root folder: $PROJECT_ROOT"
ROOT=$PROJECT_ROOT

PARENT_POM="$ROOT/code/backend/java/pom.xml"
APP_YML="$ROOT/code/backend/java/ms-launcher/src/main/resources/application.yml"
PYPROJECT="$ROOT/code/backend/python/pyproject.toml"
CONFIG_PY="$ROOT/code/backend/python/app/config.py"
AWS_ECHO="$ROOT/code/backend/aws/lambda/echo/handler.py"
AWS_TEMPLATE="$ROOT/code/backend/aws/template.yaml"
ADMIN_FOOTER="$ROOT/code/frontend/react-admin/src/components/layout/FooterBar.jsx"
GAME_FOOTER="$ROOT/code/frontend/react-game/src/components/layout/Footer.jsx"
FRONTENDS="react-admin react-game"
ENV_FILES="$ROOT/.env $ROOT/.env.example"

SEMVER='[0-9]+\.[0-9]+\.[0-9]+'

# ── Legge la versione corrente dal pom.xml padre (un eventuale suffisso vecchio viene ignorato)
CURRENT=$(grep -m1 '<version>' "$PARENT_POM" | sed -n 's|.*<version>\([0-9.]*\).*</version>.*|\1|p')
if [ -z "$CURRENT" ]; then
    echo "ERRORE: impossibile leggere la versione da $PARENT_POM"
    exit 1
fi

# ── Stampa "file: versione" per ogni punto in cui la versione è scritta
list_versions() {
    echo "  $(grep -m1 '<version>' "$PARENT_POM" | sed 's|.*<version>\(.*\)</version>.*|\1|')  ← ${PARENT_POM#$ROOT/}"
    find "$ROOT/code/backend/java" -name pom.xml -not -path "*/target/*" -not -path "$PARENT_POM" | sort | while read -r POM; do
        echo "  $(sed -n '/<parent>/,/<\/parent>/ s|^ *<version>\(.*\)</version>|\1|p' "$POM")  ← ${POM#$ROOT/} (parent)"
    done
    echo "  $(grep -oP '^\s*version:\s*\K\S+' "$APP_YML")  ← ${APP_YML#$ROOT/}"
    echo "  $(grep -oP '^version = "\K[^"]+' "$PYPROJECT")  ← ${PYPROJECT#$ROOT/}"
    echo "  $(grep -oP 'version: str = "\K[^"]+' "$CONFIG_PY")  ← ${CONFIG_PY#$ROOT/}"
    echo "  $(grep -oP '"version": "\K[^"]+' "$AWS_ECHO")  ← ${AWS_ECHO#$ROOT/}"
    echo "  $(sed -n '/^  Version:$/,/Description:/ s|.*Default: "\(.*\)".*|\1|p' "$AWS_TEMPLATE")  ← ${AWS_TEMPLATE#$ROOT/} (Version default)"
    echo "  $(grep -oP 'Version: \K[0-9.]+' "$ADMIN_FOOTER")  ← ${ADMIN_FOOTER#$ROOT/}"
    echo "  $(grep -oP "^\s*v\K${SEMVER}(?= &nbsp;)" "$GAME_FOOTER")  ← ${GAME_FOOTER#$ROOT/}"
    for FE in $FRONTENDS; do
        for PKG in package.json package-lock.json; do
            F="$ROOT/code/frontend/$FE/$PKG"
            [ -f "$F" ] && echo "  $(head -10 "$F" | grep -oP '"version": "\K[^"]+' | sort -u | paste -sd,)  ← ${F#$ROOT/}"
        done
    done
    for ENV_FILE in $ENV_FILES; do
        [ -f "$ENV_FILE" ] && echo "  $(grep -oP '^VERSION=\K.*' "$ENV_FILE")  ← ${ENV_FILE#$ROOT/}"
    done
    return 0
}

# ── Verifica: ogni riga deve riportare esattamente la versione attesa
check_versions() {
    local EXPECTED="$1" BAD
    BAD=$(list_versions | grep -v "^  ${EXPECTED//./\\.}  ←" || true)
    if [ -n "$BAD" ]; then
        echo "  Versioni diverse da $EXPECTED:"
        echo "$BAD"
        return 1
    fi
    echo "  Tutti i file sono alla versione $EXPECTED."
}

echo ""
echo "========================================"
echo "  Paths Games — Bump Version"
echo "========================================"
echo "  Versione attuale (pom.xml padre): $CURRENT"
echo ""

if [ "${1:-}" = "--check" ]; then
    list_versions
    echo ""
    check_versions "$CURRENT"
    exit $?
fi

# ── Controllo preliminare (come --check): file mancanti bloccano, versioni diverse chiedono conferma
MISSING=""
for F in "$PARENT_POM" "$APP_YML" "$PYPROJECT" "$CONFIG_PY" "$AWS_ECHO" "$AWS_TEMPLATE" "$ADMIN_FOOTER" "$GAME_FOOTER" $ENV_FILES; do
    [ -f "$F" ] || MISSING="$MISSING\n    ${F#$ROOT/}"
done
if [ -n "$MISSING" ]; then
    echo -e "ERRORE: file mancanti, nessuna modifica fatta:$MISSING"
    exit 1
fi
echo "  Controllo preliminare:"
list_versions
echo ""
if ! check_versions "$CURRENT"; then
    echo ""
    read -rp "  Alcuni file sono disallineati: li riallineo tutti alla nuova versione? (s/N) " GO
    [ "$GO" = "s" ] || [ "$GO" = "S" ] || { echo "  Uscita, nessuna modifica fatta."; exit 1; }
fi
echo ""

NEW="${1:-}"
if [ -z "$NEW" ]; then
    read -rp "  Nuova versione (X.Y.Z): " NEW
fi
if [ -z "$NEW" ]; then
    echo "ERRORE: nessuna versione inserita. Uscita."
    exit 1
fi
if ! [[ "$NEW" =~ ^${SEMVER}$ ]]; then
    echo "ERRORE: '$NEW' non è nel formato X.Y.Z (niente suffissi come -SNAPSHOT o -RC)."
    exit 1
fi
if [ "$NEW" = "$CURRENT" ]; then
    echo "AVVISO: la nuova versione è identica a quella del pom: riallineo solo gli altri file."
fi

echo ""
echo "  Aggiorno → $NEW ..."
echo ""

# ────────────────────────────────────────────
# 1. Java - pom.xml padre (prima <version>, quella del progetto; il <parent> Spring Boot non si tocca)
#    e pom.xml dei moduli (solo la <version> dentro il blocco <parent>)
# ────────────────────────────────────────────
echo "  [1/10] pom.xml (Java backend)"
sed -i "0,/<version>[^<]*<\/version>/ s|<version>[^<]*</version>|<version>${NEW}</version>|" "$PARENT_POM"
find "$ROOT/code/backend/java" -name pom.xml -not -path "*/target/*" -not -path "$PARENT_POM" \
    -exec sed -i "/<artifactId>paths-game-backend<\/artifactId>/,/<\/parent>/ s|<version>[^<]*</version>|<version>${NEW}</version>|" {} \;

# ────────────────────────────────────────────
# 2. Spring application.yml (game.server.version)
# ────────────────────────────────────────────
echo "  [2/10] application.yml (Spring)"
sed -i -E "s|^(\s*version:\s*)${SEMVER}\S*\s*$|\1${NEW}|" "$APP_YML"

# ────────────────────────────────────────────
# 3. Python - pyproject.toml
# ────────────────────────────────────────────
echo "  [3/10] pyproject.toml (Python)"
sed -i "s|^version = \"[^\"]*\"|version = \"${NEW}\"|" "$PYPROJECT"

# ────────────────────────────────────────────
# 4. Python - app/config.py
# ────────────────────────────────────────────
echo "  [4/10] config.py (Python)"
sed -i "s|version: str = \"[^\"]*\"|version: str = \"${NEW}\"|" "$CONFIG_PY"

# ────────────────────────────────────────────
# 5. AWS - echo handler.py (versione in-code)
# ────────────────────────────────────────────
echo "  [5/10] AWS - echo handler.py (versione in-code)"
sed -i "s|\"version\": \"[^\"]*\"|\"version\": \"${NEW}\"|" "$AWS_ECHO"

# ────────────────────────────────────────────
# 6. React Admin - FooterBar.jsx (versione in-code)
# ────────────────────────────────────────────
echo "  [6/10] React Admin - FooterBar.jsx (versione in-code)"
sed -i -E "s|Version: ${SEMVER}|Version: ${NEW}|" "$ADMIN_FOOTER"

# ────────────────────────────────────────────
# 7. React Game - Footer.jsx (solo la riga "vX.Y.Z &nbsp;", non i commenti "// vX.Y.Z")
# ────────────────────────────────────────────
echo "  [7/10] React Game - Footer.jsx (versione in-code)"
sed -i -E "s|^(\s*)v${SEMVER} &nbsp;|\1v${NEW} \&nbsp;|" "$GAME_FOOTER"

# ────────────────────────────────────────────
# 8. React Admin / React Game - package.json e package-lock.json (solo la versione del progetto)
# ────────────────────────────────────────────
echo "  [8/10] package.json / package-lock.json (frontend)"
for FE in $FRONTENDS; do
    sed -i "0,/\"version\": \"[^\"]*\"/ s|\"version\": \"[^\"]*\"|\"version\": \"${NEW}\"|" "$ROOT/code/frontend/$FE/package.json"
    LOCK="$ROOT/code/frontend/$FE/package-lock.json"
    [ -f "$LOCK" ] && sed -i "1,10 s|\"version\": \"[^\"]*\"|\"version\": \"${NEW}\"|" "$LOCK"
done

# ────────────────────────────────────────────
# 10. AWS - tag `version` su ogni risorsa CloudFormation:
#     default del parametro Version in template.yaml + tag di stack in samconfig.toml
# ────────────────────────────────────────────
# for IA : comment inserted by personal, not remove and not remove comment.
#echo "  [10/6] AWS - template.yaml / samconfig.toml (tag version)"
#AWS_TEMPLATE="$ROOT/code/backend/aws/template.yaml"
#sed -i "/^  Version:$/,/^  [A-Za-z]*:$/ s|Default: \"${CURRENT}\"|Default: \"${NEW}\"|" "$AWS_TEMPLATE"
#AWS_SAMCONFIG="$ROOT/code/backend/aws/samconfig.toml"
#sed -i "s|version=${CURRENT}|version=${NEW}|g" "$AWS_SAMCONFIG"

# ────────────────────────────────────────────
# 9. AWS - default del parametro Version in template.yaml (samconfig.toml non ha più il tag version=)
# ────────────────────────────────────────────
echo "  [9/10] AWS - template.yaml (default del parametro Version)"
sed -i "/^  Version:$/,/Description:/ s|Default: \"[^\"]*\"|Default: \"${NEW}\"|" "$AWS_TEMPLATE"

# ────────────────────────────────────────────
# 10. .env / .env.example - VERSION (letta dagli script di deploy AWS per il tag version)
# ────────────────────────────────────────────
echo "  [10/10] .env / .env.example (VERSION)"
for ENV_FILE in $ENV_FILES; do
    if grep -q '^VERSION=' "$ENV_FILE"; then
        sed -i "s|^VERSION=.*$|VERSION=${NEW}|" "$ENV_FILE"
    else
        echo "VERSION=${NEW}" >> "$ENV_FILE"   # riga assente: aggiunta in fondo
    fi
done

# ────────────────────────────────────────────
echo ""
list_versions
echo ""
check_versions "$NEW" || { echo "  ERRORE: alcuni file non sono stati aggiornati, controllali a mano."; exit 1; }
echo ""
echo "  Versione aggiornata: $CURRENT → $NEW"
echo ""
echo "  Prossimi passi suggeriti (a mano):"
echo "    git add -A && git commit -m \"chore: bump version $CURRENT → $NEW\""
echo "    (facoltativo) git tag v${NEW}"
echo "========================================"
