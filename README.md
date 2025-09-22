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
- **🔗 LLM Connection Management** - Support for OpenAI and AWS Bedrock
- **📝 Prompt Library** - Create, edit, organize, and search prompts
- **🤖 AI Enhancement Workflow** - Automatically improve prompts with AI
- **🎯 Multi-Provider Rendering** - Generate provider-specific outputs
- **⭐ Rating & Evaluation** - Community-driven prompt rating system
- **📤 Export & Integration** - Multiple formats and API access

### Advanced Features
- **🔄 Real-time Collaboration** - Live updates and notifications
- **📊 Analytics Dashboard** - Usage metrics and performance insights
- **🔐 Role-based Access Control** - Granular permissions
- **📱 Responsive Design** - Works on desktop, tablet, and mobile
- **♿ Accessibility** - Full WCAG 2.1 AA compliance
- **🌙 Dark/Light Mode** - Customizable themes

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

Comprehensive documentation is available in the `/interface/docs` directory:

- **[User Guide](interface/docs/user-guide/README.md)** - Complete user documentation
- **[Admin Guide](interface/docs/admin/README.md)** - System administration
- **[Developer Guide](interface/docs/developer/README.md)** - Development and customization
- **[API Documentation](interface/docs/api/openapi.yaml)** - REST API specification
- **[Troubleshooting](interface/docs/troubleshooting/README.md)** - Common issues and solutions

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

### Key Components
```
interface/
├── frontend/          # React web application
├── backend/           # Node.js API server
├── shared/            # Shared types and utilities
├── docs/              # Comprehensive documentation
├── docker/            # Docker configurations
├── monitoring/        # Observability setup
└── scripts/           # Deployment and utility scripts
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

## Usage

```typescript
import { PromptLibrary } from './src';

const library = new PromptLibrary({
  storageDir: './prompts',
  enableCache: true,
  enableFileWatcher: true
});

await library.initialize();

// Create a prompt
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

// Enhance the prompt
const enhancement = await library.prompts.enhancePrompt(prompt.id);

// Render for OpenAI
const rendered = await library.prompts.renderPrompt(
  prompt.id, 
  'openai', 
  { model: 'gpt-4' }
);
```

## Development Status

This project is currently in development. The core interfaces and project structure have been established. Implementation of individual components is in progress.

## License

MIT