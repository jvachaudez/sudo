#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$EXTENSION_DIR/.package"
OUTPUT_DIR="$EXTENSION_DIR/dist"
OUTPUT_FILE="$OUTPUT_DIR/sudo-extension-0.4.0.vsix"

if command -v node >/dev/null 2>&1; then
  node --check "$EXTENSION_DIR/extension.js"
fi

if ! command -v zip >/dev/null 2>&1 && ! command -v 7z >/dev/null 2>&1; then
  echo "Erreur : la commande zip ou 7z est requise." >&2
  exit 1
fi

rm -rf -- "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR/extension" "$OUTPUT_DIR"
cp "$EXTENSION_DIR/package.json" "$EXTENSION_DIR/extension.js" "$PACKAGE_DIR/extension/"
[[ -f "$EXTENSION_DIR/media/mermaid.min.js" ]] || {
  echo "Erreur : media/mermaid.min.js est absent. Lancez le build principal." >&2
  exit 1
}
[[ -f "$EXTENSION_DIR/media/mermaid-LICENSE.txt" ]] || {
  echo "Erreur : media/mermaid-LICENSE.txt est absent. Lancez le build principal." >&2
  exit 1
}
mkdir -p "$PACKAGE_DIR/extension/media"
cp \
  "$EXTENSION_DIR/media/mermaid.min.js" \
  "$EXTENSION_DIR/media/mermaid-LICENSE.txt" \
  "$EXTENSION_DIR/media/sudo.png" \
  "$PACKAGE_DIR/extension/media/"
cp "$EXTENSION_DIR/vsix/extension.vsixmanifest" "$PACKAGE_DIR/"
cp "$EXTENSION_DIR/vsix/[Content_Types].xml" "$PACKAGE_DIR/"

rm -f -- "$OUTPUT_FILE"
if command -v zip >/dev/null 2>&1; then
  (cd "$PACKAGE_DIR" && zip -q -r "$OUTPUT_FILE" '[Content_Types].xml' extension.vsixmanifest extension)
else
  (cd "$PACKAGE_DIR" && 7z a -tzip -mx=7 "$OUTPUT_FILE" '[Content_Types].xml' extension.vsixmanifest extension >/dev/null)
fi
rm -rf -- "$PACKAGE_DIR"
echo "$OUTPUT_FILE"
