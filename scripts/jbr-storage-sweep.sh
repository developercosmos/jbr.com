#!/bin/bash
# JBR storage-sweep runner — deletes orphan uploads (files no DB row references).
#
# Schedule (in `crontab -e`), weekly Saturday 20:00 UTC (Minggu 03:00 WIB):
#   0 20 * * 6  /usr/bin/flock -n /tmp/jbr-storage-sweep.lock /var/www/jbr/scripts/jbr-storage-sweep.sh
#
# Drives POST /api/cron/storage-sweep with execute=1 and a conservative 48h
# min-age so uploads belonging to forms still being filled are never touched.
# Private trees (kyc/, ktp/, statements/) are excluded by the route itself.
#
# Behavior mirrors jbr-kyc-ocr.sh:
#   - Loads CRON_SECRET from /var/www/jbr/.env.local (fallback .env.production)
#   - Logs JSON result to /var/www/jbr/logs/storage-sweep.log
#   - On failure: writes logs/storage-sweep.fail + non-zero exit

set -uo pipefail

LOG_DIR="/var/www/jbr/logs"
LOG_FILE="$LOG_DIR/storage-sweep.log"
FAIL_MARKER="$LOG_DIR/storage-sweep.fail"
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
RESPONSE=$(curl -sS --max-time 300 -X POST -w "\nSTATUSCODE:%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "http://localhost:3000/api/cron/storage-sweep?execute=1&minAgeHours=48" 2>&1)
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
