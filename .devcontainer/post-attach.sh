#!/usr/bin/env bash
# Runs EVERY TIME you reconnect to the codespace. Idempotent.
# Starts the BCAL dev server in the background if nothing is listening on :3000.
set -euo pipefail

if ss -tln 2>/dev/null | grep -q ':3000 '; then
  echo "✓ BCAL dev server already running on :3000"
  exit 0
fi

if [ ! -d /workspaces/BACL/frontend/node_modules ]; then
  echo "→ frontend/node_modules missing; running npm install"
  (cd /workspaces/BACL/frontend && npm install --silent)
fi

mkdir -p /tmp/bcal-logs
cd /workspaces/BACL/frontend
nohup npm run dev >/tmp/bcal-logs/dev.log 2>&1 &
disown || true

# Give Vite a moment to bind and print its URL.
for _ in {1..20}; do
  if ss -tln 2>/dev/null | grep -q ':3000 '; then
    echo "✓ BCAL dev server started → Codespaces forwarded URL on port 3000"
    echo "  logs: tail -f /tmp/bcal-logs/dev.log"
    exit 0
  fi
  sleep 0.5
done
echo "⚠ Server did not bind within 10s — check /tmp/bcal-logs/dev.log"
