#!/bin/bash
# =============================================================
# Gig Lead Responder — Old Mac Setup Script
#
# Run this on the dedicated Mac that will be the always-on server.
# Tested on macOS 13+ (Ventura/Sonoma/Sequoia)
#
# Usage:
#   chmod +x scripts/setup-old-mac.sh
#   ./scripts/setup-old-mac.sh
# =============================================================
set -e

REPO_URL="https://github.com/SDGuitarist/gig-lead-responder.git"
REPO_DIR="$HOME/Projects/gig-lead-responder"
BRANCH="feat/gig-lead-pipeline"

echo ""
echo "=== Step 1: Install Homebrew (if not installed) ==="
if ! command -v brew &> /dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add Homebrew to PATH for Apple Silicon Macs
  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
  eval "$(/opt/homebrew/bin/brew shellenv)"
else
  echo "Homebrew already installed"
fi

echo ""
echo "=== Step 2: Install Node.js via Homebrew ==="
# Homebrew Node has a stable PATH — avoids nvm issues with pm2 startup
if ! command -v node &> /dev/null; then
  brew install node@20
  brew link node@20 --force --overwrite
else
  echo "Node already installed: $(node --version)"
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"

echo ""
echo "=== Step 3: Install pm2 globally ==="
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
else
  echo "pm2 already installed: $(pm2 --version)"
fi

echo ""
echo "=== Step 4: Install pm2 log rotation ==="
pm2 install pm2-logrotate 2>/dev/null || true
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

echo ""
echo "=== Step 5: Clone or update the repo ==="
if [ -d "$REPO_DIR" ]; then
  echo "Repo exists — pulling latest..."
  cd "$REPO_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  echo "Cloning repo..."
  mkdir -p "$HOME/Projects"
  git clone "$REPO_URL" "$REPO_DIR"
  cd "$REPO_DIR"
  git checkout "$BRANCH"
fi

echo ""
echo "=== Step 6: Install npm dependencies ==="
npm install

echo ""
echo "=== Step 7: Install Playwright Chromium ==="
npx playwright install chromium

echo ""
echo "=== Step 8: Create directories ==="
mkdir -p data logs logs/screenshots

echo ""
echo "=== Step 9: Create .env from template (if not exists) ==="
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  *** IMPORTANT: Edit .env with your real credentials ***"
  echo "  Run: nano $REPO_DIR/.env"
  echo ""
  echo "  Required:"
  echo "    - ANTHROPIC_API_KEY"
  echo ""
  echo "  Optional (for full automation):"
  echo "    - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER"
  echo "    - GIGSALAD_EMAIL, GIGSALAD_PASSWORD"
  echo "    - YELP_EMAIL, YELP_PASSWORD"
  echo ""
else
  echo ".env already exists — skipping"
fi

echo ""
echo "=== Step 10: Gmail OAuth Setup ==="
if [ ! -f data/gmail-token.json ]; then
  if [ -f credentials.json ]; then
    echo "Running Gmail authorization..."
    npx tsx scripts/gmail-auth.ts
  else
    echo ""
    echo "  *** Gmail credentials not found ***"
    echo "  1. Download OAuth credentials from Google Cloud Console"
    echo "  2. Save as: $REPO_DIR/credentials.json"
    echo "  3. Run: npx tsx scripts/gmail-auth.ts"
    echo ""
  fi
else
  echo "Gmail token already exists — skipping"
fi

echo ""
echo "=== Step 11: Start with pm2 ==="
pm2 delete gig-lead-responder 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== Step 12: Configure auto-start on boot ==="
echo ""
echo "Run 'pm2 startup' and COPY + PASTE the command it outputs."
echo "It will look something like:"
echo '  sudo env PATH=$PATH:/opt/homebrew/bin pm2 startup launchd -u $(whoami) --hp $HOME'
echo ""
pm2 startup 2>/dev/null || true

echo ""
echo "=== Step 13: Energy Settings ==="
echo ""
echo "  *** MANUAL STEP: Prevent Mac from sleeping ***"
echo "  System Settings → Energy → Prevent automatic sleeping when display is off: ON"
echo ""

echo ""
echo "============================================================"
echo "  Setup complete!"
echo "============================================================"
echo ""
echo "  Status:   pm2 status"
echo "  Logs:     pm2 logs gig-lead-responder"
echo "  Restart:  pm2 restart gig-lead-responder"
echo "  Monitor:  pm2 monit"
echo ""
echo "  After editing .env: pm2 restart gig-lead-responder"
echo "  After code changes: cd $REPO_DIR && git pull && npm install && pm2 restart gig-lead-responder"
echo ""
echo "  Mode: DRY RUN (default) — set DRY_RUN=false in .env to enable live sends"
echo ""
