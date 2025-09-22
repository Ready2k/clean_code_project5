# Multi-stage build for production frontend
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production --silent

# Copy source code
COPY frontend/src ./src
COPY frontend/public ./public
COPY frontend/index.html ./
COPY frontend/vite.config.ts ./

# Build application
RUN npm run build

# Production stage
FROM nginx:1.24-alpine

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]