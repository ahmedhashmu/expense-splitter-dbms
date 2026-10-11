#!/bin/bash
# Starts FairShare on this laptop: API on :8765, website on :3000.
# Usage: ./start.sh   (Ctrl+C stops both)
cd "$(dirname "$0")" || exit 1

if [ ! -f backend/.env ]; then
  echo "backend/.env is missing. Copy backend/.env.example and fill in DATABASE_URL and JWT_SECRET."
  exit 1
fi

# first run only: install packages
if [ ! -d backend/.venv ]; then
  echo "Setting up the backend (first run only)..."
  python3 -m venv backend/.venv && backend/.venv/bin/pip install -q -r backend/requirements.txt || exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "Setting up the website (first run only)..."
  (cd frontend && npm install --silent) || exit 1
fi

# 8765 instead of 8000 so it doesn't clash with anything else running
(cd backend && .venv/bin/uvicorn app.main:app --port 8765) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

# open the browser once the website is up
(sleep 6 && open http://localhost:3000) &

echo ""
echo "  FairShare → http://localhost:3000"
echo "  Demo login: ali@example.com / demo1234"
echo ""
cd frontend && BACKEND_URL=http://localhost:8765 npm run dev -- -p 3000
