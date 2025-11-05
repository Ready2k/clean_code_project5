# Logging System Documentation

## Overview

The application now uses a centralized logging system that provides structured logging with configurable levels and output destinations.

## Usage

### Basic Usage

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('ComponentName');

logger.error('Something went wrong', { error: errorObject });
logger.warn('This is a warning', { data: someData });
logger.info('Information message', { userId: '123' });
logger.debug('Debug information', { state: componentState });
logger.trace('Detailed trace info', { step: 'validation' });
```

### Pre-configured Loggers

```typescript
import { enhancementLogger, apiLogger, wsLogger } from '../utils/logger';

enhancementLogger.info('Enhancement started', { jobId: '123' });
apiLogger.debug('API request', { url: '/api/prompts', method: 'GET' });
wsLogger.info('WebSocket connected', { userId: 'user123' });
```

## Log Levels

- **ERROR (0)**: Critical errors that need immediate attention
- **WARN (1)**: Warnings about potential issues
- **INFO (2)**: General information about application flow
- **DEBUG (3)**: Detailed information for debugging
- **TRACE (4)**: Very detailed execution traces

## Configuration

### Environment-based Configuration

The logging system automatically configures itself based on the environment:

- **Development**: Shows DEBUG level and above, console output enabled
- **Production**: Shows WARN level and above, console output disabled
- **Other**: Shows INFO level and above, console output enabled

### Runtime Configuration

You can control logging from the browser console:

```javascript
// Set log level
PromptLibraryLogging.setLevel(PromptLibraryLogging.LogLevel.DEBUG);

// Quick shortcuts
PromptLibraryLogging.debug(); // Set to DEBUG level
PromptLibraryLogging.info();  // Set to INFO level
PromptLibraryLogging.warn();  // Set to WARN level
PromptLibraryLogging.error(); // Set to ERROR level

// Enable/disable console output
PromptLibraryLogging.enableConsole(true);
PromptLibraryLogging.silent(); // Disable all console output
```

### Configuration File

Edit `src/config/logging.ts` to change default behavior:

```typescript
export const DISABLE_ALL_LOGGING = true; // Emergency disable
```

## Log Format

Logs are formatted as:
```
🔍 HH:MM:SS LEVEL [Context] Message {"data": "object"}
```

Example:
```
🔍 14:30:25 DEBUG [EnhancementResults] Component rendering {"prompt": true, "job": true, "hasResult": true}
```

## Best Practices

1. **Use appropriate log levels**: Don't use `error` for non-critical issues
2. **Include context**: Always provide relevant data objects
3. **Use descriptive messages**: Make logs searchable and meaningful
4. **Create component-specific loggers**: Use `createLogger('ComponentName')`
5. **Don't log sensitive data**: Avoid logging passwords, tokens, or PII

## Performance

- Logging checks are fast (level comparison)
- Disabled loggers have minimal overhead
- JSON serialization only happens when logging is enabled
- Production builds automatically reduce logging overhead

## Future Enhancements

- Remote logging integration (error tracking services)
- Log aggregation and search
- Performance metrics integration
- User session correlation