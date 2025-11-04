# Multi-stage build for Node.js backend
FROM node:18-alpine as base

# Install security updates and required packages
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --silent

# Development stage
FROM base as development
COPY . .
EXPOSE 8000
CMD ["npm", "run", "dev"]

# Build stage
FROM base as build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine as production

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

# Copy package files
COPY package*.json ./
RUN npm install --production --silent && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist
# Copy migration files
COPY --from=build /app/src/migrations ./dist/migrations

# Create directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/temp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 8000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]