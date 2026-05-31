#!/bin/bash

# JBR Marketplace - Server Setup Script
# Run this script on a fresh Ubuntu server to set up the deployment environment

set -e

echo "🔧 JBR Marketplace - Server Setup"
echo "=================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Update system
log_info "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install required packages
log_info "Installing required packages..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Install Docker
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    log_warn "Docker already installed"
fi

# Install Docker Compose plugin
log_info "Installing Docker Compose..."
sudo apt-get install -y docker-compose-plugin

# Configure firewall
log_info "Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Create deployment directory
log_info "Creating deployment directory..."
sudo mkdir -p /var/www/jbr
sudo chown -R $USER:$USER /var/www/jbr

# Clone repository (if not exists)
if [ ! -d "/var/www/jbr/.git" ]; then
    log_info "Cloning repository..."
    git clone https://github.com/developercosmos/jbr.com.git /var/www/jbr
else
    log_warn "Repository already exists"
fi

# Create required directories
log_info "Creating required directories..."
mkdir -p /var/www/jbr/nginx/ssl
mkdir -p /var/www/jbr/nginx/logs

# Set permissions
sudo chown -R $USER:$USER /var/www/jbr

echo ""
log_info "✅ Server setup complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Copy .env.production.example to web/.env.production"
echo "2. Configure the environment variables"
echo "3. Run: cd /var/www/jbr && ./deploy.sh"
echo ""
echo "NOTE: Log out and back in for Docker group to take effect."
