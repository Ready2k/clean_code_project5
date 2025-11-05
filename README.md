# Prompt Library Professional Interface

A comprehensive web-based interface for managing AI prompts across multiple providers (OpenAI, AWS Bedrock, etc.) with advanced features like AI-powered enhancement, multi-provider rendering, and collaborative workflows.

## 🚀 Quick Start

### What You'll See
- **Interactive Dashboard** with system metrics
- **Prompt Library** with sample prompts you can browse and edit
- **Connection Management** for AI providers
- **User Settings** and preferences
- **Fully responsive design** that works on mobile/tablet

### Recent Updates ✨ (v1.2.0)
- **🎯 LLM Prompt Templates Interface** - Complete admin interface overhaul with working tabs
- **📊 Analytics Dashboard** - Robust analytics with graceful empty data handling
- **🔧 API Improvements** - Flexible timeRange parameters (1d, 7d, 30d, 90d) for analytics
- **🛡️ Error Prevention** - Comprehensive null safety and division by zero protection
- **🎨 User Experience** - Template creation, testing, and analytics workflows fully functional
- **🐳 Production Ready** - Stable Docker deployment with comprehensive error handling

## 🎯 Features

### Core Features
- **🔗 Multi-Provider Support** - OpenAI, Anthropic, Meta, and extensible architecture
- **📝 Prompt Library** - Create, edit, organize, and search prompts in human-readable YAML
- **🤖 AI Enhancement Workflow** - Intelligent prompt improvement with context-aware questions
- **🎯 Multi-Provider Rendering** - Generate provider-specific outputs with variable substitution
- **⭐ Rating & Evaluation** - Comprehensive prompt rating and feedback system
- **📤 Export & Integration** - Native format export for all supported providers
- **🔄 Version Control** - Full audit trail and immutable prompt versioning

### Advanced Features
- **🧠 Intelligent Question Generation** - Context-aware missing information detection
- **🔄 Import/Export Round-trip** - Full fidelity conversion between providers
- **📊 Comprehensive Testing** - >90% test coverage with integration tests
- **🔐 Security First** - JWT auth, RBAC, AES-256-GCM encryption, TLS 1.3
- **📱 Professional Interface** - Modern React 18 + TypeScript + Material-UI
- **🌐 API-First Design** - RESTful API with OpenAPI 3.0 documentation
- **🚀 Real-time Collaboration** - WebSocket-powered collaborative editing
- **🐳 Production Ready** - Docker containerization with monitoring stack

## 🐳 Docker Deployment

### Quick Docker Setup

```bash
# Build the Docker image
docker build -t prompt-library .

# Run with Docker Compose (recommended)
docker-compose up -d

# Or run standalone container
docker run -p 8000:8000 prompt-library
```

### Docker Build Features
- **✅ Multi-stage Build** - Optimized for production with minimal image size
- **🔧 TypeScript Compilation** - Fully resolved compilation issues in Docker environment
- **📦 Production Dependencies** - Only necessary runtime dependencies included
- **🔒 Security Hardened** - Non-root user, minimal attack surface
- **📊 Health Checks** - Built-in container health monitoring

### Docker Troubleshooting

If you encounter build issues:

```bash
# Clean build (no cache)
docker build --no-cache -t prompt-library .

# Check build logs
docker build -t prompt-library . 2>&1 | tee build.log

# Verify image
docker run --rm prompt-library node --version
```

## 🛠️ Application Management

### 🚀 Quick Start (Recommended)

Use our robust management scripts for the best experience:

```bash
# Start all services (Docker + Backend + Frontend)
npm start
# or
./scripts/start.sh

# Check service status
npm run status
# or
./scripts/status.sh

# Stop all services
npm stop
# or
./scripts/stop.sh

# Restart all services
npm restart
# or
./scripts/restart.sh
```

### 🔍 Health Monitoring

```bash
# Quick health check
./scripts/health-check.sh

# Detailed status with resource usage
./scripts/status.sh

# Quiet status for scripts
./scripts/status.sh --quiet
```

### 📊 What the Scripts Do

**Start Script (`start.sh`)**:
1. ✅ Checks Docker is running and prerequisites
2. 🐳 Starts PostgreSQL and Redis containers
3. ⏳ Waits for database services to be ready
4. 🔧 Starts backend API with health verification
5. 🎨 Starts frontend with accessibility checks
6. 🎉 Provides complete service URLs and login info

**Stop Script (`stop.sh`)**:
1. 🛑 Gracefully stops frontend (SIGTERM → SIGKILL)
2. 🔧 Gracefully stops backend API
3. 🐳 Stops Docker services
4. 🧹 Cleans up PID files and temporary data
5. ✅ Verifies all services are stopped

**Status Script (`status.sh`)**:
- 📊 Real-time service status with health checks
- 🔗 Service URLs and endpoints
- 📝 Log file information and sizes
- 💻 Resource usage (CPU, Memory)
- 🛠️ Management command suggestions

## 🛠️ Manual Development Setup

For manual setup or troubleshooting:

### Prerequisites
- **Node.js** 18+ with npm
- **Docker** and Docker Compose (for databases)
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd prompt-library-interface

# Navigate to interface directory
cd interface

# Install all dependencies
npm run install:all

# Set up environment
cp .env.example .env.development
# Edit .env.development with your settings

# Start database services (requires Docker)
docker-compose -f docker-compose.dev.yml up -d

# Start development servers
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/api/docs

## 📝 Logging & Monitoring

### Log Files
All services log to the `logs/` directory:

```bash
# Real-time backend logs
tail -f logs/backend.log

# Real-time frontend logs  
tail -f logs/frontend.log

# Startup/shutdown events
tail -f logs/startup.log

# All logs combined
tail -f logs/*.log
```

### Service Monitoring
```bash
# Comprehensive status check
./scripts/status.sh

# Quick health verification
./scripts/health-check.sh

# JSON output for monitoring tools
./scripts/health-check.sh --json
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check current status
./scripts/status.sh

# Check Docker is running
docker info

# Check for port conflicts
lsof -i :3000 -i :8000 -i :5432 -i :6379

# Clean restart
./scripts/stop.sh
./scripts/start.sh
```

**Partial service failure:**
```bash
# Force restart all services
./scripts/restart.sh --force

# Check logs for errors
tail -f logs/backend.log
tail -f logs/frontend.log
```

**Manual recovery:**
```bash
# Kill all processes
pkill -f "node backend/dist/index.js"
pkill -f "vite.*--port 3000"

# Stop Docker services
docker-compose down

# Clean up and restart
rm -f .backend.pid .frontend.pid
./scripts/start.sh
```

### Default Login
- **Username**: `admin`
- **Password**: `admin123456`

### Support
- Check `logs/` directory for detailed error information
- Review `scripts/README.md` for script documentation
- Use `./scripts/status.sh` for comprehensive system status

## 📖 Documentation

### User Documentation
Comprehensive documentation is available in the `/interface/docs` directory:

- **[User Guide](interface/docs/user-guide/README.md)** - Complete user documentation
- **[Admin Guide](interface/docs/admin/README.md)** - System administration
- **[Developer Guide](interface/docs/developer/README.md)** - Development and customization
- **[API Documentation](interface/docs/api/openapi.yaml)** - REST API specification
- **[Troubleshooting](interface/docs/troubleshooting/README.md)** - Common issues and solutions

### Development Standards
Project standards and guidelines are maintained in `.kiro/steering/`:

- **[Project Standards](.kiro/steering/project-standards.md)** - Code quality, testing, and workflow standards
- **[Development Context](.kiro/steering/development-context.md)** - Architecture overview and design decisions
- **[API Design Guidelines](.kiro/steering/api-design.md)** - REST API and interface design principles
- **[Testing Standards](.kiro/steering/testing-standards.md)** - Comprehensive testing strategy and tools
- **[Deployment Operations](.kiro/steering/deployment-operations.md)** - Docker, monitoring, and production guidelines

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript 5.9.3
- **Material-UI (MUI)** for components
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Vite 7.1.8** for fast build tooling
- **Vitest 3.2.4** for testing

### Backend Stack
- **Node.js** with Express 4.21.2
- **TypeScript 5.9.3** for type safety
- **PostgreSQL 15** for user data
- **Redis 7** for caching and sessions
- **Socket.io 4.7.4** for real-time features
- **ESLint 9.36.0** with modern flat config

### Project Structure
```
prompt-library/
├── src/               # Core library (TypeScript)
│   ├── services/      # Business logic services
│   ├── adapters/      # Provider-specific implementations
│   └── models/        # Data models and interfaces
├── interface/         # Full-stack web application
│   ├── frontend/      # React 18 + TypeScript + MUI
│   ├── backend/       # Node.js + Express + PostgreSQL
│   ├── shared/        # Shared types and utilities
│   ├── docs/          # Comprehensive documentation
│   └── docker/        # Container configurations
└── .kiro/             # Development steering and specs
    ├── steering/      # Project standards and guidelines
    └── specs/         # Feature specifications
```

## 📋 Logging & Monitoring

All application logs are centralized in the `./logs/` directory for easy monitoring and management.

### Log Files
- `backend-combined.log` - All backend application logs
- `backend-error.log` - Backend error logs only
- `backend-audit.log` - Security and audit events
- `backend-performance.log` - Performance metrics
- `frontend.log` - Frontend application logs
- `startup.log` - Application startup logs

### Log Management
```bash
# Show log status and file sizes
./scripts/manage-logs.sh status

# Tail specific logs
./scripts/manage-logs.sh tail backend
./scripts/manage-logs.sh tail frontend

# Rotate large log files
./scripts/manage-logs.sh rotate

# Clean up old logs
./scripts/manage-logs.sh cleanup

# Run full maintenance
./scripts/manage-logs.sh maintain
```

### Real-time Monitoring
```bash
# Watch all backend activity
tail -f logs/backend-combined.log

# Watch errors only
tail -f logs/backend-error.log

# Watch multiple logs
tail -f logs/backend-combined.log logs/frontend.log
```

## 🔧 Development Commands

```bash
# Install all dependencies
npm run install:all

# Development (starts both frontend and backend)
npm run dev

# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Build for production
npm run build

# Run tests
npm run test

# Lint and format
npm run lint
npm run format

# Docker commands
npm run docker:build
npm run docker:up
npm run docker:down
```

## 🌐 Browser Support

- **Chrome** 90+
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+

## 🔒 Security Features

- **Zero Vulnerabilities** - All npm packages audited and secure
- **Encryption at Rest** - AES-256-GCM for sensitive data
- **Encryption in Transit** - TLS 1.3 for all communications
- **JWT Authentication** - Secure token-based auth with refresh rotation
- **Role-based Access Control** - Granular permissions system
- **Input Validation** - Comprehensive sanitization and type checking
- **Rate Limiting** - API abuse prevention with configurable limits
- **Modern Dependencies** - Latest secure versions of all packages

## 📊 System Requirements

### Minimum Requirements
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB
- **Storage**: 1 GB available space
- **Network**: Broadband internet

### Recommended (Full Development)
- **CPU**: 4+ cores, 2.5+ GHz
- **RAM**: 8+ GB
- **Storage**: 20+ GB SSD
- **Network**: High-speed internet

## 🤝 Contributing

We welcome contributions! See our [Contributing Guidelines](interface/docs/developer/contributing.md) for:
- Code contributions and pull requests
- Bug reports and feature requests
- Documentation improvements
- Community support

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Getting Help

### Quick Troubleshooting

**Backend Errors When Running Full Dev?**
```bash
# Install missing dependencies
cd interface/backend
npm install prom-client
```

**Still Having Issues?**
1. **Check Documentation** - Start with the [User Guide](interface/docs/user-guide/README.md)
2. **Troubleshooting Guide** - See [Troubleshooting Guide](interface/docs/troubleshooting/README.md)
3. **Report Issues** - Use GitHub issues for bugs and feature requests

---

**Ready to get started?** Follow the setup instructions above! 🚀

## Quick Example

```typescript
import { PromptLibrary } from './src';

const library = new PromptLibrary({
  storageDir: './prompts',
  enableCache: true,
  llmProvider: 'openai' // or 'anthropic', 'mock'
});

await library.initialize();

// Create a human-readable prompt
const prompt = await library.prompts.createPrompt({
  goal: "Generate a product description",
  audience: "E-commerce customers", 
  steps: ["Analyze product features", "Write compelling copy"],
  output_expectations: {
    format: "HTML",
    fields: ["title", "description", "features"]
  }
}, {
  title: "Product Description Generator",
  summary: "Creates compelling product descriptions",
  tags: ["ecommerce", "copywriting"],
  owner: "user@example.com"
});

// AI enhancement with intelligent questions
const enhancement = await library.prompts.enhancePrompt(prompt.id);
console.log(`Generated ${enhancement.questions.length} context-aware questions`);

// Multi-provider rendering
const openaiRender = await library.prompts.renderPrompt(prompt.id, 'openai', {
  model: 'gpt-4',
  variables: { product_name: 'Smart Watch', category: 'Electronics' }
});

const anthropicRender = await library.prompts.renderPrompt(prompt.id, 'anthropic', {
  model: 'claude-3-sonnet-20240229',
  variables: { product_name: 'Smart Watch', category: 'Electronics' }
});

// Export in native format
const exported = await library.export.exportPrompt(prompt.id, 'openai');
```

## Development Status

✅ **Core Library**: Complete and fully tested (>90% coverage)  
✅ **AI Enhancement**: Intelligent question generation implemented  
✅ **Multi-Provider Support**: OpenAI, Anthropic, Meta adapters ready  
✅ **Rating System**: Prompt evaluation and feedback system  
✅ **Import/Export**: Full round-trip support for all providers  
✅ **Web Interface**: Professional React/TypeScript interface complete  
✅ **Backend Services**: Node.js API with PostgreSQL/Redis  
✅ **Real-time Features**: WebSocket collaboration implemented  
✅ **Documentation**: Comprehensive guides and API documentation  
✅ **Production Ready**: Docker containerization and deployment  

**Test Coverage**: >90% across all services  
**API Stability**: Production-ready with comprehensive OpenAPI docs  
**Security**: JWT auth, RBAC, encryption at rest/transit

## 📋 Changelog

### Latest Updates (December 2024)

#### 🐳 Docker Build Fixes
- **Fixed TypeScript compilation errors** in Docker environment
- **Resolved module resolution issues** for ES modules with `.js` extensions
- **Updated `.dockerignore`** to properly include source data files
- **Improved production build process** with optimized dependency management

#### 🔧 Backend Improvements
- **Enhanced pagination handling** with proper default values for `filters.limit` and `filters.page`
- **Fixed array type inference issues** by adding explicit type annotations
- **Improved null safety** with optional chaining for better error handling
- **Relaxed strict TypeScript settings** for better Docker compatibility

#### 📦 Build Process Enhancements
- **Updated TypeScript configuration** with `downlevelIteration: true` for ES2015+ features
- **Fixed import/export module resolution** for provider templates
- **Optimized Docker multi-stage build** for smaller production images
- **Enhanced error handling** throughout the application

#### 🚀 Performance & Reliability
- **Improved Load More functionality** in the prompt library interface
- **Better error messages** and debugging information
- **Enhanced logging** for troubleshooting Docker builds
- **Streamlined development workflow** with better build scripts

## License

MIT