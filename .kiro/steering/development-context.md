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
- Core library functionality is complete and tested
- Professional web interface is in development
- All major services have comprehensive test coverage
- Documentation is current and comprehensive

## Key Design Decisions
- **Spec-driven development**: All behavior derived from schemas
- **Provider agnostic core**: Thin adapter layer for AI providers
- **Human-readable storage**: YAML for prompts, JSON for APIs
- **Immutable versioning**: Full audit trail for all changes
- **Intelligent enhancement**: Context-aware question generation

## Integration Points
- File system storage with optional database support
- RESTful API for web interface integration
- WebSocket support for real-time collaboration
- Docker containerization for deployment
- Comprehensive monitoring and logging