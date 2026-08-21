#!/bin/bash
set -euo pipefail

DISCLAIMER="FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION"
SERVICE_NAME="civil-model-studio"
CONSOLE_URL="${MODEL_STUDIO_CONSOLE_URL:-http://127.0.0.1:8765/}"
HEALTH_URL="${MODEL_STUDIO_HEALTH_URL:-http://127.0.0.1:8765/api/health}"
ATTEMPTS="${MODEL_STUDIO_HEALTH_ATTEMPTS:-30}"
DELAY_SECONDS="${MODEL_STUDIO_HEALTH_DELAY_SECONDS:-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SUPPORT_REPOSITORY="$HOME/Library/Application Support/Model Studio/repository"

if [[ -n "${MODEL_STUDIO_REPOSITORY:-}" ]]; then
  REPOSITORY="$MODEL_STUDIO_REPOSITORY"
elif [[ -e "$SUPPORT_REPOSITORY" ]]; then
  REPOSITORY="$(cd "$SUPPORT_REPOSITORY" && pwd)"
else
  REPOSITORY="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

ECOSYSTEM="$REPOSITORY/ops/model-studio-ecosystem.config.cjs"

show_error() {
  local message="$1"
  if [[ "${MODEL_STUDIO_APP_HANDLES_ERRORS:-0}" != "1" ]] && command -v osascript >/dev/null 2>&1; then
    osascript -e "display alert \"Model Studio could not open\" message \"$message\" as critical" >/dev/null 2>&1 || true
  fi
}

fail() {
  local message="$1"
  echo "$message" >&2
  show_error "$message"
  exit 1
}

health_ok() {
  local response
  local normalized
  response="$(curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null || true)"
  normalized="${response//[[:space:]]/}"
  [[ "$normalized" == *'"status":"ok"'* && "$normalized" == *'"service":"model-studio"'* ]]
}

if health_ok; then
  open "$CONSOLE_URL"
  exit 0
fi

[[ -f "$ECOSYSTEM" ]] || fail "Supervisor configuration is missing. Reinstall Model Studio from the repository. $DISCLAIMER"
command -v pm2 >/dev/null 2>&1 || fail "pm2 is not installed or is not available to the launcher. $DISCLAIMER"

if ! pm2 start "$ECOSYSTEM" --only "$SERVICE_NAME" --update-env >/dev/null 2>&1; then
  fail "The supervised Model Studio service could not be started. Run 'pm2 logs $SERVICE_NAME' for details. $DISCLAIMER"
fi

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  if health_ok; then
    open "$CONSOLE_URL"
    exit 0
  fi
  sleep "$DELAY_SECONDS"
done

fail "The supervised service did not become healthy at $HEALTH_URL. Run 'pm2 logs $SERVICE_NAME' for details. $DISCLAIMER"
