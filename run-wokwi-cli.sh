#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

if command -v wokwi-cli >/dev/null 2>&1; then
  WOKWI_CLI_BIN="$(command -v wokwi-cli)"
elif [[ -x "$HOME/.wokwi/bin/wokwi-cli" ]]; then
  WOKWI_CLI_BIN="$HOME/.wokwi/bin/wokwi-cli"
else
  echo "Error: wokwi-cli is not installed."
  echo "Install it first, or reopen your shell if it was just installed."
  exit 1
fi

if [[ -z "${WOKWI_CLI_TOKEN:-}" ]]; then
  echo "Error: WOKWI_CLI_TOKEN is not set."
  echo "Get your token from: https://wokwi.com/dashboard/ci"
  echo "Then add it to $SCRIPT_DIR/.env as:"
  echo "WOKWI_CLI_TOKEN=your_token_here"
  exit 1
fi

LOG_FILE="${WOKWI_SERIAL_LOG_FILE:-wokwi_output.log}"
TIMEOUT_MS="${WOKWI_TIMEOUT_MS:-86400000}"

echo "Starting Wokwi CLI..."
echo "CLI: $WOKWI_CLI_BIN"
echo "Log file: $LOG_FILE"
echo "Timeout: ${TIMEOUT_MS}ms"

exec "$WOKWI_CLI_BIN" . --timeout "$TIMEOUT_MS" --serial-log-file "$LOG_FILE"
