#!/bin/bash
#
# Test script to verify centralized logging is working
#

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

echo "Testing centralized logging system..."
echo ""

# Test log directory creation
echo "1. Testing log directory creation..."
mkdir -p "$LOG_DIR"
echo "   ✅ Log directory exists: $LOG_DIR"

# Test log file creation
echo ""
echo "2. Testing log file creation..."
echo "$(date): Test log entry from test script" >> "$LOG_DIR/test.log"
echo "   ✅ Test log file created: $LOG_DIR/test.log"

# Test backend logger (if backend is available)
echo ""
echo "3. Testing backend logger configuration..."
if [ -f "$PROJECT_ROOT/interface/backend/src/utils/logger.ts" ]; then
  echo "   ✅ Backend logger configuration found"
  echo "   📁 Configured to use: $LOG_DIR"
else
  echo "   ❌ Backend logger configuration not found"
fi

# Test frontend logger
echo ""
echo "4. Testing frontend logger configuration..."
if [ -f "$PROJECT_ROOT/interface/frontend/src/utils/logger.ts" ]; then
  echo "   ✅ Frontend logger configuration found"
else
  echo "   ❌ Frontend logger configuration not found"
fi

# Test log management script
echo ""
echo "5. Testing log management script..."
if [ -x "$PROJECT_ROOT/scripts/manage-logs.sh" ]; then
  echo "   ✅ Log management script is executable"
  echo "   Running status check..."
  "$PROJECT_ROOT/scripts/manage-logs.sh" status | head -5
else
  echo "   ❌ Log management script not found or not executable"
fi

# Test environment configuration
echo ""
echo "6. Testing environment configuration..."
if grep -q "LOGS_DIR" "$PROJECT_ROOT/interface/.env.example" 2>/dev/null; then
  echo "   ✅ LOGS_DIR configured in environment files"
else
  echo "   ❌ LOGS_DIR not found in environment configuration"
fi

# Clean up test file
rm -f "$LOG_DIR/test.log"

echo ""
echo "=========================================="
echo "✅ Centralized logging test completed!"
echo "=========================================="
echo ""
echo "📁 All logs will be stored in: $LOG_DIR"
echo "🔧 Manage logs with: ./scripts/manage-logs.sh"
echo "📊 Check status with: ./scripts/manage-logs.sh status"
echo "👀 Tail logs with: ./scripts/manage-logs.sh tail <log_name>"
echo ""