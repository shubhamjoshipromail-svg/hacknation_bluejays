#!/usr/bin/env bash
# One-command setup for The Negotiator.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required: https://nodejs.org" >&2
  exit 1
fi
MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required (found $(node -v))." >&2
  exit 1
fi

echo "Installing backend dependencies..."
npm install

echo "Installing frontend dependencies..."
npm install --prefix auto-deal-navigator

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — add your own keys before placing voice calls."
else
  echo ".env already exists; leaving it untouched."
fi

cat <<'EOF'

Setup complete. Next steps:
  1. Fill in .env with your own ElevenLabs/Twilio keys (see README: Configuration).
  2. Terminal A:  npm run server
  3. Terminal B:  cd auto-deal-navigator && npm run dev
  4. Open http://localhost:8080
Voice calls additionally need a public tunnel (ngrok http 3000) and one `npm run provision`.
EOF
