# Prompt Library Backend

Node.js Express API server providing backend services for the Prompt Library interface.

## Features

- 🔐 JWT-based authentication with role-based access control
- 🤖 LLM connection management (OpenAI, AWS Bedrock)
- 📝 Integration with existing Prompt Library system
- 🔒 Secure credential encryption and storage
- 📊 System monitoring and health checks
- 🚀 Real-time updates via WebSocket
- 📈 Comprehensive logging and audit trails

## Technology Stack

- **Node.js** with TypeScript
- **Express.js** web framework
- **Socket.io** for WebSocket connections
- **PostgreSQL** for user data
- **Redis** for sessions and caching
- **JWT** for authentication
- **bcrypt** for password hashing

## Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── controllers/        # Route controllers
├── middleware/         # Express middleware
├── models/            # Data models and types
├── routes/            # API route definitions
├── services/          # Business logic services
├── utils/             # Utility functions
├── config/            # Configuration files
└── types/             # TypeScript type definitions
```

### Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT token signing
- `ENCRYPTION_KEY` - Key for encrypting sensitive data

### Database Setup

The application uses PostgreSQL for user data and Redis for sessions.

```bash
# Start services with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Or install locally and create database
createdb promptlib
```

The database schema is automatically initialized on first run.

### Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage
```

## API Documentation

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user

### Prompts

- `GET /api/prompts` - List prompts with filtering
- `POST /api/prompts` - Create new prompt
- `GET /api/prompts/:id` - Get prompt by ID
- `PUT /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Delete prompt
- `POST /api/prompts/:id/enhance` - Enhance prompt with AI
- `POST /api/prompts/:id/render/:provider` - Render for provider

### LLM Connections

- `GET /api/connections` - List connections
- `POST /api/connections` - Create connection
- `PUT /api/connections/:id` - Update connection
- `DELETE /api/connections/:id` - Delete connection
- `POST /api/connections/:id/test` - Test connection

### System

- `GET /api/system/status` - System health status
- `GET /api/system/stats` - System statistics

## Architecture

The backend follows a layered architecture:

1. **Routes** - Define API endpoints and validation
2. **Controllers** - Handle HTTP requests and responses
3. **Services** - Implement business logic
4. **Models** - Define data structures
5. **Middleware** - Handle cross-cutting concerns

## Security

Security measures include:

- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Credential encryption with AES-256-GCM
- Rate limiting
- Input validation and sanitization
- Security headers with Helmet
- CORS configuration

## Integration

The backend integrates with the existing Prompt Library system by:

- Importing and wrapping the PromptLibrary class
- Providing API endpoints for all library functionality
- Managing user authentication and authorization
- Handling LLM connection configuration
- Providing real-time updates via WebSocket

## Monitoring

The application includes:

- Structured logging with Winston
- Health check endpoints
- Performance metrics
- Error tracking and reporting
- Audit logging for security events

## Deployment

The backend can be deployed using:

- Docker containers (recommended)
- Direct Node.js deployment
- Cloud platforms (AWS, GCP, Azure)

See the main README for Docker deployment instructions.