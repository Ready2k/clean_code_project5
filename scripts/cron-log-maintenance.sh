#!/bin/bash
#
# Cron job script for automated log maintenance
# Add to crontab with: crontab -e
# Example: 0 2 * * * /path/to/this/script
#

set -Eeuo pipefail

# Get script directory and project root
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd)"

# Change to project directory
cd "$PROJECT_ROOT"

# Run log maintenance
"$SCRIPT_DIR/manage-logs.sh" maintain

# Log the maintenance run
echo "$(date): Automated log maintenance completed" >> logs/maintenance.log