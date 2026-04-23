#!/usr/bin/env bash
# Run ONCE, the first time the codespace is created.
set -euo pipefail

cd /workspaces/BACL

echo "→ Installing Python package + dev deps"
pip install --quiet -e ".[dev]"

if [ -d frontend ]; then
  echo "→ Installing frontend node_modules"
  cd frontend
  if [ -f package-lock.json ]; then
    npm ci --silent
  else
    npm install --silent
  fi
  cd ..
fi

echo "✓ post-create complete"
