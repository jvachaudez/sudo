#!/usr/bin/env bash
set -Eeuo pipefail

# Build à exécuter dans Git Bash sous Windows.
# Il produit dist/SUDO.zip puis installe SUDO dans C:\Program Files\SUDO.

BUILD_SCRIPT_VERSION="0.6.0"

PROJECT_NAME="SUDO"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_FILE="$SCRIPT_DIR/$(basename -- "${BASH_SOURCE[0]}")"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$SCRIPT_DIR/dist"
APP_DIR="$BUILD_DIR/$PROJECT_NAME"
DOWNLOAD_DIR="$BUILD_DIR/downloads"
EXTENSION_SOURCE="$SCRIPT_DIR/sudo-extension"
INSTALL_PARENT="/c/Program Files"
INSTALL_DIR="$INSTALL_PARENT/$PROJECT_NAME"

INSTALL_AFTER_BUILD=true
case "${1:-}" in
  "") ;;
  --no-install) INSTALL_AFTER_BUILD=false ;;
  *) printf 'Usage : %s [--no-install]\n' "$(basename -- "$0")" >&2; exit 2 ;;
esac

PYTHON_VERSION="${PYTHON_VERSION:-3.13.15}"
MERMAID_VERSION="${MERMAID_VERSION:-11.4.1}"
PYTHON_PACKAGES=(
  numpy matplotlib pandas ipykernel
  scipy sympy pint openpyxl pytest control seaborn scikit-learn
  tensorflow opencv-python segno
)
EXTENSIONS=(
  ms-python.python@2026.4.0
  ms-python.vscode-python-envs@1.36.0
  ms-python.debugpy
  ms-toolsai.jupyter
  yzhang.markdown-all-in-one
  bierner.markdown-mermaid
)

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32mOK\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mErreur :\033[0m %s\n' "$1" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || die "Commande requise absente : $1"; }

download() {
  local url="$1" output="$2"
  curl --fail --location --retry 3 --retry-delay 2 --output "$output" "$url"
}

safe_clean() {
  local target="$1"
  [[ -n "$target" && "$target" == "$SCRIPT_DIR"/* && "$target" != "$SCRIPT_DIR" ]] \
    || die "Refus de nettoyer un chemin non sûr : $target"
  rm -rf -- "$target"
}

safe_clean_install() {
  local target="$1"
  [[ "$target" == "/c/Program Files/SUDO" && "$target" == "$INSTALL_DIR" ]] \
    || die "Refus de supprimer un répertoire d'installation non autorisé : $target"
  rm -rf -- "$target"
}

log "Vérification de la machine de build"
printf 'Script de build SUDO : version %s\n' "$BUILD_SCRIPT_VERSION"
printf 'Script exécuté : %s\n' "$SCRIPT_FILE"
for tool in curl jq unzip 7z cygpath; do require "$tool"; done
CSC="$(cygpath -u "$WINDIR")/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
[[ -f "$CSC" ]] || die "Compilateur .NET Framework introuvable : $CSC"
[[ -f "$SCRIPT_DIR/sudo-launcher.cs" ]] || die "Source du lanceur portable introuvable."
for file in pet.exe LICENSE.txt ThirdPartyNotices.html; do
  [[ -f "$SCRIPT_DIR/assets/python-env-tools/$file" ]] || die "Composant PET absent : $file"
done
[[ -d "$EXTENSION_SOURCE" ]] || die "Dossier absent : $EXTENSION_SOURCE"
if [[ "$INSTALL_AFTER_BUILD" == true ]]; then
  require powershell.exe
  [[ -d "$INSTALL_PARENT" ]] || die "Répertoire Windows introuvable : C:\\Program Files"
  ADMIN_STATUS="$({
    powershell.exe -NoProfile -NonInteractive -Command \
      '$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
  } 2>/dev/null | tr -d '\r\n')"
  [[ "$ADMIN_STATUS" == "True" ]] \
    || die "Lancez Git Bash en tant qu'administrateur pour installer dans C:\\Program Files\\SUDO."
fi
ok "Prérequis disponibles"

log "Nettoyage des anciens builds"
safe_clean "$BUILD_DIR"
safe_clean "$DIST_DIR"
mkdir -p "$APP_DIR" "$DOWNLOAD_DIR" "$DIST_DIR"
ok "Build propre initialisé"

log "Téléchargement du moteur Mermaid $MERMAID_VERSION"
mkdir -p "$EXTENSION_SOURCE/media"
download \
  "https://cdn.jsdelivr.net/npm/mermaid@$MERMAID_VERSION/dist/mermaid.min.js" \
  "$EXTENSION_SOURCE/media/mermaid.min.js"
download \
  "https://cdn.jsdelivr.net/npm/mermaid@$MERMAID_VERSION/LICENSE" \
  "$EXTENSION_SOURCE/media/mermaid-LICENSE.txt"
ok "Mermaid sera intégré au VSIX pour une utilisation hors ligne"

log "Création de l'extension SUDO"
chmod +x "$EXTENSION_SOURCE/scripts/package-vsix.sh"
SUDO_VSIX="$($EXTENSION_SOURCE/scripts/package-vsix.sh)"
[[ -f "$SUDO_VSIX" ]] || die "Le VSIX SUDO n'a pas été produit."
ok "Extension créée : $(basename "$SUDO_VSIX")"

log "Téléchargement de VSCodium"
VSCODIUM_JSON="$DOWNLOAD_DIR/vscodium.json"
download "https://api.github.com/repos/VSCodium/vscodium/releases/latest" "$VSCODIUM_JSON"
VSCODIUM_VERSION="$(jq -er '.tag_name' "$VSCODIUM_JSON")"
VSCODIUM_URL="$(jq -er '[.assets[] | select(.name | test("^VSCodium-win32-x64-.*\\.zip$"))][0].browser_download_url' "$VSCODIUM_JSON")"
download "$VSCODIUM_URL" "$DOWNLOAD_DIR/vscodium.zip"
unzip -q "$DOWNLOAD_DIR/vscodium.zip" -d "$APP_DIR"
mkdir -p "$APP_DIR/data/extensions" "$APP_DIR/data/user-data/User"
[[ -f "$APP_DIR/VSCodium.exe" ]] || die "VSCodium.exe absent après extraction."
ok "VSCodium $VSCODIUM_VERSION installé en mode portable"

log "Installation de Python portable $PYTHON_VERSION"
PYTHON_DIR="$APP_DIR/tools/python"
mkdir -p "$PYTHON_DIR"
download "https://www.python.org/ftp/python/$PYTHON_VERSION/python-$PYTHON_VERSION-embed-amd64.zip" "$DOWNLOAD_DIR/python.zip"
unzip -q "$DOWNLOAD_DIR/python.zip" -d "$PYTHON_DIR"
[[ -f "$PYTHON_DIR/python.exe" ]] || die "python.exe absent après extraction."
printf 'Python exécutable : %s\n' "$PYTHON_DIR/python.exe"
PTH_FILE="$(find "$PYTHON_DIR" -maxdepth 1 -name 'python*._pth' -print -quit)"
[[ -n "$PTH_FILE" ]] || die "Fichier python*._pth introuvable."
sed -i 's/^#import site/import site/' "$PTH_FILE"
grep -qxF 'Lib/site-packages' "$PTH_FILE" || printf '\nLib/site-packages\n' >> "$PTH_FILE"
mkdir -p "$PYTHON_DIR/Lib/site-packages"
download "https://bootstrap.pypa.io/get-pip.py" "$DOWNLOAD_DIR/get-pip.py"
"$PYTHON_DIR/python.exe" --version
"$PYTHON_DIR/python.exe" "$DOWNLOAD_DIR/get-pip.py"
printf '  - %s\n' "${PYTHON_PACKAGES[@]}"
"$PYTHON_DIR/python.exe" -m pip install \
  --disable-pip-version-check \
  --no-warn-script-location \
  "${PYTHON_PACKAGES[@]}"
ok "Python et packages installés"

log "Téléchargement de GCC / MinGW-w64"
WINLIBS_JSON="$DOWNLOAD_DIR/winlibs.json"
download "https://api.github.com/repos/brechtsanders/winlibs_mingw/releases/latest" "$WINLIBS_JSON"
WINLIBS_URL="$(jq -er '[.assets[] | select((.name | contains("winlibs-x86_64")) and (.name | contains("posix")) and (.name | contains("ucrt")) and (.name | endswith(".zip")) and ((.name | contains("llvm")) | not))][0].browser_download_url' "$WINLIBS_JSON")"
download "$WINLIBS_URL" "$DOWNLOAD_DIR/winlibs.zip"
mkdir -p "$BUILD_DIR/winlibs"
unzip -q "$DOWNLOAD_DIR/winlibs.zip" -d "$BUILD_DIR/winlibs"
MINGW_SOURCE="$(find "$BUILD_DIR/winlibs" -type d -name mingw64 -print -quit)"
[[ -n "$MINGW_SOURCE" ]] || die "Dossier mingw64 introuvable."
mv "$MINGW_SOURCE" "$APP_DIR/tools/mingw64"
ok "GCC installé"

log "Installation des extensions VSCodium"
CODIUM_CMD="$APP_DIR/bin/codium.cmd"
[[ -f "$CODIUM_CMD" ]] || die "Commande VSCodium absente : $CODIUM_CMD"
for extension in "${EXTENSIONS[@]}"; do
  printf '  - %s\n' "$extension"
  "$CODIUM_CMD" --install-extension "$extension" --force
done
"$CODIUM_CMD" --install-extension "$SUDO_VSIX" --force

log "Installation et vérification de Python Environment Tools"
ENV_EXTENSION_DIR="$(find "$APP_DIR/data/extensions" -maxdepth 1 -type d -name 'ms-python.vscode-python-envs-1.36.0*' -print -quit)"
[[ -n "$ENV_EXTENSION_DIR" ]] || die "Extension Python Environments 1.36.0 introuvable."
mkdir -p "$ENV_EXTENSION_DIR/python-env-tools/bin"
cp "$SCRIPT_DIR/assets/python-env-tools/"* "$ENV_EXTENSION_DIR/python-env-tools/bin/"
"$ENV_EXTENSION_DIR/python-env-tools/bin/pet.exe" resolve "$(cygpath -w "$PYTHON_DIR/python.exe")" --json \
  --cache-directory "$(cygpath -w "$BUILD_DIR/pet-cache")" > "$BUILD_DIR/pet-validation.json"
jq -e '.error == null and .version != null' "$BUILD_DIR/pet-validation.json" >/dev/null \
  || die "PET ne peut pas identifier le Python embarqué."
ok "Extensions installées et interpréteur Python détecté"

log "Création de la configuration SUDO"
mkdir -p "$APP_DIR/branding"
cp "$SCRIPT_DIR/assets/sudo.png" "$APP_DIR/branding/sudo.png"
cp "$SCRIPT_DIR/assets/sudo.ico" "$APP_DIR/branding/sudo.ico"

cat > "$APP_DIR/data/user-data/User/settings.json" <<'JSON'
{
  "workbench.startupEditor": "none",
  "telemetry.telemetryLevel": "off",
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 750,
  "editor.fontSize": 14,
  "editor.tabSize": 4,
  "python.defaultInterpreterPath": "${env:SUDO_PYTHON}",
  "sudo.autoOpen": true,
  "workbench.secondarySideBar.defaultVisibility": "visible",
  "security.workspace.trust.enabled": false
}
JSON

# Le dossier data sert uniquement pendant le build portable. Dans Program Files,
# les données modifiables doivent vivre dans le profil de chaque étudiant.
mv "$APP_DIR/data" "$APP_DIR/defaults"
ok "Configuration créée ; les données utilisateur seront placées dans LocalAppData"

log "Création des lanceurs Windows"
cat > "$APP_DIR/Lancer-SUDO.bat" <<'BAT'
@echo off
setlocal
cd /d "%~dp0"
set "ROOT=%~dp0"
set "PYTHONHOME=%ROOT%tools\python"
set "PYTHONPATH=%ROOT%tools\python\Lib\site-packages"
set "SUDO_PYTHON=%ROOT%tools\python\python.exe"
set "SUDO_GCC=%ROOT%tools\mingw64\bin\gcc.exe"
set "PATH=%ROOT%tools\python;%ROOT%tools\python\Scripts;%ROOT%tools\mingw64\bin;%PATH%"
set "SUDO_HOME=%LOCALAPPDATA%\SUDO"

robocopy "%ROOT%defaults\extensions" "%SUDO_HOME%\extensions" /E /XO /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 exit /b 1

if not exist "%SUDO_HOME%\user-data\User\settings.json" (
    robocopy "%ROOT%defaults\user-data" "%SUDO_HOME%\user-data" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP >nul
    if errorlevel 8 exit /b 1
)

if /I "%~1"=="--wait" (
    start "" /wait "%ROOT%VSCodium.exe" --user-data-dir "%SUDO_HOME%\user-data" --extensions-dir "%SUDO_HOME%\extensions"
) else (
    start "" "%ROOT%VSCodium.exe" --user-data-dir "%SUDO_HOME%\user-data" --extensions-dir "%SUDO_HOME%\extensions"
)
endlocal
BAT

cat > "$APP_DIR/Test-Environnement.bat" <<'BAT'
@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0tools\python;%~dp0tools\python\Scripts;%~dp0tools\mingw64\bin;%PATH%"
echo [Python]
"%~dp0tools\python\python.exe" --version || goto error
echo [Packages]
"%~dp0tools\python\python.exe" -c "import numpy, matplotlib, pandas, ipykernel, scipy, sympy, pint, openpyxl, pytest, control, seaborn, sklearn, tensorflow, cv2, segno; print('OK')" || goto error
echo [GCC]
"%~dp0tools\mingw64\bin\gcc.exe" --version || goto error
echo Tout semble fonctionner.
pause
exit /b 0
:error
echo Une erreur a ete detectee.
pause
exit /b 1
BAT

cat > "$APP_DIR/README.txt" <<EOF
$PROJECT_NAME
============================================================

Application installée dans C:\Program Files\SUDO.
Les données modifiables sont conservées dans %%LOCALAPPDATA%%\SUDO.

1. Télécharger séparément l'archive SUDO-Exercises et la décompresser dans Documents.
2. Double-cliquer sur C:\Program Files\SUDO\Lancer-SUDO.bat.
3. Cliquer sur « SUDO : ouvrir Exercises » en bas à gauche.
4. Choisir le dossier Exercises complet ou un dossier de cours.
5. Choisir un exercice ; son code s'ouvre à gauche et son énoncé à droite.

Les solutions sont conservées dans le dossier MesSolutions du dossier ouvert.
Pour vérifier l'installation, lancer Test-Environnement.bat.

Versions du build :
- VSCodium $VSCODIUM_VERSION
- Python $PYTHON_VERSION
- SUDO 0.6.0
EOF

cat > "$APP_DIR/BUILD-INFO.txt" <<EOF
Date UTC : $(date -u '+%Y-%m-%dT%H:%M:%SZ')
VSCodium : $VSCODIUM_VERSION
Python : $PYTHON_VERSION
Plateforme : Windows x86-64
EOF

log "Nettoyage des caches et création de l'archive"
find "$PYTHON_DIR" -type d -name __pycache__ -prune -exec rm -rf -- {} + 2>/dev/null || true
find "$PYTHON_DIR" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete 2>/dev/null || true
OUTPUT_ZIP="$DIST_DIR/$PROJECT_NAME.zip"
(cd "$BUILD_DIR" && 7z a -tzip -mx=1 "$OUTPUT_ZIP" "$PROJECT_NAME")

log "Création de l’exécutable portable"
LAUNCHER_STUB="$BUILD_DIR/sudo-launcher.exe"
OUTPUT_EXE="$DIST_DIR/SUDO-Portable.exe"
MSYS_NO_PATHCONV=1 "$CSC" /nologo /target:winexe \
  /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll \
  /r:System.Windows.Forms.dll /r:System.Drawing.dll \
  "/win32icon:$(cygpath -w "$SCRIPT_DIR/assets/sudo.ico")" \
  "/out:$(cygpath -w "$LAUNCHER_STUB")" "$(cygpath -w "$SCRIPT_DIR/sudo-launcher.cs")"
"$PYTHON_DIR/python.exe" -c '
import os, shutil, struct, sys
stub, archive, output = sys.argv[1:]
with open(output, "wb") as target:
    for filename in (stub, archive):
        with open(filename, "rb") as source:
            shutil.copyfileobj(source, target, 1024 * 1024)
    target.write(struct.pack("<Q", os.path.getsize(archive)))
    target.write(b"SUDO-SFX-1")
' "$(cygpath -w "$LAUNCHER_STUB")" "$(cygpath -w "$OUTPUT_ZIP")" "$(cygpath -w "$OUTPUT_EXE")"
ok "Build terminé"
printf '\nDossier : %s\nArchive : %s\nExécutable portable : %s\n' "$APP_DIR" "$OUTPUT_ZIP" "$OUTPUT_EXE"

if [[ "$INSTALL_AFTER_BUILD" == true ]]; then
  log "Installation dans C:\\Program Files\\SUDO"
  if tasklist.exe 2>/dev/null | tr -d '\r' | grep -qi 'VSCodium.exe'; then
    die "VSCodium est en cours d'exécution. Fermez SUDO puis relancez le build."
  fi
  if [[ -e "$INSTALL_DIR" ]]; then
    printf 'Suppression de l’ancienne installation : %s\n' "$INSTALL_DIR"
    safe_clean_install "$INSTALL_DIR"
  fi
  mkdir -p "$INSTALL_DIR" \
    || die "Impossible de créer C:\\Program Files\\SUDO."
  cp -R "$APP_DIR"/. "$INSTALL_DIR"/ \
    || die "Impossible de copier SUDO dans C:\\Program Files\\SUDO."
  [[ -f "$INSTALL_DIR/VSCodium.exe" && -f "$INSTALL_DIR/Lancer-SUDO.bat" ]] \
    || die "L'installation est incomplète."

  [[ -f "$INSTALL_DIR/branding/sudo.ico" ]] \
    || die "Icône absente : C:\\Program Files\\SUDO\\branding\\sudo.ico"

  log "Création du raccourci SUDO sur le Bureau public"
  if ! SHORTCUT_PATH_WIN="$(
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command '
      $installDir = "C:\Program Files\SUDO"
      $launcher = Join-Path $installDir "Lancer-SUDO.bat"
      $icon = Join-Path $installDir "branding\sudo.ico"
      $desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
      $shortcutPath = Join-Path $desktop "SUDO.lnk"

      if (-not (Test-Path -LiteralPath $launcher)) {
        throw "Lanceur SUDO introuvable."
      }
      if (-not (Test-Path -LiteralPath $icon)) {
        throw "Icone SUDO introuvable."
      }

      Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction SilentlyContinue
      $shell = New-Object -ComObject WScript.Shell
      $shortcut = $shell.CreateShortcut($shortcutPath)
      $shortcut.TargetPath = $launcher
      $shortcut.WorkingDirectory = $installDir
      $shortcut.IconLocation = "$icon,0"
      $shortcut.Description = "SUDO - Environnement pedagogique"
      $shortcut.WindowStyle = 1
      $shortcut.Save()

      if (-not (Test-Path -LiteralPath $shortcutPath)) {
        throw "Le raccourci SUDO na pas ete cree."
      }
      Write-Output $shortcutPath
    ' 2>&1 | tr -d '\r'
  )"; then
    die "Impossible de créer le raccourci SUDO : $SHORTCUT_PATH_WIN"
  fi

  ok "SUDO installé dans C:\\Program Files\\SUDO"
  printf 'Lanceur : C:\\Program Files\\SUDO\\Lancer-SUDO.bat\n'
  printf 'Raccourci : %s\n' "$SHORTCUT_PATH_WIN"
else
  printf 'Installation ignorée (--no-install).\n'
fi
