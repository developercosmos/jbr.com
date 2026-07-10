#!/bin/bash
# JBR trust-sweeps runner — invoked by system cron every 15 minutes.
#
# Schedule (in `crontab -e`):
#   */15 * * * * /usr/bin/flock -n /tmp/jbr-trust-sweeps.lock /var/www/jbr/scripts/jbr-trust-sweeps.sh
#
# Drives ALL periodic marketplace jobs via POST /api/cron/trust-sweeps:
#   escrow auto-release, dispute SLA, offer expiry/SLA reminders, wishlist
#   price-drop alerts, cart-abandonment reminders, seller weekly digest,
#   product-event/search-term rollups, GL reconciliation, buyer-rating outliers,
#   feature-flag scheduled toggles, presence prune, and pending-payment reconcile.
#
# Behavior:
#   - Loads CRON_SECRET from /var/www/jbr/.env.local (fallback .env.production)
#   - POSTs to /api/cron/trust-sweeps on localhost:3000 (route is POST-only)
#   - Logs JSON result to /var/www/jbr/logs/trust-sweeps.log
#   - On failure: writes a marker file logs/trust-sweeps.fail + non-zero exit
#     so cron mail-on-error fires.

set -uo pipefail

LOG_DIR="/var/www/jbr/logs"
LOG_FILE="$LOG_DIR/trust-sweeps.log"
FAIL_MARKER="$LOG_DIR/trust-sweeps.fail"
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
RESPONSE=$(curl -sS --max-time 120 -X POST -w "\nSTATUSCODE:%{http_code}" \
    -H "Authorization: Bearer $CRON_SECRET" \
    "http://localhost:3000/api/cron/trust-sweeps" 2>&1)
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
