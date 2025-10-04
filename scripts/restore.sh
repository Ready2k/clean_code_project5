#!/bin/bash

# Restore script for Prompt Library system
# This script restores data from backups created by backup.sh

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RESTORE_DIR="${RESTORE_DIR:-/tmp/restore}"

# Database configuration
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-promptlib}"
DB_USER="${POSTGRES_USER}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

# Target directories
DATA_DIR="${DATA_DIR:-/app/data}"
CONFIG_DIR="${CONFIG_DIR:-/app/config}"
LOGS_DIR="${LOGS_DIR:-/app/logs}"
SSL_DIR="${SSL_DIR:-/etc/letsencrypt}"

# Options
FORCE_RESTORE="${FORCE_RESTORE:-false}"
RESTORE_DATABASE="${RESTORE_DATABASE:-true}"
RESTORE_DATA="${RESTORE_DATA:-true}"
RESTORE_CONFIG="${RESTORE_CONFIG:-true}"
RESTORE_SSL="${RESTORE_SSL:-false}"

# Logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS] BACKUP_FILE

Restore Prompt Library system from backup.

OPTIONS:
    -h, --help              Show this help message
    -f, --force             Force restore without confirmation
    --no-database          Skip database restore
    --no-data              Skip data files restore
    --no-config            Skip configuration restore
    --restore-ssl          Include SSL certificates restore
    --backup-dir DIR       Backup directory (default: $BACKUP_DIR)
    --restore-dir DIR      Temporary restore directory (default: $RESTORE_DIR)

EXAMPLES:
    $0 prompt-library-backup-20240101_120000.tar.gz
    $0 --force --no-database backup.tar.gz
    $0 --restore-ssl --backup-dir /custom/backups backup.tar.gz

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -f|--force)
                FORCE_RESTORE="true"
                shift
                ;;
            --no-database)
                RESTORE_DATABASE="false"
                shift
                ;;
            --no-data)
                RESTORE_DATA="false"
                shift
                ;;
            --no-config)
                RESTORE_CONFIG="false"
                shift
                ;;
            --restore-ssl)
                RESTORE_SSL="true"
                shift
                ;;
            --backup-dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            --restore-dir)
                RESTORE_DIR="$2"
                shift 2
                ;;
            -*)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                if [[ -z "${BACKUP_FILE:-}" ]]; then
                    BACKUP_FILE="$1"
                else
                    error "Multiple backup files specified"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    if [[ -z "${BACKUP_FILE:-}" ]]; then
        error "No backup file specified"
        usage
        exit 1
    fi
}

# Validate backup file
validate_backup() {
    log "Validating backup file..."
    
    # Check if backup file exists
    local backup_path
    if [[ "$BACKUP_FILE" == /* ]]; then
        backup_path="$BACKUP_FILE"
    else
        backup_path="${BACKUP_DIR}/${BACKUP_FILE}"
    fi
    
    if [[ ! -f "$backup_path" ]]; then
        error "Backup file not found: $backup_path"
        exit 1
    fi
    
    # Check if it's a valid tar.gz file
    if ! tar -tzf "$backup_path" > /dev/null 2>&1; then
        error "Invalid backup file format"
        exit 1
    fi
    
    BACKUP_PATH="$backup_path"
    log "Backup file validated: $BACKUP_PATH"
}

# Extract backup
extract_backup() {
    log "Extracting backup to: $RESTORE_DIR"
    
    # Create restore directory
    rm -rf "$RESTORE_DIR"
    mkdir -p "$RESTORE_DIR"
    
    # Extract backup
    tar -xzf "$BACKUP_PATH" -C "$RESTORE_DIR"
    
    # Find extracted directory
    local extracted_dir=$(find "$RESTORE_DIR" -maxdepth 1 -type d -name "prompt-library-backup-*" | head -1)
    if [[ -z "$extracted_dir" ]]; then
        error "Could not find extracted backup directory"
        exit 1
    fi
    
    EXTRACTED_DIR="$extracted_dir"
    log "Backup extracted to: $EXTRACTED_DIR"
}

# Verify backup integrity
verify_integrity() {
    log "Verifying backup integrity..."
    
    local checksums_file="${EXTRACTED_DIR}/metadata/checksums.sha256"
    if [[ -f "$checksums_file" ]]; then
        cd "$EXTRACTED_DIR"
        if sha256sum -c metadata/checksums.sha256 --quiet; then
            log "Backup integrity verified"
        else
            error "Backup integrity check failed"
            exit 1
        fi
    else
        log "Warning: No checksums file found, skipping integrity check"
    fi
}

# Show backup information
show_backup_info() {
    log "Backup Information:"
    
    local info_file="${EXTRACTED_DIR}/metadata/backup-info.json"
    if [[ -f "$info_file" ]]; then
        if command -v jq &> /dev/null; then
            jq -r '
                "  Backup Name: " + .backup_name,
                "  Timestamp: " + .timestamp,
                "  Version: " + .version,
                "  Environment: " + .environment,
                "  Hostname: " + .hostname,
                "  Database: " + .database.name + "@" + .database.host,
                "  Size: " + .backup_size
            ' "$info_file"
        else
            cat "$info_file"
        fi
    else
        log "  No backup information available"
    fi
}

# Confirm restore operation
confirm_restore() {
    if [[ "$FORCE_RESTORE" == "true" ]]; then
        return 0
    fi
    
    echo
    log "WARNING: This will overwrite existing data!"
    echo "The following components will be restored:"
    [[ "$RESTORE_DATABASE" == "true" ]] && echo "  - Database ($DB_NAME)"
    [[ "$RESTORE_DATA" == "true" ]] && echo "  - Data files ($DATA_DIR)"
    [[ "$RESTORE_CONFIG" == "true" ]] && echo "  - Configuration ($CONFIG_DIR)"
    [[ "$RESTORE_SSL" == "true" ]] && echo "  - SSL certificates ($SSL_DIR)"
    echo
    
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        exit 0
    fi
}

# Stop services
stop_services() {
    log "Stopping services..."
    
    # Try to stop services gracefully
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.prod.yml stop backend frontend || true
    elif command -v systemctl &> /dev/null; then
        systemctl stop prompt-library-backend || true
        systemctl stop prompt-library-frontend || true
    fi
    
    # Wait a moment for services to stop
    sleep 5
}

# Restore database
restore_database() {
    if [[ "$RESTORE_DATABASE" != "true" ]]; then
        log "Skipping database restore"
        return 0
    fi
    
    log "Restoring database..."
    
    local db_backup_custom="${EXTRACTED_DIR}/database/database.sql.custom"
    local db_backup_plain="${EXTRACTED_DIR}/database/database.sql.gz"
    
    export PGPASSWORD="$DB_PASSWORD"
    
    # Try custom format first, then plain SQL
    if [[ -f "$db_backup_custom" ]]; then
        log "Restoring from custom format backup..."
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --clean --if-exists --no-owner --no-privileges \
            "$db_backup_custom"; then
            log "Database restored successfully from custom format"
        else
            error "Database restore from custom format failed"
            return 1
        fi
    elif [[ -f "$db_backup_plain" ]]; then
        log "Restoring from plain SQL backup..."
        if gunzip -c "$db_backup_plain" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; then
            log "Database restored successfully from plain SQL"
        else
            error "Database restore from plain SQL failed"
            return 1
        fi
    else
        error "No database backup found"
        return 1
    fi
    
    unset PGPASSWORD
}

# Restore data files
restore_data() {
    if [[ "$RESTORE_DATA" != "true" ]]; then
        log "Skipping data files restore"
        return 0
    fi
    
    log "Restoring data files..."
    
    local data_backup="${EXTRACTED_DIR}/data/prompt-data.tar.gz"
    if [[ -f "$data_backup" ]]; then
        # Backup existing data
        if [[ -d "$DATA_DIR" ]]; then
            log "Backing up existing data to ${DATA_DIR}.backup.$(date +%s)"
            mv "$DATA_DIR" "${DATA_DIR}.backup.$(date +%s)"
        fi
        
        # Create parent directory
        mkdir -p "$(dirname "$DATA_DIR")"
        
        # Extract data
        tar -xzf "$data_backup" -C "$(dirname "$DATA_DIR")"
        log "Data files restored successfully"
    else
        log "Warning: No data backup found"
    fi
}

# Restore configuration
restore_config() {
    if [[ "$RESTORE_CONFIG" != "true" ]]; then
        log "Skipping configuration restore"
        return 0
    fi
    
    log "Restoring configuration..."
    
    local config_backup="${EXTRACTED_DIR}/config/config.tar.gz"
    if [[ -f "$config_backup" ]]; then
        # Backup existing config
        if [[ -d "$CONFIG_DIR" ]]; then
            log "Backing up existing config to ${CONFIG_DIR}.backup.$(date +%s)"
            mv "$CONFIG_DIR" "${CONFIG_DIR}.backup.$(date +%s)"
        fi
        
        # Create parent directory
        mkdir -p "$(dirname "$CONFIG_DIR")"
        
        # Extract config
        tar -xzf "$config_backup" -C "$(dirname "$CONFIG_DIR")"
        log "Configuration restored successfully"
    else
        log "Warning: No configuration backup found"
    fi
}

# Restore SSL certificates
restore_ssl() {
    if [[ "$RESTORE_SSL" != "true" ]]; then
        log "Skipping SSL certificates restore"
        return 0
    fi
    
    log "Restoring SSL certificates..."
    
    local ssl_backup="${EXTRACTED_DIR}/ssl/ssl-certs.tar.gz"
    if [[ -f "$ssl_backup" ]]; then
        # Backup existing SSL
        if [[ -d "$SSL_DIR" ]]; then
            log "Backing up existing SSL to ${SSL_DIR}.backup.$(date +%s)"
            mv "$SSL_DIR" "${SSL_DIR}.backup.$(date +%s)"
        fi
        
        # Create parent directory
        mkdir -p "$(dirname "$SSL_DIR")"
        
        # Extract SSL
        tar -xzf "$ssl_backup" -C "$(dirname "$SSL_DIR")"
        log "SSL certificates restored successfully"
    else
        log "Warning: No SSL backup found"
    fi
}

# Set proper permissions
set_permissions() {
    log "Setting proper permissions..."
    
    # Set data directory permissions
    if [[ -d "$DATA_DIR" ]]; then
        chown -R 1001:1001 "$DATA_DIR" 2>/dev/null || true
        chmod -R 755 "$DATA_DIR" 2>/dev/null || true
    fi
    
    # Set config directory permissions
    if [[ -d "$CONFIG_DIR" ]]; then
        chown -R 1001:1001 "$CONFIG_DIR" 2>/dev/null || true
        chmod -R 644 "$CONFIG_DIR" 2>/dev/null || true
    fi
    
    # Set SSL permissions
    if [[ -d "$SSL_DIR" ]]; then
        chown -R root:root "$SSL_DIR" 2>/dev/null || true
        chmod -R 600 "$SSL_DIR" 2>/dev/null || true
    fi
}

# Start services
start_services() {
    log "Starting services..."
    
    if command -v docker-compose &> /dev/null; then
        docker-compose -f docker-compose.prod.yml up -d
    elif command -v systemctl &> /dev/null; then
        systemctl start prompt-library-backend || true
        systemctl start prompt-library-frontend || true
    fi
    
    # Wait for services to start
    sleep 10
    
    log "Services started"
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "$RESTORE_DIR"
}

# Main restore function
main() {
    local start_time=$(date +%s)
    
    log "Starting restore process"
    
    parse_args "$@"
    validate_backup
    extract_backup
    verify_integrity
    show_backup_info
    confirm_restore
    
    stop_services
    
    # Execute restore steps
    if restore_database && \
       restore_data && \
       restore_config && \
       restore_ssl && \
       set_permissions; then
        
        start_services
        cleanup
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "Restore completed successfully in ${duration}s"
        exit 0
    else
        error "Restore failed"
        exit 1
    fi
}

# Handle signals
trap 'error "Restore interrupted"; cleanup; exit 1' INT TERM

# Run main function
main "$@"