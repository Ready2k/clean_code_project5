# Multi-stage build for production backend
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --silent

# Copy source code
COPY backend/src ./src

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY backend/package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy necessary files
COPY backend/config ./config

# Create directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8000/api/system/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 8000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]