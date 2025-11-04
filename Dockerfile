# Root Dockerfile for the entire Prompt Library project
# This builds both the core library and the web interface

FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    dumb-init \
    curl \
    git \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy root package.json
COPY package*.json ./

# Install root dependencies
RUN npm ci --only=production --silent

# Copy core library source
COPY src ./src

# Build stage for interface
FROM base AS interface-builder

# Copy interface workspace
COPY interface ./interface

# Install interface dependencies
WORKDIR /app/interface
RUN npm run install:all

# Build frontend first
RUN npm run build:frontend

# Build backend with explicit working directory
WORKDIR /app/interface/backend
RUN npm run build
WORKDIR /app/interface

# Production stage
FROM node:18-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy built application and dependencies
COPY --from=interface-builder /app/interface/backend/dist ./backend
COPY --from=interface-builder /app/interface/frontend/dist ./frontend
COPY --from=interface-builder /app/interface/backend/package*.json ./backend/

# Copy core library source
COPY --from=base /app/src ./src

# Install production dependencies in the final stage
WORKDIR /app/backend
RUN npm install --only=production --silent && npm cache clean --force

WORKDIR /app

# Create directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set environment variables for proper paths
ENV LOGS_DIR=/app/logs
ENV STORAGE_DIR=/app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/system/health || exit 1

EXPOSE 8000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/index.js"]