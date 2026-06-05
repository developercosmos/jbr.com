#!/bin/bash

# JBR Marketplace - PM2 Production Deployment Script
# Server: 192.168.1.225
# Path: /var/www/jbr   (Next.js code lives at root; no `web/` subdirectory)
# Domain: jualbeliraket.com
#
# SAFETY MODEL (why this script will not leave production down):
#   - The running app is NEVER stopped up-front. It keeps serving the previous
#     build through `npm ci` + `npm run build`, which are the slow, failure-prone
#     steps. Only a fast `pm2 startOrReload` swap happens at the very end.
#   - Any failure trips an ERR trap that rolls the checkout back to the
#     previously-deployed commit, rebuilds it cleanly, and restarts — so the
#     end state is always a consistent, healthy build (new one if all went well,
#     otherwise the last-known-good one rebuilt).
#   - `npm ci` falls back to `npm install` so a transient lock/registry hiccup
#     can't wedge the deploy.
#   - A health gate (HTTP 200 on /api/health) decides success; a bad new build
#     triggers the same rollback path.

set -eo pipefail

echo "🚀 JBR Marketplace - PM2 Deployment"
echo "======================================"

# Configuration
SERVER="192.168.1.225"
SSH_USER="developer"
DEPLOY_PATH="/var/www/jbr"
APP_NAME="jualbeliraket"
GIT_BRANCH="${1:-main}"

# Env file priority: Next.js loads .env.local on top of .env.production at
# runtime, so DATABASE_URL etc. for production live in .env.local on this box.
ENV_FILE="${DEPLOY_PATH}/.env.local"
ENV_FILE_FALLBACK="${DEPLOY_PATH}/.env.production"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Run a command on the server.
remote() { ssh "${SSH_USER}@${SERVER}" "$@"; }

# ---------------------------------------------------------------------------
# Reusable steps
# ---------------------------------------------------------------------------

# Install deps (ci, falling back to a regular install) then build. Runs while
# the old app is still serving — nothing is torn down here.
install_and_build() {
    log_info "Installing dependencies (npm ci, fallback npm install)..."
    remote "cd ${DEPLOY_PATH} && { npm ci || { echo 'npm ci failed — falling back to npm install'; npm install; }; }"
    log_info "Building Next.js application..."
    remote "cd ${DEPLOY_PATH} && npm run build"
}

# Apply idempotent SQL migrations (each file wraps DDL in IF NOT EXISTS / ADD
# COLUMN IF NOT EXISTS, so re-runs are no-ops). DATABASE_URL is sourced from
# .env.local first (Next.js precedence), then .env.production.
run_migrations() {
    log_info "Applying database migrations..."
    remote "if [ -f '${ENV_FILE}' ]; then ENV_TO_SOURCE='${ENV_FILE}'; else ENV_TO_SOURCE='${ENV_FILE_FALLBACK}'; fi; \
      set -a; . \"\$ENV_TO_SOURCE\"; set +a; \
      if [ -z \"\$DATABASE_URL\" ]; then echo 'DATABASE_URL not set in env file'; exit 1; fi; \
      cd ${DEPLOY_PATH} && \
      for f in \$(ls drizzle/*.sql | sort); do \
        echo \"==> Applying \$f\"; \
        psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f \"\$f\" || { echo \"MIGRATION FAILED: \$f\"; exit 1; }; \
      done"
}

# `next build` runs a postbuild hook that already syncs .next/static + public
# into .next/standalone. It does NOT copy .env.* though, so server.js inside the
# standalone bundle would not see DATABASE_URL/CRON_SECRET/etc. Replicate them
# here, verify the static assets landed, and ensure the logs dir exists.
inject_env_and_verify() {
    log_info "Injecting env into standalone + verifying static assets..."
    remote "cd ${DEPLOY_PATH} && \
      if [ ! -d .next/standalone/.next/static/chunks ] || ! ls .next/standalone/.next/static/chunks/*.css >/dev/null 2>&1; then \
        echo 'standalone static assets missing after build'; exit 1; \
      fi; \
      for envf in .env.production .env.local; do \
        if [ -f \"\$envf\" ]; then cp \"\$envf\" \".next/standalone/\$envf\"; fi; \
      done; \
      mkdir -p logs"
}

# Swap to the freshly built standalone with minimal downtime. startOrReload
# starts the app if it isn't running, otherwise reloads it in place.
restart_app() {
    log_info "Restarting application with PM2..."
    remote "cd ${DEPLOY_PATH} && pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save"
}

# Poll the in-process health endpoint until it returns 200 (or give up).
wait_health() {
    local code
    for _ in $(seq 1 15); do
        code=$(remote "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health" 2>/dev/null || echo 000)
        if [ "${code}" = "200" ]; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# Restore the previously-deployed commit and rebuild it cleanly, then restart.
# Used by the error trap and by the post-deploy health gate.
rollback() {
    if [ -z "${PREV_COMMIT:-}" ]; then
        log_error "No previous commit recorded — cannot roll back. Attempting plain restart."
        remote "cd ${DEPLOY_PATH} && (pm2 startOrReload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs)" || true
        return
    fi
    log_warn "Rolling back to ${PREV_COMMIT} and rebuilding..."
    remote "cd ${DEPLOY_PATH} && git reset --hard ${PREV_COMMIT}" || true
    remote "cd ${DEPLOY_PATH} && { npm ci || npm install; } && npm run build" || true
    remote "cd ${DEPLOY_PATH} && for envf in .env.production .env.local; do [ -f \"\$envf\" ] && cp \"\$envf\" \".next/standalone/\$envf\"; done; mkdir -p logs" || true
    remote "cd ${DEPLOY_PATH} && (pm2 startOrReload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs) && pm2 save" || true
}

# Error trap: never leave production down. Roll back, verify, report.
on_error() {
    local ec=$?
    trap - ERR EXIT
    log_error "Deploy failed (exit ${ec}). Initiating recovery so production stays up..."
    rollback
    if wait_health; then
        log_warn "Recovered: rolled back to the previous build and /api/health is 200."
    else
        log_error "Service STILL unhealthy after rollback. Manual action required:"
        log_error "  ssh ${SSH_USER}@${SERVER} 'pm2 logs ${APP_NAME} --lines 50 --nostream'"
    fi
    exit "${ec}"
}
trap on_error ERR

# ---------------------------------------------------------------------------
# Main flow
# ---------------------------------------------------------------------------

# Record the currently-deployed commit BEFORE we change anything (rollback anchor).
PREV_COMMIT="$(remote "cd ${DEPLOY_PATH} && git rev-parse HEAD")"
log_info "Currently deployed commit: ${PREV_COMMIT}"

log_info "Fetching branch '${GIT_BRANCH}'..."
remote "cd ${DEPLOY_PATH} && git fetch origin --quiet && git reset --hard \"origin/${GIT_BRANCH}\""
NEW_COMMIT="$(remote "cd ${DEPLOY_PATH} && git rev-parse --short HEAD")"
log_info "Target commit: ${NEW_COMMIT}"

# App keeps serving the previous build throughout install + build.
install_and_build
run_migrations
inject_env_and_verify
restart_app

# Health gate — a bad new build trips the same rollback path as a hard failure.
log_info "Verifying deployment health..."
if wait_health; then
    trap - ERR EXIT
    log_info "Health check OK (HTTP 200) on ${NEW_COMMIT}."
else
    log_error "New build did not become healthy — rolling back."
    false  # trip the ERR trap → rollback()
fi

echo ""
log_info "🎉 Deployment complete! (${NEW_COMMIT})"
echo "======================================"
echo "Application: https://jualbeliraket.com"
echo "PM2 Process: ${APP_NAME}"
echo ""
echo "Useful commands (run on server):"
echo "  pm2 logs ${APP_NAME}        - View logs"
echo "  pm2 restart ${APP_NAME}     - Restart app"
echo "  pm2 monit                   - Monitor dashboard"
