#!/usr/bin/env bash
# Starts the meal-planner backend (FastAPI) and web frontend (Expo) in parallel.
# Usage: ./start.sh
# Stop: Ctrl+C

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backends"
FRONTEND_DIR="$ROOT_DIR/mobile"
VENV_DIR="$BACKEND_DIR/venv"
LOG_BACKEND="/tmp/meal-planner-backend.log"
LOG_FRONTEND="/tmp/meal-planner-frontend.log"

# Colors
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKEND_PID=""
FRONTEND_PID=""
TAIL_PIDS=()

cleanup() {
  echo -e "\n${YELLOW}Stopping services...${NC}"
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  for pid in "${TAIL_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Python virtual environment ────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo -e "${CYAN}Creating Python virtual environment...${NC}"
  python3 -m venv "$VENV_DIR"
  echo -e "${CYAN}Installing backend dependencies...${NC}"
  "$VENV_DIR/bin/pip" install -r "$BACKEND_DIR/requirements.txt" -q
  echo -e "${GREEN}Virtual environment ready.${NC}"
fi

# ── 2. Backend ────────────────────────────────────────────────────────────────
echo -e "${BLUE}[BACKEND]${NC} Starting FastAPI on http://localhost:8000 ..."
> "$LOG_BACKEND"
(
  cd "$BACKEND_DIR"
  source "$VENV_DIR/bin/activate"
  uvicorn app.main:app --reload --host 0.0.0.0
) >> "$LOG_BACKEND" 2>&1 &
BACKEND_PID=$!

# ── 3. Frontend ───────────────────────────────────────────────────────────────
echo -e "${CYAN}[FRONTEND]${NC} Starting Expo web on http://localhost:8081 ..."
> "$LOG_FRONTEND"
(
  cd "$FRONTEND_DIR"
  npx expo start --web --non-interactive
) >> "$LOG_FRONTEND" 2>&1 &
FRONTEND_PID=$!

echo -e "\n${GREEN}Both services started. Press Ctrl+C to stop.${NC}\n"

# ── 4. Stream logs with prefixes ──────────────────────────────────────────────
tail -f "$LOG_BACKEND"  | sed "s/^/$(printf "${BLUE}[BACKEND]${NC} ")/" &
TAIL_PIDS+=($!)
tail -f "$LOG_FRONTEND" | sed "s/^/$(printf "${CYAN}[FRONTEND]${NC} ")/" &
TAIL_PIDS+=($!)

# Wait until one of the main processes exits
wait "$BACKEND_PID" "$FRONTEND_PID"
