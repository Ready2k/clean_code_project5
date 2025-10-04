#!/bin/bash
#
# Log Management Script for Prompt Library
# Provides utilities for log rotation, cleanup, and monitoring
#

set -Eeuo pipefail

############################################
#           Paths & Configuration          #
############################################
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

# Configuration
MAX_LOG_SIZE_MB="${MAX_LOG_SIZE_MB:-50}"
MAX_LOG_AGE_DAYS="${MAX_LOG_AGE_DAYS:-30}"
ARCHIVE_DIR="$LOG_DIR/archive"

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
#             Helper Functions             #
############################################
ensure_log_dir() {
  mkdir -p "$LOG_DIR"
  mkdir -p "$ARCHIVE_DIR"
}

get_file_size_mb() {
  local file="$1"
  if [ -f "$file" ]; then
    # Get file size in MB (works on both macOS and Linux)
    if command -v stat >/dev/null 2>&1; then
      if stat -f%z "$file" >/dev/null 2>&1; then
        # macOS
        echo $(($(stat -f%z "$file") / 1024 / 1024))
      else
        # Linux
        echo $(($(stat -c%s "$file") / 1024 / 1024))
      fi
    else
      echo "0"
    fi
  else
    echo "0"
  fi
}

get_file_age_days() {
  local file="$1"
  if [ -f "$file" ]; then
    local file_time
    local current_time
    local age_seconds
    
    if command -v stat >/dev/null 2>&1; then
      if stat -f%m "$file" >/dev/null 2>&1; then
        # macOS
        file_time=$(stat -f%m "$file")
      else
        # Linux
        file_time=$(stat -c%Y "$file")
      fi
      current_time=$(date +%s)
      age_seconds=$((current_time - file_time))
      echo $((age_seconds / 86400))
    else
      echo "0"
    fi
  else
    echo "0"
  fi
}

############################################
#             Log Operations               #
############################################
rotate_log() {
  local log_file="$1"
  local base_name
  local timestamp
  
  if [ ! -f "$log_file" ]; then
    return 0
  fi
  
  base_name=$(basename "$log_file")
  timestamp=$(date +"%Y%m%d_%H%M%S")
  
  log "Rotating log file: $base_name"
  
  # Compress and move to archive
  gzip -c "$log_file" > "$ARCHIVE_DIR/${base_name}.${timestamp}.gz"
  
  # Truncate original file (keeps file handles open)
  > "$log_file"
  
  success "Log rotated: $base_name -> ${base_name}.${timestamp}.gz"
}

cleanup_old_logs() {
  local days="$1"
  local count=0
  
  log "Cleaning up log files older than $days days..."
  
  if [ -d "$ARCHIVE_DIR" ]; then
    # Find and remove old archived logs
    while IFS= read -r -d '' file; do
      rm "$file"
      count=$((count + 1))
      log "Removed old archive: $(basename "$file")"
    done < <(find "$ARCHIVE_DIR" -name "*.gz" -mtime +$days -print0 2>/dev/null || true)
  fi
  
  # Find and remove old log files in main directory
  while IFS= read -r -d '' file; do
    local age
    age=$(get_file_age_days "$file")
    if [ "$age" -gt "$days" ]; then
      rm "$file"
      count=$((count + 1))
      log "Removed old log: $(basename "$file")"
    fi
  done < <(find "$LOG_DIR" -maxdepth 1 -name "*.log" -print0 2>/dev/null || true)
  
  if [ "$count" -gt 0 ]; then
    success "Cleaned up $count old log files"
  else
    log "No old log files found to clean up"
  fi
}

check_log_sizes() {
  local needs_rotation=false
  
  log "Checking log file sizes (max: ${MAX_LOG_SIZE_MB}MB)..."
  
  for log_file in "$LOG_DIR"/*.log; do
    if [ -f "$log_file" ]; then
      local size_mb
      local base_name
      
      size_mb=$(get_file_size_mb "$log_file")
      base_name=$(basename "$log_file")
      
      if [ "$size_mb" -gt "$MAX_LOG_SIZE_MB" ]; then
        warning "$base_name is ${size_mb}MB (exceeds ${MAX_LOG_SIZE_MB}MB limit)"
        rotate_log "$log_file"
        needs_rotation=true
      else
        log "$base_name: ${size_mb}MB (OK)"
      fi
    fi
  done
  
  if [ "$needs_rotation" = false ]; then
    success "All log files are within size limits"
  fi
}

show_log_status() {
  echo ""
  echo "=========================================="
  echo "📊 Log Directory Status"
  echo "=========================================="
  echo "Location: $LOG_DIR"
  echo ""
  
  if [ ! -d "$LOG_DIR" ]; then
    warning "Log directory does not exist"
    return
  fi
  
  echo "📁 Current Log Files:"
  for log_file in "$LOG_DIR"/*.log; do
    if [ -f "$log_file" ]; then
      local size_mb
      local age_days
      local base_name
      
      size_mb=$(get_file_size_mb "$log_file")
      age_days=$(get_file_age_days "$log_file")
      base_name=$(basename "$log_file")
      
      printf "  %-25s %5dMB  %3d days old\n" "$base_name" "$size_mb" "$age_days"
    fi
  done
  
  echo ""
  echo "📦 Archived Log Files:"
  if [ -d "$ARCHIVE_DIR" ]; then
    local archive_count
    archive_count=$(find "$ARCHIVE_DIR" -name "*.gz" 2>/dev/null | wc -l | tr -d ' ')
    echo "  Total archived files: $archive_count"
    
    if [ "$archive_count" -gt 0 ]; then
      echo "  Recent archives:"
      find "$ARCHIVE_DIR" -name "*.gz" -exec ls -lh {} \; 2>/dev/null | tail -5 | while read -r line; do
        echo "    $line"
      done
    fi
  else
    echo "  No archive directory found"
  fi
  
  echo ""
  echo "⚙️  Configuration:"
  echo "  Max log size: ${MAX_LOG_SIZE_MB}MB"
  echo "  Max log age: ${MAX_LOG_AGE_DAYS} days"
  echo "=========================================="
}

tail_logs() {
  local log_name="${1:-}"
  
  if [ -z "$log_name" ]; then
    echo "Available logs:"
    for log_file in "$LOG_DIR"/*.log; do
      if [ -f "$log_file" ]; then
        echo "  - $(basename "$log_file" .log)"
      fi
    done
    echo ""
    echo "Usage: $0 tail <log_name>"
    echo "Example: $0 tail backend"
    return 1
  fi
  
  local log_file="$LOG_DIR/${log_name}.log"
  
  if [ ! -f "$log_file" ]; then
    error "Log file not found: $log_file"
    return 1
  fi
  
  log "Tailing log file: $log_file"
  echo "Press Ctrl+C to stop"
  echo ""
  
  tail -f "$log_file"
}

############################################
#                   Main                   #
############################################
show_usage() {
  echo "Log Management Script for Prompt Library"
  echo ""
  echo "Usage: $0 <command> [options]"
  echo ""
  echo "Commands:"
  echo "  status              Show current log status"
  echo "  rotate              Rotate large log files"
  echo "  cleanup [days]      Clean up old logs (default: $MAX_LOG_AGE_DAYS days)"
  echo "  maintain            Run rotation and cleanup"
  echo "  tail <log_name>     Tail a specific log file"
  echo ""
  echo "Environment Variables:"
  echo "  MAX_LOG_SIZE_MB     Maximum log file size in MB (default: $MAX_LOG_SIZE_MB)"
  echo "  MAX_LOG_AGE_DAYS    Maximum log age in days (default: $MAX_LOG_AGE_DAYS)"
  echo ""
  echo "Examples:"
  echo "  $0 status"
  echo "  $0 rotate"
  echo "  $0 cleanup 7"
  echo "  $0 tail backend"
}

main() {
  local command="${1:-status}"
  
  ensure_log_dir
  
  case "$command" in
    "status")
      show_log_status
      ;;
    "rotate")
      check_log_sizes
      ;;
    "cleanup")
      local days="${2:-$MAX_LOG_AGE_DAYS}"
      cleanup_old_logs "$days"
      ;;
    "maintain")
      log "Running log maintenance..."
      check_log_sizes
      cleanup_old_logs "$MAX_LOG_AGE_DAYS"
      success "Log maintenance completed"
      ;;
    "tail")
      tail_logs "${2:-}"
      ;;
    "help"|"-h"|"--help")
      show_usage
      ;;
    *)
      error "Unknown command: $command"
      echo ""
      show_usage
      exit 1
      ;;
  esac
}

main "$@"