# Multi-stage build for Node.js backend
FROM node:18-alpine as base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Development stage
FROM base as development
RUN npm ci
COPY . .
EXPOSE 8000
CMD ["npm", "run", "dev"]

# Build stage
FROM base as build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine as production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001
USER backend

EXPOSE 8000
CMD ["npm", "start"]