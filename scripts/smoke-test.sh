#!/bin/bash
# JBR smoke test runner — to be invoked by system cron.
#
# Schedule example (every 15 minutes, in `crontab -e`):
#   */15 * * * * /var/www/jbr/scripts/smoke-test.sh
#
# Behavior:
#   - Loads CRON_SECRET from /var/www/jbr/.env.local (fallback .env.production)
#   - Hits /api/cron/smoke-test on localhost:3000
#   - Logs JSON result to /var/www/jbr/logs/smoke-test.log
#   - On failure (HTTP 500): also writes a marker file logs/smoke-test.fail
#     and returns non-zero exit so cron mail-on-error fires.

set -uo pipefail

LOG_DIR="/var/www/jbr/logs"
LOG_FILE="$LOG_DIR/smoke-test.log"
FAIL_MARKER="$LOG_DIR/smoke-test.fail"
ENV_FILE="/var/www/jbr/.env.local"
[ -f "$ENV_FILE" ] || ENV_FILE="/var/www/jbr/.env.production"

mkdir -p "$LOG_DIR"

# shellcheck disable=SC1090
set -a
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
set +a

if [ -z "${CRON_SECRET:-}" ]; then
    echo "[$(date -u +%FT%TZ)] ERROR: CRON_SECRET not set in $ENV_FILE" | tee -a "$LOG_FILE"
    exit 2
fi

TS=$(date -u +%FT%TZ)
RESPONSE=$(curl -sS --max-time 60 -w "\nSTATUSCODE:%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "http://localhost:3000/api/cron/smoke-test" 2>&1)
HTTP_STATUS=$(echo "$RESPONSE" | grep -oE 'STATUSCODE:[0-9]+$' | sed 's/STATUSCODE://')
BODY=$(echo "$RESPONSE" | sed '/STATUSCODE:/d')

if [ "$HTTP_STATUS" = "200" ]; then
    rm -f "$FAIL_MARKER"
    echo "[$TS] PASS $BODY" >> "$LOG_FILE"
    exit 0
else
    echo "[$TS] FAIL status=$HTTP_STATUS $BODY" | tee -a "$LOG_FILE" >&2
    echo "$TS $HTTP_STATUS $BODY" > "$FAIL_MARKER"
    exit 1
fi
