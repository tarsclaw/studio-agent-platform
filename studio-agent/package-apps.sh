#!/bin/bash
# ============================================================
#  package-apps.sh — Build Teams app packages
#  Creates two zip files from appPackage/:
#    1. appPackage.employee.zip (employee bot)
#    2. appPackage.admin.zip   (admin bot)
#
#  Teams requires each zip to contain exactly:
#    manifest.json, color.png, outline.png
#
#  IMPORTANT: manifest files use ${{VAR_NAME}} placeholders.
#  This script loads env vars from .localConfigs / .localConfigs.admin
#  and substitutes them before zipping.
#
#  Usage:
#    bash package-apps.sh                # build both
#    bash package-apps.sh employee       # employee only
#    bash package-apps.sh admin          # admin only
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR/appPackage"
BUILD_DIR="$APP_DIR/build"
TARGET="${1:-both}"

EMPLOYEE_ENV="$SCRIPT_DIR/.localConfigs"
ADMIN_ENV="$SCRIPT_DIR/.localConfigs.admin"

mkdir -p "$BUILD_DIR"

# ── Substitute ${{VAR_NAME}} placeholders in a manifest ────
substitute_manifest() {
  local manifest_in="$1"
  local env_file="$2"
  local manifest_out="$3"

  cp "$manifest_in" "$manifest_out"

  if [ ! -f "$env_file" ]; then
    echo "  ⚠ Env file $env_file not found — placeholders will NOT be substituted."
    echo "    You must replace \${{...}} values manually before uploading to Teams."
    return
  fi

  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    [[ -z "$value" ]] && continue
    [[ "$value" == "<"* ]] && continue
    sed -i "s|\${{${key}}}|${value}|g" "$manifest_out"
  done < "$env_file"

  sed -i "s|\${{APP_NAME_SUFFIX}}||g" "$manifest_out"

  local remaining=$(grep -oP '\$\{\{[^}]+\}\}' "$manifest_out" 2>/dev/null || true)
  if [ -n "$remaining" ]; then
    echo "  ⚠ Unsubstituted placeholders remaining:"
    echo "$remaining" | while read -r ph; do echo "    $ph"; done
  fi
}

# ── Employee package ────────────────────────────────────────
if [ "$TARGET" = "both" ] || [ "$TARGET" = "employee" ]; then
  echo "📦 Building employee package..."
  TEMP=$(mktemp -d)
  substitute_manifest "$APP_DIR/manifest.json" "$EMPLOYEE_ENV" "$TEMP/manifest.json"
  cp "$APP_DIR/color.png"   "$TEMP/color.png"
  cp "$APP_DIR/outline.png" "$TEMP/outline.png"
  (cd "$TEMP" && zip -q "$BUILD_DIR/appPackage.employee.zip" manifest.json color.png outline.png)
  rm -rf "$TEMP"
  echo "  ✓ $BUILD_DIR/appPackage.employee.zip"
fi

# ── Admin package ───────────────────────────────────────────
if [ "$TARGET" = "both" ] || [ "$TARGET" = "admin" ]; then
  echo "📦 Building admin package..."

  if [ ! -f "$APP_DIR/manifest.admin.json" ]; then
    echo "  ✗ Missing appPackage/manifest.admin.json"; exit 1
  fi

  ADMIN_COLOR="$APP_DIR/color.png"
  ADMIN_OUTLINE="$APP_DIR/outline.png"
  [ -f "$APP_DIR/color.admin.png" ]   && ADMIN_COLOR="$APP_DIR/color.admin.png"
  [ -f "$APP_DIR/outline.admin.png" ] && ADMIN_OUTLINE="$APP_DIR/outline.admin.png"

  TEMP=$(mktemp -d)
  substitute_manifest "$APP_DIR/manifest.admin.json" "$ADMIN_ENV" "$TEMP/manifest.json"
  cp "$ADMIN_COLOR"   "$TEMP/color.png"
  cp "$ADMIN_OUTLINE" "$TEMP/outline.png"
  (cd "$TEMP" && zip -q "$BUILD_DIR/appPackage.admin.zip" manifest.json color.png outline.png)
  rm -rf "$TEMP"
  echo "  ✓ $BUILD_DIR/appPackage.admin.zip"
fi

echo ""
echo "Done. Upload the zip files to Teams Admin Centre."
