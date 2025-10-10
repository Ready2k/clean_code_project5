#!/bin/bash
#
# Prompt Library Startup Script
# Supports both Docker and local development modes
# Usage: ./scripts/start.sh [--docker-only] [--local-only] [--help]
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
ROOT_DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

# Mode configuration
MODE="${MODE:-auto}"  # auto, docker-only, local-only, full-docker
DOCKER_ONLY=false
LOCAL_ONLY=false
FULL_DOCKER=false

# Env overrides allowed
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
REDIS_PORT="${REDIS_PORT:-6379}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MAX_WAIT_TIME="${MAX_WAIT_TIME:-60}"
CHECK_INTERVAL="${CHECK_INTERVAL:-2}"

BACKEND_PID_FILE="$INTERFACE_DIR/.backend.pid"
FRONTEND_PID_FILE="$INTERFACE_DIR/.frontend.pid"

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

# Start frontend locally (background process)
start_frontend_local() {
  log "Starting frontend service locally..."
  
  # Clean up any existing processes
  pkill -f "vite.*--port.*$FRONTEND_PORT" 2>/dev/null || true
  sleep 1
  
  # Start frontend in background
  (cd "$INTERFACE_DIR" && nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 & echo $! > "$FRONTEND_PID_FILE")
  sleep 2
  
  local pid=$(cat "$FRONTEND_PID_FILE" 2>/dev/null || echo "unknown")
  log "Frontend started with PID $pid"
  
  # Wait for frontend to be ready
  local elapsed=0
  local max_wait=30
  while [ $elapsed -lt $max_wait ]; do
    if check_port "$FRONTEND_PORT"; then
      success "Frontend is ready on port $FRONTEND_PORT"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  
  warning "Frontend may still be starting up on port $FRONTEND_PORT"
}

# Start full Docker stack
start_full_docker() {
  log "Starting full Docker stack..."
  
  if [ -f "$ROOT_DOCKER_COMPOSE_FILE" ]; then
    local dc; dc="$(compose_cmd)"
    $dc -f "$ROOT_DOCKER_COMPOSE_FILE" up -d || { error "Full Docker stack failed"; exit 1; }
    success "Full Docker stack started"
  else
    error "Root docker-compose.yml not found at $ROOT_DOCKER_COMPOSE_FILE"
    exit 1
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
  echo ""
  echo "=========================================="
  success "🚀 Prompt Library Application is ready!"
  echo "=========================================="
  echo ""
  echo "📊 Service Status:"
  if ! $LOCAL_ONLY; then
    echo "  • PostgreSQL:  localhost:$POSTGRES_PORT (Docker)"
    echo "  • Redis:       localhost:$REDIS_PORT (Docker)"
  fi
  if ! $DOCKER_ONLY; then
    echo "  • Backend API: http://localhost:$BACKEND_PORT"
    echo "  • Frontend:    http://localhost:$FRONTEND_PORT"
  fi
  echo ""
  echo "🔗 Quick Links:"
  if ! $DOCKER_ONLY; then
    echo "  • Application: http://localhost:$FRONTEND_PORT"
    echo "  • API Health:  http://localhost:$BACKEND_PORT/api/health"
    echo "  • API Docs:    http://localhost:$BACKEND_PORT/api/docs"
  fi
  echo ""
  if ! $DOCKER_ONLY; then
    echo "📝 Logs:"
    echo "  • Backend:  tail -f $LOG_DIR/backend.log"
    echo "  • Frontend: tail -f $LOG_DIR/frontend.log"
    echo ""
  fi
  echo "🛑 To stop services: ./scripts/stop.sh"
  echo "=========================================="
}

show_docker_status() {
  echo ""
  echo "=========================================="
  success "🐳 Full Docker Application is ready!"
  echo "=========================================="
  echo ""
  echo "📊 Service Status:"
  echo "  • Application: http://localhost (via Nginx)"
  echo "  • Backend API: http://localhost:8000"
  echo "  • PostgreSQL:  localhost:5432"
  echo "  • Redis:       localhost:6379"
  echo ""
  echo "🔗 Quick Links:"
  echo "  • Application: http://localhost"
  echo "  • API Health:  http://localhost:8000/api/health"
  echo "  • API Docs:    http://localhost:8000/api/docs"
  echo ""
  echo "📝 Docker Logs:"
  echo "  • All services: docker-compose logs -f"
  echo "  • Backend only: docker-compose logs -f app"
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
#            Argument Parsing              #
############################################
parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --docker-only)
        DOCKER_ONLY=true
        MODE="docker-only"
        shift
        ;;
      --local-only)
        LOCAL_ONLY=true
        MODE="local-only"
        shift
        ;;
      --full-docker)
        FULL_DOCKER=true
        MODE="full-docker"
        shift
        ;;
      --help|-h)
        show_help
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
    esac
  done

  # Validate mode combinations
  local mode_count=0
  $DOCKER_ONLY && mode_count=$((mode_count + 1))
  $LOCAL_ONLY && mode_count=$((mode_count + 1))
  $FULL_DOCKER && mode_count=$((mode_count + 1))
  
  if [ $mode_count -gt 1 ]; then
    error "Cannot specify multiple modes simultaneously"
    exit 1
  fi
}

show_help() {
  echo "Prompt Library Application Start Script"
  echo ""
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Modes:"
  echo "  --docker-only    Start only Docker services (PostgreSQL, Redis)"
  echo "  --local-only     Start only local services (Backend, Frontend)"
  echo "  --full-docker    Start everything in Docker containers"
  echo "  (no options)     Auto mode: Docker deps + local backend/frontend"
  echo ""
  echo "Options:"
  echo "  --help, -h       Show this help message"
  echo ""
  echo "Environment Variables:"
  echo "  BACKEND_PORT     Backend port (default: 8000)"
  echo "  FRONTEND_PORT    Frontend port (default: 3000)"
  echo "  REDIS_PORT       Redis port (default: 6379)"
  echo "  POSTGRES_PORT    PostgreSQL port (default: 5432)"
  echo ""
  echo "Examples:"
  echo "  $0                    # Start all services (recommended)"
  echo "  $0 --docker-only      # Start only database services"
  echo "  $0 --local-only       # Start only app services (requires DB running)"
  echo "  $0 --full-docker      # Start everything in Docker"
}

############################################
#                   Main                   #
############################################
main() {
  parse_arguments "$@"
  
  log "🚀 Starting Prompt Library Application in $MODE mode..."
  
  case $MODE in
    "docker-only")
      log "📦 Docker-only mode: Starting database services..."
      ensure_tools
      start_docker_services
      wait_for_service "$POSTGRES_PORT" "PostgreSQL" 30
      wait_for_service "$REDIS_PORT" "Redis" 30
      success "🎉 Docker services started successfully!"
      echo "To start application services, run: $0 --local-only"
      ;;
    "local-only")
      log "🔧 Local-only mode: Starting application services..."
      check_prerequisites
      start_backend
      wait_for_service "$BACKEND_PORT" "Backend API" 45
      check_http_endpoint "http://localhost:$BACKEND_PORT/api/health" "Backend API" 200 200
      start_frontend_local
      show_final_status
      ;;
    "full-docker")
      log "🐳 Full Docker mode: Starting all services in containers..."
      ensure_tools
      start_full_docker
      wait_for_service "80" "Application (via Nginx)" 60
      show_docker_status
      ;;
    *)
      log "🚀 Auto mode: Starting Docker deps + local application..."
      ensure_tools
      check_prerequisites
      start_docker_services
      wait_for_service "$POSTGRES_PORT" "PostgreSQL" 30
      wait_for_service "$REDIS_PORT" "Redis" 30
      start_backend
      wait_for_service "$BACKEND_PORT" "Backend API" 45
      check_http_endpoint "http://localhost:$BACKEND_PORT/api/health" "Backend API" 200 200
      start_frontend_local
      show_final_status
      ;;
  esac
}

main "$@"
