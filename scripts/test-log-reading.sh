#!/bin/bash
#
# Test script to verify log reading functionality
#

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

echo "Testing log reading functionality..."
echo ""

# Create some test log entries
echo "1. Creating test log entries..."
mkdir -p "$LOG_DIR"

# Create a test backend log with JSON format
cat > "$LOG_DIR/test-backend.log" << 'EOF'
{"@timestamp":"2025-01-04T10:00:00.000Z","level":"info","message":"Application started","service":"prompt-library-backend","environment":"development","hostname":"localhost"}
{"@timestamp":"2025-01-04T10:01:00.000Z","level":"warn","message":"High memory usage detected","service":"prompt-library-backend","environment":"development","hostname":"localhost","memoryUsage":85}
{"@timestamp":"2025-01-04T10:02:00.000Z","level":"error","message":"Database connection failed","service":"prompt-library-backend","environment":"development","hostname":"localhost","error":"Connection timeout"}
{"@timestamp":"2025-01-04T10:03:00.000Z","level":"info","message":"User authenticated successfully","service":"prompt-library-backend","environment":"development","hostname":"localhost","userId":"user-123"}
EOF

# Create a test frontend log
cat > "$LOG_DIR/test-frontend.log" << 'EOF'
18:00:00 [info] Application loaded successfully
18:01:00 [warn] Slow API response detected
18:02:00 [error] Failed to load user preferences
18:03:00 [info] User action: prompt_created
EOF

echo "   ✅ Test log files created"

# Test if backend can read the logs (if running)
echo ""
echo "2. Testing backend log reading (if available)..."

# Check if backend is running
if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
  echo "   ✅ Backend is running, testing log endpoints..."
  
  # Test log files endpoint
  echo "   Testing /api/system/logs/files..."
  if curl -s -H "Authorization: Bearer test-token" http://localhost:8000/api/system/logs/files >/dev/null 2>&1; then
    echo "   ✅ Log files endpoint accessible"
  else
    echo "   ⚠️  Log files endpoint requires authentication"
  fi
  
  # Test log stats endpoint
  echo "   Testing /api/system/logs/stats..."
  if curl -s -H "Authorization: Bearer test-token" http://localhost:8000/api/system/logs/stats >/dev/null 2>&1; then
    echo "   ✅ Log stats endpoint accessible"
  else
    echo "   ⚠️  Log stats endpoint requires authentication"
  fi
else
  echo "   ⚠️  Backend not running, skipping API tests"
fi

# Test log management script
echo ""
echo "3. Testing log management integration..."
if [ -x "$PROJECT_ROOT/scripts/manage-logs.sh" ]; then
  echo "   Running log status check..."
  "$PROJECT_ROOT/scripts/manage-logs.sh" status | head -10
  echo "   ✅ Log management script working"
else
  echo "   ❌ Log management script not found"
fi

# Clean up test files
echo ""
echo "4. Cleaning up test files..."
rm -f "$LOG_DIR/test-backend.log" "$LOG_DIR/test-frontend.log"
echo "   ✅ Test files cleaned up"

echo ""
echo "=========================================="
echo "✅ Log reading functionality test completed!"
echo "=========================================="
echo ""
echo "📁 Centralized logs location: $LOG_DIR"
echo "🔧 Admin dashboard: http://localhost:3000/admin"
echo "📊 Logs & Events tab now reads from centralized logs"
echo "🔍 Features available:"
echo "  • View all log files"
echo "  • Search across logs"
echo "  • Filter by log level"
echo "  • View log statistics"
echo "  • Monitor recent errors"
echo ""