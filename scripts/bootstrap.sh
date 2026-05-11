#!/usr/bin/env bash
# SwiftSign one-shot bootstrap for a fresh machine.
#
#   git clone https://github.com/shahdadk/swiftsign.git
#   cd swiftsign
#   ./scripts/bootstrap.sh
#
# Pulls env vars from your Vercel project and installs everything.
# Idempotent — safe to re-run.

set -euo pipefail

cd "$(dirname "$0")/.."

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok() { printf "\033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "\033[33m!\033[0m %s\n" "$1"; }

bold "→ SwiftSign bootstrap"
echo

# ── Vercel CLI ─────────────────────────────────────────────────────────
if ! command -v vercel >/dev/null 2>&1; then
  bold "Installing Vercel CLI globally"
  npm install -g vercel
fi
ok "vercel installed"

# ── Vercel auth ────────────────────────────────────────────────────────
if ! vercel whoami >/dev/null 2>&1; then
  bold "Logging into Vercel (browser will open)"
  vercel login
fi
ok "logged into Vercel as $(vercel whoami)"

# ── Link to the SwiftSign project ──────────────────────────────────────
if [ ! -d ".vercel" ]; then
  bold "Linking this checkout to the SwiftSign project on Vercel"
  echo "  (pick the existing project — don't create a new one)"
  vercel link
fi
ok "linked to Vercel project"

# ── Pull env vars ──────────────────────────────────────────────────────
bold "Pulling production env vars into .env.local"
vercel env pull .env.local --environment=production
ok ".env.local populated"

# ── Install dependencies ───────────────────────────────────────────────
bold "Installing npm dependencies (legacy-peer-deps required for React 19 / Next 16 / Prisma 7)"
npm install
ok "node_modules ready (Prisma client auto-generated via postinstall, pdf.worker copied to public/)"

echo
bold "Done. You can now:"
echo "  npm run dev               # start the local dev server on :3000"
echo "  node scripts/send-saad.mjs  # send a real envelope from your terminal"
echo "  npx tsx --env-file=.env.local scripts/inspect-current.ts  # query envelope state"
echo
warn "Note: .env.local contains production secrets — never commit it."
warn "To use the MCP package from this machine: cd mcp && npm install && npm run build && claude mcp add swiftsign -- node \$(pwd)/dist/index.js"
