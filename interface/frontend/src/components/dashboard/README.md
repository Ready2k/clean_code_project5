# Dashboard Components

This directory contains the dashboard components for the Prompt Library interface. The dashboard provides a comprehensive overview of the system status, prompt library statistics, and quick access to common actions.

## Components

### StatCard
A reusable card component for displaying key statistics with optional trends and loading states.

**Features:**
- Displays title, value, and optional subtitle
- Supports trend indicators (up/down/neutral)
- Loading state with spinner
- Customizable colors and icons
- Responsive design

### SystemHealthWidget
Shows the overall system health and individual service statuses.

**Features:**
- System status indicator (healthy/degraded/down)
- Service-level health monitoring (API, Database, Storage, LLM)
- Uptime and version information
- Response time metrics
- Real-time status updates

### ActivityFeed
Displays recent user activities and system events.

**Features:**
- Chronological list of activities
- Activity type icons and colors
- User attribution
- Relative timestamps
- Expandable for more details

### QuickActions
Provides quick access buttons for common tasks.

**Features:**
- Grid layout of action buttons
- Descriptive icons and text
- Disabled state for unimplemented features
- Navigation integration
- Responsive grid layout

### ConnectionStatusWidget
Shows the status of configured LLM provider connections.

**Features:**
- Connection list with status indicators
- Provider type badges
- Latency information
- Test connection functionality
- Connection management shortcuts

## Layout Structure

The dashboard uses a responsive grid layout that adapts to different screen sizes:

- **Mobile (xs)**: Single column layout
- **Tablet (md)**: Two-column layout for widgets
- **Desktop (lg+)**: Three-column layout with sidebar

## State Management

The dashboard components integrate with Redux store slices:

- `systemSlice`: System health and statistics
- `connectionsSlice`: LLM provider connections
- `promptsSlice`: Prompt library data
- `authSlice`: User authentication state

## Real-time Updates

Components support real-time updates through:

- Redux store updates
- WebSocket connections (future enhancement)
- Periodic data refresh
- Manual refresh actions

## Accessibility

All components follow accessibility best practices:

- ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management

## Testing

Each component includes comprehensive tests:

- Unit tests for individual components
- Integration tests for data flow
- Accessibility tests
- Responsive design tests

## Usage Example

```tsx
import { DashboardPage } from '../pages/DashboardPage';

// The dashboard automatically loads and displays:
// - System statistics
// - Health monitoring
// - Recent activities
// - Quick actions
// - Connection status

function App() {
  return <DashboardPage />;
}
```

## Customization

Components can be customized through:

- Theme configuration (colors, typography)
- Layout adjustments (grid breakpoints)
- Feature toggles (show/hide widgets)
- Data refresh intervals
- Action button configurations