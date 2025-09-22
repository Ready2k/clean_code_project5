# Prompt Library Frontend

React TypeScript application providing a professional interface for the Prompt Library system.

## Features

- 🔐 User authentication and role-based access control
- 📝 Comprehensive prompt management interface
- ✨ AI-powered prompt enhancement workflow
- 🎯 Multi-provider prompt rendering
- ⭐ Rating and evaluation system
- 📊 System monitoring dashboard
- 📱 Responsive design with accessibility support

## Technology Stack

- **React 18** with TypeScript
- **Redux Toolkit** for state management
- **React Query** for server state
- **Material-UI** for components
- **React Router** for navigation
- **Socket.io** for real-time updates
- **Vite** for build tooling

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── hooks/              # Custom React hooks
├── store/              # Redux store and slices
├── services/           # API services
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
└── test/               # Test utilities and setup
```

### Environment Variables

See `.env.example` for all available configuration options.

### Testing

```bash
# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Architecture

The frontend follows a component-based architecture with:

- **Pages** - Top-level route components
- **Components** - Reusable UI components organized by feature
- **Hooks** - Custom hooks for business logic
- **Store** - Redux slices for state management
- **Services** - API client and external service integrations

## State Management

Uses Redux Toolkit with the following slices:

- `auth` - Authentication state
- `prompts` - Prompt library state
- `connections` - LLM connection state
- `ui` - UI state (modals, notifications, etc.)
- `system` - System status and configuration

## API Integration

The frontend communicates with the backend via:

- **REST API** - Standard CRUD operations
- **WebSocket** - Real-time updates and notifications
- **React Query** - Caching and synchronization

## Accessibility

The application follows WCAG 2.1 AA guidelines:

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support

## Performance

Optimization strategies include:

- Code splitting with React.lazy()
- Component memoization
- Virtual scrolling for large lists
- Image optimization
- Bundle analysis and optimization