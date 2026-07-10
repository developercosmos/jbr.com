#!/bin/bash
# JBR KYC-OCR runner — invoked by system cron (e.g. every 5 minutes).
#
# Schedule (in `crontab -e`):
#   */5 * * * * /usr/bin/flock -n /tmp/jbr-kyc-ocr.lock /var/www/jbr/scripts/jbr-kyc-ocr.sh
#
# Drives the async KYC OCR pre-screen via POST /api/cron/kyc-ocr. Each OCR call
# to the local LLM takes ~30s, so this is kept SEPARATE from trust-sweeps and is
# self-gating: the route no-ops unless the feature flag "kyc.ocr" is on AND a
# KYC_OCR_LLM_URL is configured.
#
# Behavior mirrors jbr-trust-sweeps.sh:
#   - Loads CRON_SECRET from /var/www/jbr/.env.local (fallback .env.production)
#   - POSTs to /api/cron/kyc-ocr on localhost:3000 (route is POST-only)
#   - Logs JSON result to /var/www/jbr/logs/kyc-ocr.log
#   - On failure: writes logs/kyc-ocr.fail + non-zero exit for cron mail-on-error

set -uo pipefail

LOG_DIR="/var/www/jbr/logs"
LOG_FILE="$LOG_DIR/kyc-ocr.log"
FAIL_MARKER="$LOG_DIR/kyc-ocr.fail"
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
# max-time exceeds the route's sweep budget (KYC_OCR_SWEEP_BUDGET_MS, default 120s).
RESPONSE=$(curl -sS --max-time 180 -X POST -w "\nSTATUSCODE:%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "http://localhost:3000/api/cron/kyc-ocr" 2>&1)
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
