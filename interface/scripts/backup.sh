#!/bin/bash

# Backup script for Prompt Library system
# This script creates backups of all critical data including:
# - PostgreSQL database
# - Prompt data files
# - Configuration files
# - SSL certificates

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="prompt-library-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Database configuration
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-promptlib}"
DB_USER="${POSTGRES_USER}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Directories to backup
DATA_DIR="${DATA_DIR:-/app/data}"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"
LOGS_DIR="${LOGS_DIR:-/app/logs}"
SSL_DIR="${SSL_DIR:-/etc/letsencrypt}"

# Notification settings
WEBHOOK_URL="${BACKUP_WEBHOOK_URL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "${BACKUP_DIR}/backup.log" >&2
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" \
            --max-time 10 --silent || true
    fi
    
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        [[ "$status" == "error" ]] && color="danger"
        [[ "$status" == "warning" ]] && color="warning"
        
        curl -X POST "$SLACK_WEBHOOK" \
            -H "Content-Type: application/json" \
            -d "{\"attachments\": [{\"color\": \"$color\", \"title\": \"Backup $status\", \"text\": \"$message\", \"ts\": $(date +%s)}]}" \
            --max-time 10 --silent || true
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if required commands exist
    for cmd in pg_dump tar gzip; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Check if backup directory exists
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # Check disk space (require at least 1GB free)
    local available_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then
        error "Insufficient disk space. Available: ${available_space}KB, Required: 1GB"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Create backup directory structure
create_backup_structure() {
    log "Creating backup structure: $BACKUP_PATH"
    mkdir -p "$BACKUP_PATH"/{database,data,config,logs,ssl,metadata}
}

# Backup PostgreSQL database
backup_database() {
    log "Starting database backup..."
    
    local db_backup_file="${BACKUP_PATH}/database/database.sql"
    
    # Set password for pg_dump
    export PGPASSWORD="$DB_PASSWORD"
    
    # Create database backup with compression
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --no-owner --no-privileges --clean --if-exists \
        --format=custom --compress=9 \
        --file="${db_backup_file}.custom"; then
        
        # Also create a plain SQL backup for easier restoration
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --no-owner --no-privileges --clean --if-exists \
            --format=plain | gzip > "${db_backup_file}.gz"
        
        log "Database backup completed successfully"
    else
        error "Database backup failed"
        return 1
    fi
    
    unset PGPASSWORD
}

# Backup data files
backup_data() {
    log "Starting data backup..."
    
    if [[ -d "$DATA_DIR" ]]; then
        tar -czf "${BACKUP_PATH}/data/prompt-data.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
        log "Data backup completed"
    else
        log "Warning: Data directory not found: $DATA_DIR"
    fi
}

# Backup configuration files
backup_config() {
    log "Starting configuration backup..."
    
    if [[ -d "$CONFIG_DIR" ]]; then
        tar -czf "${BACKUP_PATH}/config/config.tar.gz" -C "$(dirname "$CONFIG_DIR")" "$(basename "$CONFIG_DIR")"
        log "Configuration backup completed"
    else
        log "Warning: Configuration directory not found: $CONFIG_DIR"
    fi
}

# Backup logs (last 7 days only)
backup_logs() {
    log "Starting logs backup..."
    
    if [[ -d "$LOGS_DIR" ]]; then
        # Only backup recent logs to save space
        find "$LOGS_DIR" -name "*.log" -mtime -7 -print0 | \
            tar -czf "${BACKUP_PATH}/logs/recent-logs.tar.gz" --null -T -
        log "Logs backup completed"
    else
        log "Warning: Logs directory not found: $LOGS_DIR"
    fi
}

# Backup SSL certificates
backup_ssl() {
    log "Starting SSL certificates backup..."
    
    if [[ -d "$SSL_DIR" ]]; then
        tar -czf "${BACKUP_PATH}/ssl/ssl-certs.tar.gz" -C "$(dirname "$SSL_DIR")" "$(basename "$SSL_DIR")"
        log "SSL certificates backup completed"
    else
        log "Warning: SSL directory not found: $SSL_DIR"
    fi
}

# Create backup metadata
create_metadata() {
    log "Creating backup metadata..."
    
    cat > "${BACKUP_PATH}/metadata/backup-info.json" << EOF
{
    "backup_name": "$BACKUP_NAME",
    "timestamp": "$(date -Iseconds)",
    "version": "${APP_VERSION:-unknown}",
    "environment": "${NODE_ENV:-unknown}",
    "hostname": "$(hostname)",
    "database": {
        "host": "$DB_HOST",
        "port": "$DB_PORT",
        "name": "$DB_NAME",
        "user": "$DB_USER"
    },
    "directories": {
        "data": "$DATA_DIR",
        "config": "$CONFIG_DIR",
        "logs": "$LOGS_DIR",
        "ssl": "$SSL_DIR"
    },
    "backup_size": "$(du -sh "$BACKUP_PATH" | cut -f1)"
}
EOF

    # Create checksums for integrity verification
    find "$BACKUP_PATH" -type f -exec sha256sum {} \; > "${BACKUP_PATH}/metadata/checksums.sha256"
    
    log "Backup metadata created"
}

# Compress final backup
compress_backup() {
    log "Compressing backup archive..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    # Remove uncompressed directory
    rm -rf "$BACKUP_NAME"
    
    local final_size=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
    log "Backup compressed successfully. Final size: $final_size"
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    find "$BACKUP_DIR" -name "prompt-library-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    local remaining_backups=$(find "$BACKUP_DIR" -name "prompt-library-backup-*.tar.gz" | wc -l)
    log "Cleanup completed. Remaining backups: $remaining_backups"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."
    
    local backup_file="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
    
    # Test archive integrity
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        log "Backup archive integrity verified"
        return 0
    else
        error "Backup archive integrity check failed"
        return 1
    fi
}

# Main backup function
main() {
    local start_time=$(date +%s)
    
    log "Starting backup process: $BACKUP_NAME"
    send_notification "info" "Backup process started: $BACKUP_NAME"
    
    # Execute backup steps
    if check_prerequisites && \
       create_backup_structure && \
       backup_database && \
       backup_data && \
       backup_config && \
       backup_logs && \
       backup_ssl && \
       create_metadata && \
       compress_backup && \
       verify_backup; then
        
        cleanup_old_backups
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local final_size=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
        
        log "Backup completed successfully in ${duration}s. Size: $final_size"
        send_notification "success" "Backup completed successfully: $BACKUP_NAME (${duration}s, $final_size)"
        
        exit 0
    else
        error "Backup failed"
        send_notification "error" "Backup failed: $BACKUP_NAME"
        exit 1
    fi
}

# Handle signals
trap 'error "Backup interrupted"; send_notification "error" "Backup interrupted: $BACKUP_NAME"; exit 1' INT TERM

# Run main function
main "$@"