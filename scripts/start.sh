#!/bin/bash
#
# Prompt Library Startup (Docker deps + backend + frontend with robust health checks + TTY-safe Vite)
# Works from any cwd. Intended path: repo_root/scripts/start.sh
#

set -Eeuo pipefail

############################################
#           Paths & Configuration          #
############################################
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
INTERFACE_DIR="$PROJECT_ROOT/interface"
BACKEND_DIR="$INTERFACE_DIR/backend"
FRONTEND_DIR="$INTERFACE_DIR/frontend"
LOG_DIR="$PROJECT_ROOT/logs"
DOCKER_COMPOSE_FILE="$INTERFACE_DIR/docker-compose.dev.yml"

# Env overrides allowed
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"   # desired port; we still auto-detect from logs
REDIS_PORT="${REDIS_PORT:-6379}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MAX_WAIT_TIME="${MAX_WAIT_TIME:-60}"
CHECK_INTERVAL="${CHECK_INTERVAL:-2}"

BACKEND_PID_FILE="$INTERFACE_DIR/.backend.pid"
FRONTEND_PID_FILE="$INTERFACE_DIR/.frontend.pid"
FRONTEND_EFFECTIVE_PORT=""

############################################
#                 Colors                   #
############################################
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

############################################
#             Logging Helpers              #
############################################
log()      { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"; }
success()  { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $*${NC}"; }
warning()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $*${NC}"; }
error()    { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $*${NC}"; }

############################################
#          Tooling / Capability Check      #
############################################
compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    error "Neither 'docker compose' nor 'docker-compose' is available."
    exit 1
  fi
}

have_nc=false;   command -v nc   >/dev/null 2>&1 && have_nc=true
have_curl=true;  command -v curl >/dev/null 2>&1 || have_curl=false
have_script=false; command -v script >/dev/null 2>&1 && have_script=true

############################################
#           Dependency Helpers             #
############################################
ensure_node_deps() {
  local dir="$1" name="$2"
  if [ ! -f "$dir/package.json" ]; then
    warning "$name: package.json not found in $dir (skipping install)"; return 0
  fi
  
  # For workspace directories, install from the interface root
  if [ "$dir" = "$BACKEND_DIR" ] || [ "$dir" = "$FRONTEND_DIR" ]; then
    if [ ! -d "$INTERFACE_DIR/node_modules" ] || [ ! -f "$INTERFACE_DIR/package-lock.json" ]; then
      log "Interface workspace: installing all dependencies..."
      (cd "$INTERFACE_DIR" && npm install) || { error "Interface workspace: npm install failed"; exit 1; }
    fi
    # Also ensure individual workspace has its node_modules
    if [ ! -d "$dir/node_modules" ]; then
      log "$name: installing workspace dependencies..."
      (cd "$INTERFACE_DIR" && npm install) || { error "$name: workspace install failed"; exit 1; }
    fi
  else
    # For non-workspace directories, use npm ci
    if [ ! -d "$dir/node_modules" ] || [ ! -f "$dir/package-lock.json" ]; then
      log "$name: installing node modules..."
      (cd "$dir" && npm ci) || { error "$name: npm ci failed in $dir"; exit 1; }
    fi
  fi
}

ensure_tools() {
  command -v npm >/dev/null 2>&1 || { error "npm not found on PATH."; exit 1; }
  docker info >/dev/null 2>&1 || { error "Docker is not running."; exit 1; }
  success "Docker is running"
}

############################################
#             Health Check Helpers         #
############################################
_try_port_once() {
  local port="$1"
  for host in 127.0.0.1 ::1 localhost; do
    if $have_nc; then
      if nc -z "$host" "$port" 2>/dev/null; then return 0; fi
    fi
    if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then exec 3>&- 3<&-; return 0; fi
  done
  return 1
}
check_port() { _try_port_once "$1"; }

wait_for_service() {
  local port="$1" service_name="$2" max_wait="${3:-$MAX_WAIT_TIME}"
  log "Waiting for $service_name to be ready on port $port..."
  local elapsed=0
  while [ "$elapsed" -lt "$max_wait" ]; do
    if check_port "$port"; then success "$service_name is ready on port $port"; return 0; fi
    if $have_curl; then
      code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" || echo "000")
      if [ "${code:-000}" -ge 200 ] && [ "${code:-000}" -le 399 ]; then
        success "$service_name responded over HTTP on http://localhost:$port/ ($code)"; return 0
      fi
    fi
    sleep "$CHECK_INTERVAL"; elapsed=$((elapsed + CHECK_INTERVAL))
    if [ $((elapsed % 10)) -eq 0 ]; then log "Still waiting for $service_name... (${elapsed}s elapsed)"; fi
  done
  error "$service_name failed to start within ${max_wait}s"; return 1
}

check_http_endpoint() {
  local url="$1" service_name="$2" expected_low="${3:-200}" expected_high="${4:-200}"
  if ! $have_curl; then warning "curl not found; skipping HTTP check for $service_name ($url)"; return 0; fi
  local code; code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  if [ "$code" -ge "$expected_low" ] && [ "$code" -le "$expected_high" ]; then
    success "$service_name HTTP endpoint is healthy ($url -> $code)"; return 0
  fi
  error "$service_name HTTP endpoint check failed (got $code, expected $expected_low-$expected_high)"; return 1
}

# Parse Vite's "Local: http://...:PORT/" from the frontend log
detect_vite_port() {
  local line port
  if [ -f "$LOG_DIR/frontend.log" ]; then
    # Remove ANSI escape sequences and look for the Local URL
    line="$(sed 's/\x1b\[[0-9;]*[mGKHJ]//g' "$LOG_DIR/frontend.log" | grep -E 'Local:\s+http://(localhost|127\.0\.0\.1|\[?::1\]?):[0-9]+/' | tail -n 1 || true)"
    if [ -n "$line" ]; then
      port="$(echo "$line" | sed -E 's/.*:([0-9]+)\/.*/\1/')"
      if [[ "$port" =~ ^[0-9]+$ ]]; then echo "$port"; return 0; fi
    fi
  fi
  return 1
}

############################################
#                Preflight                 #
############################################
check_prerequisites() {
  log "Checking prerequisites..."
  [ -f "$INTERFACE_DIR/package.json" ] || { error "Missing $INTERFACE_DIR/package.json"; exit 1; }
  [ -d "$FRONTEND_DIR" ] || { error "Missing frontend dir: $FRONTEND_DIR"; exit 1; }
  [ -f "$DOCKER_COMPOSE_FILE" ] || { error "Missing compose file: $DOCKER_COMPOSE_FILE"; exit 1; }

  mkdir -p "$LOG_DIR"
  : > "$LOG_DIR/backend.log"; : > "$LOG_DIR/frontend.log"; : > "$LOG_DIR/startup.log"
  {
    echo "=== Startup initiated at $(date) ==="
    echo "Node: $(node -v 2>/dev/null || echo 'not found')"
    echo "npm:  $(npm -v 2>/dev/null || echo 'not found')"
    echo "PATH: $PATH"
  } >> "$LOG_DIR/startup.log"

  # Install interface workspace dependencies first
  ensure_node_deps "$INTERFACE_DIR" "Interface workspace"
  ensure_node_deps "$BACKEND_DIR"  "Backend"
  ensure_node_deps "$FRONTEND_DIR" "Frontend"

  # Ensure builds are up to date
  if [ ! -f "$INTERFACE_DIR/backend/dist/index.js" ]; then
    log "Backend dist not found. Building backend..."
    (cd "$INTERFACE_DIR" && npm run build:backend) || { error "Backend build failed"; exit 1; }
  fi
  if [ ! -d "$INTERFACE_DIR/frontend/dist" ]; then
    log "Frontend dist not found. Building frontend..."
    (cd "$INTERFACE_DIR" && npm run build:frontend) || { error "Frontend build failed"; exit 1; }
  fi

  $have_nc   || warning "nc not found; using /dev/tcp fallback."
  $have_curl || warning "curl not found; HTTP health checks will be skipped."
  $have_script || warning "'script' not found; frontend logs may be sparse without a TTY (macOS: 'script' is usually present)."

  success "Prerequisites check completed"
}

############################################
#              Start Functions             #
############################################
start_docker_services() {
  log "Starting Docker services (PostgreSQL, Redis)..."
  local dc; dc="$(compose_cmd)"
  $dc -f "$DOCKER_COMPOSE_FILE" --project-directory "$INTERFACE_DIR" up -d || { error "Docker services failed"; exit 1; }
  success "Docker services started"
}

start_backend() {
  log "Starting backend service..."
  pkill -f "node .*backend/dist/index.js" 2>/dev/null || true
  # Set LOGS_DIR environment variable for backend
  (cd "$INTERFACE_DIR" && LOGS_DIR="$LOG_DIR" nohup npm run start:backend > "$LOG_DIR/backend.log" 2>&1 & echo $! > "$BACKEND_PID_FILE")
  sleep 0.3
  log "Backend started with PID $(cat "$BACKEND_PID_FILE" 2>/dev/null || echo unknown)"
}

# Start frontend in a new terminal session
start_frontend() {
  log "Starting frontend service in new terminal..."
  
  # Clean up any existing processes
  pkill -f "vite" 2>/dev/null || true
  sleep 1
  
  # Open new Terminal window and run frontend
  local frontend_cmd="cd '$INTERFACE_DIR' && npm run dev"
  
  if command -v osascript >/dev/null 2>&1; then
    # macOS - use AppleScript to open new Terminal window
    osascript -e "
      tell application \"Terminal\"
        do script \"$frontend_cmd\"
        activate
      end tell
    " >/dev/null 2>&1
    success "Frontend started in new Terminal window"
    echo "new-terminal" > "$FRONTEND_PID_FILE"
  else
    # Fallback for non-macOS systems
    warning "Cannot open new terminal on this system. Please run manually:"
    warning "  cd $INTERFACE_DIR && npm run dev"
    echo "manual" > "$FRONTEND_PID_FILE"
  fi
}

explain_frontend_failure() {
  echo ""
  warning "Frontend didn’t appear on a port yet. Quick diagnostics:"
  echo "  • First 200 lines of frontend log:"
  sed -n '1,200p' "$LOG_DIR/frontend.log" || true
  echo ""
  if command -v lsof >/dev/null 2>&1; then
    echo "  • Anything listening on 3000 and 3001:"
    lsof -nP -iTCP:3000 -sTCP:LISTEN || echo "    (none on 3000)"
    lsof -nP -iTCP:3001 -sTCP:LISTEN || echo "    (none on 3001)"
  else
    echo "  • Install lsof for port diagnostics (macOS: brew install lsof)."
  fi
}

############################################
#              Final Output                #
############################################
show_final_status() {
  local FE_PORT="${FRONTEND_EFFECTIVE_PORT:-$FRONTEND_PORT}"
  echo ""
  echo "=========================================="
  success "🚀 Prompt Library Application is ready!"
  echo "=========================================="
  echo ""
  echo "📊 Service Status:"
  echo "  • PostgreSQL:  localhost:$POSTGRES_PORT (Docker)"
  echo "  • Redis:       localhost:$REDIS_PORT (Docker)"
  echo "  • Backend API: http://localhost:$BACKEND_PORT"
  echo "  • Frontend:    http://localhost:$FE_PORT"
  echo ""
  echo "🔗 Quick Links:"
  echo "  • Application: http://localhost:$FE_PORT"
  echo "  • API Health:  http://localhost:$BACKEND_PORT/api/health"
  echo "  • API Docs:    http://localhost:$BACKEND_PORT/api/docs"
  echo ""
  echo "📝 Logs:"
  echo "  • Backend:  tail -f $LOG_DIR/backend.log"
  echo "  • Frontend: tail -f $LOG_DIR/frontend.log"
  echo ""
  echo "🛑 To stop services: ./scripts/stop.sh"
  echo "=========================================="
}

############################################
#                 Cleanup                  #
############################################
cleanup_on_exit() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    error "Startup failed. Check logs for details:"
    echo "  • Backend log:  tail $LOG_DIR/backend.log"
    echo "  • Frontend log: tail $LOG_DIR/frontend.log"
    echo ""
    echo "Cleaning up background processes..."
    [ -f "$BACKEND_PID_FILE" ] && kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null || true
    [ -f "$FRONTEND_PID_FILE" ] && kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null || true
    echo "To clean up containers, run: ./scripts/stop.sh"
  fi
  exit $exit_code
}
trap cleanup_on_exit EXIT

############################################
#                   Main                   #
############################################
main() {
  log "🚀 Starting Prompt Library Application..."
  ensure_tools
  check_prerequisites

  log "📦 Phase 1: Starting Docker services..."
  start_docker_services

  log "⏳ Phase 2: Waiting for Docker services..."
  wait_for_service "$POSTGRES_PORT" "PostgreSQL" 30
  wait_for_service "$REDIS_PORT" "Redis" 30

  log "🔧 Phase 3: Starting backend service..."
  start_backend
  wait_for_service "$BACKEND_PORT" "Backend API" 45
  sleep 2
  check_http_endpoint "http://localhost:$BACKEND_PORT/api/health" "Backend API" 200 200

  log "🎨 Phase 4: Starting frontend service..."
  start_frontend

  log "🔍 Phase 5: Final status check..."
  sleep 3
  
  # Quick check if services are running
  local backend_ok=false
  local frontend_ok=false
  
  if check_port "$BACKEND_PORT"; then
    backend_ok=true
    success "Backend is running on port $BACKEND_PORT"
  else
    warning "Backend may not be ready on port $BACKEND_PORT"
  fi
  
  # Check frontend status
  local frontend_status="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "")"
  if [ "$frontend_status" = "new-terminal" ]; then
    frontend_ok=true
    success "Frontend started in new Terminal window"
    FRONTEND_EFFECTIVE_PORT="$FRONTEND_PORT"
    log "Frontend should be available on port $FRONTEND_EFFECTIVE_PORT (check the new Terminal window)"
  elif [ "$frontend_status" = "manual" ]; then
    warning "Frontend needs to be started manually"
    FRONTEND_EFFECTIVE_PORT="$FRONTEND_PORT"
  else
    warning "Frontend status unknown"
    FRONTEND_EFFECTIVE_PORT="$FRONTEND_PORT"
  fi

  # Show final status regardless
  show_final_status
  
  if $backend_ok; then
    echo "$(date): Services started - Backend: ✅, Frontend: $([ "$frontend_ok" = true ] && echo "✅" || echo "⚠️")" >> "$LOG_DIR/startup.log"
    success "🎉 Startup complete! Check the URLs above."
    if [ "$frontend_ok" != true ]; then
      warning "If frontend is not responding, try: cd ../interface/ && npm run dev &"
    fi
  else
    error "Backend failed to start properly"
    exit 1
  fi
}

main "$@"
