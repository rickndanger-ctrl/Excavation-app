#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPOSITORY="${MODEL_STUDIO_REPOSITORY:-$(cd "$SCRIPT_DIR/.." && pwd)}"
HOST="${MODEL_STUDIO_HOST:-127.0.0.1}"
PORT="${MODEL_STUDIO_PORT:-8777}"

if [[ -x "$REPOSITORY/work/venv/bin/python" ]]; then
  PYTHON="$REPOSITORY/work/venv/bin/python"
elif [[ -x "$REPOSITORY/.venv/bin/python" ]]; then
  PYTHON="$REPOSITORY/.venv/bin/python"
else
  PYTHON="$(command -v python3 || true)"
fi

if [[ -z "$PYTHON" ]]; then
  echo "Model Studio requires Python 3.11 or newer." >&2
  exit 1
fi

export PYTHONPATH="$REPOSITORY/src${PYTHONPATH:+:$PYTHONPATH}"
exec "$PYTHON" -m civil_plan_factory serve \
  --repository "$REPOSITORY" \
  --host "$HOST" \
  --port "$PORT"
