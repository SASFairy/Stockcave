#!/bin/bash

# =========================================================================
# 💎 Stockcave - One-Click Git Pull & Docker Rebuild Deploy Script
# =========================================================================

# Exit immediately if any command fails
set -e

# Define premium color-coded logging formats
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${PURPLE}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${CYAN}"
echo "========================================================================="
echo "        ⚡ Stockcave One-Click Docker Deploy Automator ⚡"
echo "========================================================================="
echo -e "${NC}"

# 1. Check if Docker is installed and running
if ! [ -x "$(command -v docker)" ]; then
  log_error "Docker is not installed on this system. Please install Docker first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  log_error "Docker daemon is not running. Please start Docker service first."
  exit 1
fi

# 2. Navigate to the project directory (directory of this script)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_info "Navigating to project root: ${PROJECT_DIR}"
cd "$PROJECT_DIR"

# 3. Synchronize with GitHub remote origin
log_info "Fetching latest updates from remote repository..."
git fetch origin

# Check if we are already up to date
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
  log_warn "Already up-to-date with remote main branch. Re-deploying current state anyway..."
else
  log_info "New commits found on remote. Discarding uncommitted local changes and pulling..."
  git reset --hard HEAD
  git pull origin main
  log_success "Git repository updated to latest revision successfully!"
fi

# 4. Rebuild & Deploy Docker containers
log_info "Starting production build and deployment via Docker Compose..."
# Using docker-compose (V1) or docker compose (V2)
if docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
else
  DOCKER_COMPOSE_CMD="docker-compose"
fi

log_info "Executing: ${DOCKER_COMPOSE_CMD} up -d --build"
$DOCKER_COMPOSE_CMD up -d --build

log_success "Stockcave container rebuilt and deployed in the background!"

# 5. Clean up dangling images to free up server disk space (VPS Optimizer)
log_info "Cleaning up unused dangling Docker images..."
docker image prune -f
log_success "Dangling Docker images cleaned up successfully!"

# 6. Parse PORT from .env for accurate success message logging
DEPLOY_PORT=3000
if [ -f .env ]; then
  ENV_PORT=$(grep -E "^PORT=" .env | cut -d'=' -f2 | tr -d '\r' | tr -d '"' | tr -d "'" | tr -d ' ')
  if [ -n "$ENV_PORT" ]; then
    DEPLOY_PORT=$ENV_PORT
  fi
fi

echo -e "${GREEN}"
echo "========================================================================="
echo "     🎉 Stockcave Production Deployment Finished Successfully! 🎉"
echo "     URL: http://localhost:${DEPLOY_PORT} (or your server domain)"
echo "========================================================================="
echo -e "${NC}"
