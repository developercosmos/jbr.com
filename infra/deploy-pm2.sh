#!/bin/bash

# JBR Marketplace - PM2 Production Deployment Script
# Server: 192.168.1.225
# Path: /var/www/jbr   (Next.js code lives at root; no `web/` subdirectory)
# Domain: jualbeliraket.com

set -e

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

SSH_CMD="ssh ${SSH_USER}@${SERVER}"

# ========================================
# Step 1: Pull latest code on server
# ========================================
log_info "Pulling latest code from branch: ${GIT_BRANCH}..."
$SSH_CMD "cd ${DEPLOY_PATH} && git fetch origin && git reset --hard origin/${GIT_BRANCH}"

# ========================================
# Step 2: Stop app before build
# ========================================
# Avoid serving partial/rotating .next artifacts while npm ci + next build runs.
# This prevents transient 500 errors like missing SSR chunk files.
log_info "Stopping PM2 app before build..."
$SSH_CMD "pm2 stop ${APP_NAME} 2>/dev/null || true"

# ========================================
# Step 3: Install dependencies
# ========================================
# We need devDependencies (drizzle-kit, typescript, tailwind) to run the build,
# so use a full install. After build we can prune if disk pressure becomes an
# issue, but the previous --omit=dev was breaking `next build` here.
log_info "Installing dependencies..."
$SSH_CMD "cd ${DEPLOY_PATH} && npm ci"

# ========================================
# Step 4: Build the Next.js app
# ========================================
log_info "Building Next.js application..."
$SSH_CMD "cd ${DEPLOY_PATH} && npm run build"

# ========================================
# Step 4b: Apply DB migrations (raw SQL via psql)
# ========================================
# Migration files live in /var/www/jbr/drizzle/. Each file is wrapped with
# IF NOT EXISTS / ADD COLUMN IF NOT EXISTS so re-runs are no-ops.
# DATABASE_URL is loaded from .env.local first (Next.js precedence), then
# falls back to .env.production. ON_ERROR_STOP=1 halts on first failure.
log_info "Applying database migrations..."
$SSH_CMD "if [ -f '${ENV_FILE}' ]; then ENV_TO_SOURCE='${ENV_FILE}'; else ENV_TO_SOURCE='${ENV_FILE_FALLBACK}'; fi; \
  set -a; . \"\$ENV_TO_SOURCE\"; set +a; \
  if [ -z \"\$DATABASE_URL\" ]; then echo 'DATABASE_URL not set in env file'; exit 1; fi; \
  cd ${DEPLOY_PATH} && \
  for f in \$(ls drizzle/*.sql | sort); do \
    echo \"==> Applying \$f\"; \
    psql \"\$DATABASE_URL\" -v ON_ERROR_STOP=1 -f \"\$f\" || { echo \"MIGRATION FAILED: \$f\"; exit 1; }; \
  done"

# ========================================
# Step 5: Copy static assets and env files to standalone
# ========================================
# `next build --output=standalone` does not copy .env.local/.env.production
# into .next/standalone, so runtime env (DATABASE_URL, CRON_SECRET, etc.) must
# be replicated explicitly. Otherwise server.js inside standalone won't see
# them and routes that read process.env.* will appear unauthorized/misconfigured.
log_info "Injecting static assets and env into standalone build..."
$SSH_CMD "cd ${DEPLOY_PATH} && \
  mkdir -p .next/standalone/.next .next/standalone/public && \
  rm -rf .next/standalone/public .next/standalone/.next/static && \
  cp -r public .next/standalone/public && \
  cp -r .next/static .next/standalone/.next/static && \
  test -d .next/standalone/.next/static/chunks && \
  ls .next/standalone/.next/static/chunks/*.css >/dev/null 2>&1 && \
  for envf in .env.production .env.local; do \
    if [ -f \"\$envf\" ]; then cp \"\$envf\" \".next/standalone/\$envf\"; fi; \
  done"

# ========================================
# Step 6: Create logs directory
# ========================================
$SSH_CMD "mkdir -p ${DEPLOY_PATH}/logs"

# ========================================
# Step 7: Start/Restart with PM2
# ========================================
log_info "Starting application with PM2..."
$SSH_CMD "cd ${DEPLOY_PATH} && \
  pm2 delete ${APP_NAME} 2>/dev/null || true && \
  pm2 start ecosystem.config.cjs && \
  pm2 save"

# ========================================
# Step 8: Verify
# ========================================
log_info "Verifying deployment..."
sleep 3
$SSH_CMD "pm2 list && echo '' && pm2 logs ${APP_NAME} --lines 10 --nostream"

echo ""
log_info "🎉 Deployment complete!"
echo "======================================"
echo "Application: https://jualbeliraket.com"
echo "PM2 Process: ${APP_NAME}"
echo ""
echo "Useful commands (run on server):"
echo "  pm2 logs ${APP_NAME}        - View logs"
echo "  pm2 restart ${APP_NAME}     - Restart app"
echo "  pm2 stop ${APP_NAME}        - Stop app"
echo "  pm2 monit                   - Monitor dashboard"
