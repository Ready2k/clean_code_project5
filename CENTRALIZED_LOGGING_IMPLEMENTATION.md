# Centralized Logging Implementation

## Overview
Successfully implemented centralized logging for the Prompt Library platform. All logs are now stored in the `./logs/` directory at the project root for easy monitoring and management.

## Changes Made

### 1. Backend Logger Configuration (`interface/backend/src/utils/logger.ts`)
- Updated `logsDir` to use centralized `./logs/` directory
- Added automatic directory creation
- Enabled file logging for all environments (not just production)
- Renamed log files with `backend-` prefix for clarity:
  - `backend-combined.log` - All backend logs
  - `backend-error.log` - Error logs only
  - `backend-audit.log` - Security/audit events
  - `backend-performance.log` - Performance metrics
  - `backend-security.log` - Security events

### 2. Frontend Logger (`interface/frontend/src/utils/logger.ts`)
- Created comprehensive frontend logging utility
- Supports structured logging with JSON format
- Buffers logs and sends to backend in production
- Provides convenience functions for different log types
- Includes performance, user action, and API call logging

### 3. Backend Log Endpoint (`interface/backend/src/routes/logs.ts`)
- Added `/api/v1/logs/frontend` endpoint for single log entries
- Added `/api/v1/logs/frontend/batch` endpoint for batch log processing
- Integrated with main backend router
- Processes frontend logs and routes to appropriate backend log levels

### 4. Script Updates
- Updated `scripts/start.sh` to set `LOGS_DIR` environment variable
- Modified `interface/package.json` scripts to use centralized logging
- All npm scripts now pipe output to centralized log files

### 5. Environment Configuration
- Updated `.env.example` and `.env.development` files
- Added `LOGS_DIR`, `MAX_LOG_SIZE_MB`, `MAX_LOG_AGE_DAYS` variables
- Enabled file logging by default

### 6. Log Management Tools
- Created `scripts/manage-logs.sh` for comprehensive log management:
  - `status` - Show log directory status and file sizes
  - `rotate` - Rotate large log files
  - `cleanup` - Remove old log files
  - `maintain` - Run full maintenance (rotate + cleanup)
  - `tail` - Tail specific log files
- Created `scripts/test-logging.sh` to verify logging setup
- Created `scripts/cron-log-maintenance.sh` for automated maintenance

### 7. Documentation
- Created `logs/README.md` with comprehensive logging documentation
- Updated main `README.md` with logging and monitoring section
- Documented log formats, management commands, and troubleshooting

### 8. File Organization
- Moved existing scattered log files to centralized location
- Cleaned up old log files from interface directories
- Maintained `.gitignore` entries to exclude log files from version control

## Log File Structure

```
logs/
├── README.md                    # Logging documentation
├── backend-combined.log         # All backend logs
├── backend-error.log           # Backend errors only
├── backend-audit.log           # Security/audit events
├── backend-performance.log     # Performance metrics
├── backend-security.log        # Security events
├── frontend.log                # Frontend application logs
├── startup.log                 # Application startup logs
└── archive/                    # Compressed rotated logs
    ├── backend-combined.log.20250104_120000.gz
    └── ...
```

## Usage Examples

### Real-time Monitoring
```bash
# Watch all backend activity
tail -f logs/backend-combined.log

# Watch errors across all services
tail -f logs/backend-error.log logs/frontend.log

# Monitor startup process
tail -f logs/startup.log
```

### Log Management
```bash
# Check log status
./scripts/manage-logs.sh status

# Rotate large logs
./scripts/manage-logs.sh rotate

# Clean up logs older than 7 days
./scripts/manage-logs.sh cleanup 7

# Tail specific log
./scripts/manage-logs.sh tail backend
```

### Automated Maintenance
```bash
# Add to crontab for daily maintenance at 2 AM
0 2 * * * /path/to/project/scripts/cron-log-maintenance.sh
```

## Benefits

1. **Centralized Management** - All logs in one location (`./logs/`)
2. **Easy Monitoring** - Simple commands to tail and analyze logs
3. **Automatic Rotation** - Prevents disk space issues
4. **Structured Logging** - JSON format for easy parsing and analysis
5. **Security Logging** - Dedicated audit and security event tracking
6. **Performance Monitoring** - Dedicated performance metrics logging
7. **Frontend Integration** - Frontend logs sent to backend for centralization
8. **Production Ready** - Automatic log management and archival

## Security Considerations

- Log files may contain sensitive information
- Proper file permissions maintained
- Regular rotation and cleanup prevents data accumulation
- Security events tracked in dedicated audit logs
- No log files committed to version control

## Next Steps

1. **Monitoring Integration** - Consider integrating with log aggregation tools (ELK stack, Splunk, etc.)
2. **Alerting** - Set up alerts for error patterns or security events
3. **Log Analysis** - Implement automated log analysis for anomaly detection
4. **Retention Policies** - Fine-tune log retention based on compliance requirements
5. **Performance Optimization** - Monitor logging performance impact in production

## Testing

Run the test script to verify everything is working:
```bash
./scripts/test-logging.sh
```

This implementation provides a robust, scalable logging solution that meets enterprise requirements while remaining easy to use and maintain.