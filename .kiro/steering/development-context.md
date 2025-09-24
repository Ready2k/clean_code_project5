---
inclusion: always
---

# Development Context and Project Overview

## Project Purpose
This is a comprehensive prompt library system that enables users to:
- Create and manage AI prompts in human-readable format
- Enhance prompts using AI assistance
- Render prompts for multiple AI providers (OpenAI, Anthropic, Meta, etc.)
- Rate and evaluate prompt effectiveness
- Export prompts in provider-specific formats

## Current Architecture

### Core Components
- **PromptLibrary**: Main orchestration class
- **PromptManager**: CRUD operations for prompts
- **EnhancementAgent**: AI-powered prompt improvement
- **ProviderRegistry**: Multi-provider support system
- **VariableManager**: Dynamic variable handling
- **RatingSystem**: Prompt evaluation and feedback

### Key Features Implemented
- Provider-agnostic prompt storage in YAML format
- AI enhancement workflow with intelligent question generation
- Multi-provider rendering (OpenAI, Anthropic, Meta adapters)
- Variable substitution and validation
- Rating and evaluation system
- Import/export functionality
- Comprehensive test coverage

## Development Status
- Core library functionality is complete and tested (>90% coverage)
- Professional web interface is fully implemented with React/TypeScript
- Full-stack application with Node.js backend and PostgreSQL/Redis
- Docker containerization and production deployment ready
- Comprehensive documentation and API specifications
- Real-time collaboration features via WebSocket

## Key Design Decisions
- **Spec-driven development**: All behavior derived from schemas
- **Provider agnostic core**: Thin adapter layer for AI providers
- **Human-readable storage**: YAML for prompts, JSON for APIs
- **Immutable versioning**: Full audit trail for all changes
- **Intelligent enhancement**: Context-aware question generation
- **Monorepo structure**: Core library + full-stack web interface
- **API-first design**: Backend services expose comprehensive REST APIs
- **Modern frontend**: React 18 + TypeScript + Material-UI components

## Integration Points
- **Database Layer**: PostgreSQL for user data, Redis for caching/sessions
- **RESTful API**: Express.js backend with comprehensive OpenAPI documentation
- **Real-time Features**: Socket.io for collaborative editing and live updates
- **Container Orchestration**: Docker Compose for development and production
- **Monitoring Stack**: Prometheus metrics, structured logging, health checks
- **Security Layer**: JWT authentication, role-based access control, encryption at rest/transit