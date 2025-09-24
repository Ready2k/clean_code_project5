# Prompt Library Professional Interface

A comprehensive web-based interface for managing AI prompts across multiple providers (OpenAI, AWS Bedrock, etc.) with advanced features like AI-powered enhancement, multi-provider rendering, and collaborative workflows.

## 🚀 Quick Start

### What You'll See
- **Interactive Dashboard** with system metrics
- **Prompt Library** with sample prompts you can browse and edit
- **Connection Management** for AI providers
- **User Settings** and preferences
- **Fully responsive design** that works on mobile/tablet

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

## 🛠️ Full Development Setup

For full development with backend services:

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
- **React 18** with TypeScript
- **Material-UI (MUI)** for components
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Vite** for build tooling

### Backend Stack
- **Node.js** with Express
- **TypeScript** for type safety
- **PostgreSQL** for user data
- **Redis** for caching and sessions
- **Socket.io** for real-time features

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

- **Encryption at Rest** - AES-256-GCM for sensitive data
- **Encryption in Transit** - TLS 1.3 for all communications
- **JWT Authentication** - Secure token-based auth
- **Role-based Access Control** - Granular permissions
- **Input Validation** - Comprehensive sanitization
- **Rate Limiting** - API abuse prevention

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

## License

MIT