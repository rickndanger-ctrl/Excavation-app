#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPPORT_DIR="$HOME/Library/Application Support/Model Studio"
REPOSITORY_LINK="$SUPPORT_DIR/repository"
REPOSITORY_PATH="$SUPPORT_DIR/repository-path"
RUNTIME_DIR="$SUPPORT_DIR/runtime"
APPLICATIONS_DIR="${MODEL_STUDIO_APPLICATIONS_DIR:-$HOME/Applications}"
DESKTOP_DIR="${MODEL_STUDIO_DESKTOP_DIR:-$HOME/Desktop}"
TARGET_APP="$APPLICATIONS_DIR/Model Studio.app"
DESKTOP_LINK="$DESKTOP_DIR/Model Studio.app"
STAGING_DIR=""

cleanup() {
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    /bin/rm -rf "$STAGING_DIR"
  fi
}
trap cleanup EXIT

mkdir -p "$SUPPORT_DIR" "$RUNTIME_DIR" "$APPLICATIONS_DIR" "$DESKTOP_DIR"
STAGING_DIR="$(mktemp -d "$SUPPORT_DIR/.install.XXXXXX")"

if [[ -L "$REPOSITORY_LINK" ]]; then
  unlink "$REPOSITORY_LINK"
fi
printf '%s\n' "$REPOSITORY" > "$REPOSITORY_PATH"
/bin/cp "$REPOSITORY/scripts/launch-model-studio.sh" "$RUNTIME_DIR/launch-model-studio.sh"
/bin/cp "$REPOSITORY/scripts/run-model-studio-service.sh" "$RUNTIME_DIR/run-model-studio-service.sh"
/bin/cp "$REPOSITORY/ops/model-studio-ecosystem.config.cjs" "$RUNTIME_DIR/model-studio-ecosystem.config.cjs"
chmod 755 "$RUNTIME_DIR/launch-model-studio.sh" "$RUNTIME_DIR/run-model-studio-service.sh"

/usr/bin/osacompile -o "$STAGING_DIR/Model Studio.app" "$REPOSITORY/macos/Model Studio.applescript"
/usr/bin/plutil -replace CFBundleIdentifier -string "local.civil-plan-factory.model-studio" "$STAGING_DIR/Model Studio.app/Contents/Info.plist"
/usr/bin/plutil -replace CFBundleName -string "Model Studio" "$STAGING_DIR/Model Studio.app/Contents/Info.plist"
/usr/bin/plutil -replace NSHumanReadableCopyright -string "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION" "$STAGING_DIR/Model Studio.app/Contents/Info.plist"

if [[ -e "$TARGET_APP" ]]; then
  BACKUP_APP="$SUPPORT_DIR/Model Studio.app.previous"
  /bin/rm -rf "$BACKUP_APP"
  mv "$TARGET_APP" "$BACKUP_APP"
fi
mv "$STAGING_DIR/Model Studio.app" "$TARGET_APP"

if [[ -L "$DESKTOP_LINK" ]]; then
  unlink "$DESKTOP_LINK"
elif [[ -e "$DESKTOP_LINK" ]]; then
  echo "Desktop item already exists and was not replaced: $DESKTOP_LINK" >&2
  exit 1
fi
ln -s "$TARGET_APP" "$DESKTOP_LINK"

echo "Installed: $TARGET_APP"
echo "Desktop link: $DESKTOP_LINK"
echo "FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"
