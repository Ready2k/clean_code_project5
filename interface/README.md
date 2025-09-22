# Professional Interface for Prompt Library

This directory contains the professional web interface for the Prompt Library system, providing comprehensive management capabilities for LLM connections, prompt lifecycle management, and user administration.

## Structure

- `frontend/` - React TypeScript application
- `backend/` - Node.js Express API server
- `shared/` - Shared types and utilities
- `docker/` - Docker configurations
- `docs/` - Interface-specific documentation

## Quick Start

### Development

```bash
# Install dependencies for both frontend and backend
npm run install:all

# Start development servers
npm run dev

# Run tests
npm run test
```

### Production

```bash
# Build all components
npm run build

# Start with Docker
docker-compose up -d
```

## Architecture

The interface is built as a modern web application with:

- **Frontend**: React 18 + TypeScript + Redux Toolkit + Material-UI
- **Backend**: Node.js + Express + TypeScript + JWT Authentication
- **Integration**: Direct integration with existing Prompt Library services
- **Database**: Optional PostgreSQL for user data, Redis for sessions
- **Deployment**: Docker containers with Nginx reverse proxy

## Features

- 🔐 User authentication and role-based access control
- 🤖 LLM connection management (OpenAI, AWS Bedrock)
- 📝 Comprehensive prompt management interface
- ✨ AI-powered prompt enhancement workflow
- 🎯 Multi-provider prompt rendering
- ⭐ Rating and evaluation system
- 📊 System monitoring and administration
- 📱 Responsive design with accessibility support

## Development

See individual README files in `frontend/` and `backend/` directories for specific development instructions.