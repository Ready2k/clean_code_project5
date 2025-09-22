# Installation and Deployment Guide

This guide provides comprehensive instructions for installing and deploying the Prompt Library Professional Interface in various environments.

## System Requirements

### Minimum Hardware Requirements

#### Development Environment
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB
- **Storage**: 20 GB available space
- **Network**: Broadband internet connection

#### Production Environment
- **CPU**: 4 cores, 2.5 GHz (8 cores recommended)
- **RAM**: 8 GB (16 GB recommended)
- **Storage**: 100 GB SSD (500 GB recommended)
- **Network**: High-speed internet with low latency

#### High Availability Production
- **CPU**: 8+ cores per node, 3.0 GHz
- **RAM**: 16+ GB per node
- **Storage**: 500+ GB SSD with RAID configuration
- **Network**: Redundant network connections
- **Load Balancer**: Hardware or software load balancer

### Software Requirements

#### Operating System
- **Linux**: Ubuntu 20.04+, CentOS 8+, RHEL 8+
- **macOS**: 10.15+ (development only)
- **Windows**: Windows Server 2019+ (with WSL2)

#### Container Runtime
- **Docker**: 20.10+
- **Docker Compose**: 1.29+
- **Kubernetes**: 1.21+ (for K8s deployment)

#### Database
- **PostgreSQL**: 13+ (for user data and metadata)
- **Redis**: 6.0+ (for caching and sessions)

#### Web Server
- **Nginx**: 1.18+ (reverse proxy and SSL termination)

## Pre-Installation Setup

### 1. System Preparation

#### Update System Packages
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y

# Install essential tools
sudo apt install -y curl wget git unzip
```

#### Configure Firewall
```bash
# Allow HTTP and HTTPS traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (adjust port as needed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

### 2. Docker Installation

#### Install Docker Engine
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
```

#### Install Docker Compose
```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### 3. SSL Certificate Setup

#### Option A: Let's Encrypt (Recommended for Production)
```bash
# Install Certbot
sudo apt install -y certbot

# Generate certificate (replace with your domain)
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Certificates will be stored in /etc/letsencrypt/live/your-domain.com/
```

#### Option B: Self-Signed Certificate (Development)
```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/private

# Generate private key
sudo openssl genrsa -out /etc/ssl/private/prompt-library.key 2048

# Generate certificate
sudo openssl req -new -x509 -key /etc/ssl/private/prompt-library.key -out /etc/ssl/certs/prompt-library.crt -days 365
```

## Installation Methods

## Method 1: Docker Compose Deployment (Recommended)

### 1. Download and Configure

```bash
# Clone the repository
git clone <repository-url>
cd prompt-library-interface

# Copy environment template
cp .env.example .env
```

### 2. Environment Configuration

Edit the `.env` file with your specific configuration:

```bash
# Application Configuration
NODE_ENV=production
PORT=8000
FRONTEND_PORT=3000

# Database Configuration
DATABASE_URL=postgresql://promptlib:secure_password@postgres:5432/promptlib
REDIS_URL=redis://redis:6379

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Storage
STORAGE_DIR=/app/data
MAX_FILE_SIZE=10485760

# External Services (Optional)
OPENAI_API_KEY=your-openai-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true

# Security
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SSL Configuration
SSL_CERT_PATH=/etc/ssl/certs/prompt-library.crt
SSL_KEY_PATH=/etc/ssl/private/prompt-library.key
```

### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - REACT_APP_API_URL=https://your-domain.com/api
      - REACT_APP_WS_URL=wss://your-domain.com
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=promptlib
      - POSTGRES_USER=promptlib
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - app-network

  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana:/etc/grafana/provisioning
    networks:
      - monitoring
      - app-network

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  app-network:
    driver: bridge
  monitoring:
    driver: bridge
```

### 4. Deploy the Application

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
sleep 30

# Initialize database
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed

# Create initial admin user
docker-compose -f docker-compose.prod.yml exec backend npm run create-admin -- \
  --username admin \
  --email admin@your-domain.com \
  --password secure_admin_password

# Verify deployment
docker-compose -f docker-compose.prod.yml ps
```

## Method 2: Kubernetes Deployment

### 1. Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 2. Create Kubernetes Manifests

Create `k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: prompt-library
```

Create `k8s/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: prompt-library
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  REDIS_URL: "redis://redis-service:6379"
  DATABASE_URL: "postgresql://promptlib:password@postgres-service:5432/promptlib"
```

Create `k8s/secrets.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: prompt-library
type: Opaque
data:
  JWT_SECRET: <base64-encoded-jwt-secret>
  ENCRYPTION_KEY: <base64-encoded-encryption-key>
  DB_PASSWORD: <base64-encoded-db-password>
```

### 3. Deploy to Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Wait for deployment
kubectl wait --for=condition=available --timeout=300s deployment/backend -n prompt-library

# Initialize database
kubectl exec -it deployment/backend -n prompt-library -- npm run db:migrate
kubectl exec -it deployment/backend -n prompt-library -- npm run db:seed

# Create admin user
kubectl exec -it deployment/backend -n prompt-library -- npm run create-admin
```

## Method 3: Manual Installation

### 1. Install Node.js and Dependencies

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx
```

### 2. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE promptlib;
CREATE USER promptlib WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE promptlib TO promptlib;
\q
```

### 3. Application Setup

```bash
# Clone and build backend
git clone <repository-url>
cd prompt-library-interface/backend
npm install
npm run build

# Clone and build frontend
cd ../frontend
npm install
npm run build

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start backend
cd ../backend
npm start &

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/prompt-library
sudo ln -s /etc/nginx/sites-available/prompt-library /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Post-Installation Configuration

### 1. Verify Installation

```bash
# Check service status
docker-compose ps  # For Docker deployment
kubectl get pods -n prompt-library  # For Kubernetes

# Test API endpoints
curl -k https://your-domain.com/api/system/health

# Test frontend
curl -k https://your-domain.com
```

### 2. Configure Monitoring

```bash
# Access Grafana (if deployed)
# URL: https://your-domain.com:3000
# Default credentials: admin / (password from .env)

# Import dashboards
# - Application metrics dashboard
# - System metrics dashboard
# - Business metrics dashboard
```

### 3. Set Up Backups

```bash
# Create backup script
sudo tee /usr/local/bin/backup-prompt-library.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Database backup
docker-compose exec -T postgres pg_dump -U promptlib promptlib > "$BACKUP_DIR/database.sql"

# File backup
tar -czf "$BACKUP_DIR/files.tar.gz" ./data

# Configuration backup
tar -czf "$BACKUP_DIR/config.tar.gz" .env docker-compose.yml nginx/

echo "Backup completed: $BACKUP_DIR"
EOF

sudo chmod +x /usr/local/bin/backup-prompt-library.sh

# Schedule daily backups
echo "0 2 * * * /usr/local/bin/backup-prompt-library.sh" | sudo crontab -
```

### 4. Configure Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/prompt-library << 'EOF'
/var/log/prompt-library/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    postrotate
        docker-compose restart nginx
    endscript
}
EOF
```

## Troubleshooting Installation Issues

### Common Issues and Solutions

#### Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in, or run:
newgrp docker
```

#### Port Already in Use
```bash
# Check what's using the port
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443

# Stop conflicting services
sudo systemctl stop apache2  # If Apache is running
```

#### Database Connection Failed
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Verify database credentials in .env
# Ensure database is fully initialized before starting backend
```

#### SSL Certificate Issues
```bash
# Verify certificate files exist and are readable
ls -la /etc/ssl/certs/prompt-library.crt
ls -la /etc/ssl/private/prompt-library.key

# Test certificate validity
openssl x509 -in /etc/ssl/certs/prompt-library.crt -text -noout
```

#### Memory Issues
```bash
# Check available memory
free -h

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Getting Help

If you encounter issues during installation:

1. **Check the logs**: `docker-compose logs` or `kubectl logs`
2. **Verify configuration**: Double-check all environment variables
3. **Test connectivity**: Ensure all required ports are accessible
4. **Review documentation**: Check the troubleshooting guide
5. **Contact support**: Provide logs and configuration details

---

*Next: Continue with [System Configuration](configuration.md) to customize your installation.*