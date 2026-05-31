#!/bin/bash

# JBR Marketplace - Deployment Script
# Server: 192.158.1.225
# Path: /var/www/jbr

set -e

echo "🚀 JBR Marketplace Deployment Script"
echo "======================================"

# Configuration
DEPLOY_PATH="/var/www/jbr"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
GIT_BRANCH="${1:-main}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root. Consider using a non-root user."
fi

# Navigate to deployment directory
cd "$DEPLOY_PATH" || {
    log_error "Deployment path $DEPLOY_PATH does not exist"
    exit 1
}

# Pull latest changes
log_info "Pulling latest changes from $GIT_BRANCH..."
git fetch origin
git checkout "$GIT_BRANCH"
git pull origin "$GIT_BRANCH"

# Check if .env.production exists
if [ ! -f "web/.env.production" ]; then
    log_error "web/.env.production not found! Copy from .env.production.example and configure."
    exit 1
fi

# Create required directories
log_info "Creating required directories..."
mkdir -p nginx/ssl nginx/logs

# Build and deploy
log_info "Building and starting containers..."
docker compose -f "$DOCKER_COMPOSE_FILE" build --no-cache app
docker compose -f "$DOCKER_COMPOSE_FILE" up -d

# Wait for services to be healthy
log_info "Waiting for services to be healthy..."
sleep 10

# ---------------------------------------------------------------------------
# Database backup BEFORE schema sync.
#
# Schema sync uses `drizzle-kit push` (force-sync to src/db/schema.ts). push is
# convenient but CAN drop columns/data on a rename/removal — so we ALWAYS take a
# full backup first, making the deploy recoverable. (Previously this step ran the
# destructive push with no backup; that was a launch risk.)
#
# Recommended next step: baseline the schema and switch to versioned
# `drizzle-kit migrate` shipping files under web/drizzle/ (e.g. the idempotent
# 0035_launch_hardening.sql), which removes the data-loss risk entirely.
# ---------------------------------------------------------------------------
log_info "Backing up database before schema sync..."
BACKUP_DIR="${JBR_BACKUP_DIR:-/var/backups/jbr}"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/jbr_pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
if docker compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres \
        pg_dump -U jbr_user jbr_marketplace | gzip > "$BACKUP_FILE"; then
    log_info "✅ Backup written to $BACKUP_FILE"
else
    log_error "Database backup FAILED — aborting before the (potentially destructive) schema sync."
    exit 1
fi

# Run database schema sync (backed up above, so a bad diff is recoverable)
log_info "Running database schema sync..."
docker compose -f "$DOCKER_COMPOSE_FILE" exec -T app npx drizzle-kit push

# Health check (the /api/health route returns JSON: {"status":"ok",...})
log_info "Running health check..."
if curl -s http://localhost:80/health | grep -q '"status":"ok"'; then
    log_info "✅ Application is healthy!"
else
    log_warn "⚠️ Health check failed. Check logs with: docker compose -f $DOCKER_COMPOSE_FILE logs"
fi

# Show running containers
log_info "Running containers:"
docker compose -f "$DOCKER_COMPOSE_FILE" ps

echo ""
log_info "🎉 Deployment complete!"
echo "======================================"
echo "Access the application at: https://jualbeliraket.com"
echo ""
echo "Useful commands:"
echo "  - View logs: docker compose -f $DOCKER_COMPOSE_FILE logs -f"
echo "  - Restart: docker compose -f $DOCKER_COMPOSE_FILE restart"
echo "  - Stop: docker compose -f $DOCKER_COMPOSE_FILE down"
