# Multi-stage build for React frontend
FROM node:18-alpine as base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Development stage
FROM base as development
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Build stage
FROM base as build
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine as production
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]