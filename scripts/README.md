# Prompt Library Application Management Scripts

This directory contains robust scripts for managing the entire Prompt Library application stack.

## 📋 Available Scripts

### 🚀 `start.sh` - Application Startup
Starts all services in the correct order with comprehensive health checks.

```bash
./scripts/start.sh
```

**What it does:**
1. **Prerequisites Check**: Verifies Docker is running, builds are available
2. **Docker Services**: Starts PostgreSQL and Redis containers
3. **Health Checks**: Waits for database services to be ready
4. **Backend API**: Starts the Node.js backend service
5. **API Verification**: Confirms backend health endpoint responds
6. **Frontend**: Starts the React frontend application
7. **Final Verification**: Ensures all services are operational

**Features:**
- ✅ Comprehensive health checks with timeouts
- ✅ Automatic build detection and creation
- ✅ Process ID tracking for clean shutdown
- ✅ Detailed logging to `logs/` directory
- ✅ Color-coded status messages
- ✅ Graceful error handling and cleanup

### 🛑 `stop.sh` - Application Shutdown
Gracefully stops all services in reverse order.

```bash
./scripts/stop.sh
```

**What it does:**
1. **Frontend Shutdown**: Stops React development server
2. **Backend Shutdown**: Gracefully terminates Node.js API server
3. **Docker Shutdown**: Stops PostgreSQL and Redis containers
4. **Process Cleanup**: Removes PID files and temporary data
5. **Verification**: Confirms all services are stopped

**Features:**
- ✅ Graceful shutdown with SIGTERM before SIGKILL
- ✅ Configurable timeout for graceful shutdown
- ✅ Fallback process pattern matching
- ✅ Port availability verification
- ✅ Comprehensive cleanup

### 🔄 `restart.sh` - Application Restart
Combines stop and start operations with safety checks.

```bash
./scripts/restart.sh [OPTIONS]
```

**Options:**
- `-f, --force`: Force restart even if services appear stopped
- `--skip-checks`: Skip preliminary checks for faster restart
- `-h, --help`: Show help information

**What it does:**
1. **Stop Phase**: Executes complete shutdown
2. **Cleanup Wait**: Allows system cleanup time
3. **Start Phase**: Executes complete startup
4. **Verification**: Confirms successful restart

**Features:**
- ✅ Intelligent error handling between phases
- ✅ Progress indicators with countdown timers
- ✅ Interrupt handling for safe cancellation
- ✅ Force restart option for stuck services

### 📊 `status.sh` - Service Status Check
Provides comprehensive status information for all services.

```bash
./scripts/status.sh [OPTIONS]
```

**Options:**
- `--quiet`: Show only basic service status
- `--help`: Show help information

**What it shows:**
- 🐳 Docker service status (PostgreSQL, Redis)
- 🚀 Application service status (Backend, Frontend)
- 🔗 Service URLs and endpoints
- 📝 Log file information and sizes
- 💻 Resource usage (CPU, Memory)
- 🛠️ Management command suggestions

## 🔧 Configuration

### Environment Variables
The scripts respect these environment variables:

```bash
# Service Ports
BACKEND_PORT=8000          # Backend API port
FRONTEND_PORT=3000         # Frontend development server port
POSTGRES_PORT=5432         # PostgreSQL database port
REDIS_PORT=6379           # Redis cache port

# Timeouts
MAX_WAIT_TIME=60          # Maximum wait time for service startup
GRACEFUL_SHUTDOWN_TIMEOUT=10  # Graceful shutdown timeout
```

### Directory Structure
```
prompt-library/
├── scripts/
│   ├── start.sh          # Startup script
│   ├── stop.sh           # Shutdown script
│   ├── restart.sh        # Restart script
│   ├── status.sh         # Status check script
│   ├── health-check.sh   # Health verification script
│   └── README.md         # This file
├── logs/
│   ├── backend.log       # Backend service logs
│   ├── frontend.log      # Frontend service logs
│   └── startup.log       # Startup/shutdown events
├── interface/
│   ├── .backend.pid      # Backend process ID (created at runtime)
│   ├── .frontend.pid     # Frontend process ID (created at runtime)
│   └── docker-compose.dev.yml  # Docker services configuration
└── package.json          # Root package.json with script shortcuts
```

## 🚨 Troubleshooting

### Common Issues

**Docker not running:**
```bash
# Start Docker Desktop first, then:
./scripts/start.sh
```

**Ports already in use:**
```bash
# Check what's using the ports:
lsof -i :3000 -i :8000 -i :5432 -i :6379

# Stop conflicting services:
./scripts/stop.sh
```

**Services won't start:**
```bash
# Check logs for errors:
tail -f logs/backend.log
tail -f logs/frontend.log

# Try a clean restart:
./scripts/stop.sh
./scripts/start.sh
```

**Partial service failure:**
```bash
# Check current status:
./scripts/status.sh

# Force restart all services:
./scripts/restart.sh --force
```

### Manual Recovery Commands

If scripts fail, you can manually recover:

```bash
# Kill all processes
pkill -f "node backend/dist/index.js"
pkill -f "vite.*--port 3000"

# Stop Docker services
docker-compose -f ../docker-compose.yml down

# Clean up PID files
rm -f .backend.pid .frontend.pid

# Start fresh
./scripts/start.sh
```

## 📝 Logging

All scripts provide detailed logging:

- **Console Output**: Color-coded status messages with timestamps
- **Log Files**: Persistent logs in `logs/` directory
- **Process Tracking**: PID files for clean process management
- **Startup Events**: Major events logged to `startup.log`

### Viewing Logs
```bash
# Real-time backend logs
tail -f logs/backend.log

# Real-time frontend logs
tail -f logs/frontend.log

# Startup/shutdown events
tail -f logs/startup.log

# All logs combined
tail -f logs/*.log
```

## 🔒 Security Features

- **Process Isolation**: Each service runs with proper process separation
- **Graceful Shutdown**: SIGTERM before SIGKILL for data integrity
- **PID Tracking**: Prevents orphaned processes
- **Port Verification**: Ensures services bind to expected ports
- **Health Checks**: Verifies service functionality, not just process existence

## 🎯 Best Practices

1. **Always use the scripts** instead of manual commands
2. **Check status** before starting: `./scripts/status.sh`
3. **Monitor logs** during development: `tail -f logs/backend.log`
4. **Clean shutdown** before system restart: `./scripts/stop.sh`
5. **Use restart** for configuration changes: `./scripts/restart.sh`

## 🆘 Support

If you encounter issues:

1. Check the status: `./scripts/status.sh`
2. Review logs in `logs/` directory
3. Try a clean restart: `./scripts/restart.sh --force`
4. Check Docker Desktop is running
5. Verify no other services are using the required ports

For additional help, check the main project README.md or application documentation.