# Multi-Provider Rendering Components

This directory contains the components for the multi-provider rendering interface, which allows users to render prompts across different LLM providers and compare the results.

## Components

### MultiProviderRenderer
The main component that orchestrates the entire rendering workflow. It provides:
- Provider selection interface
- Variable input forms
- Render preview and comparison
- Copy and download functionality

### ProviderSelector
Allows users to select which LLM connections to use for rendering:
- Displays available active connections
- Shows provider types (OpenAI, Bedrock) with visual indicators
- Provides advanced options (temperature, max tokens, model override)
- Select all/none functionality

### VariableInputForm
Handles input for prompt variables:
- Supports different variable types (string, number, boolean, array, object)
- Validation based on variable requirements
- Default value population
- Required vs optional variable separation

### RenderPreview
Displays individual render results:
- Shows provider information and status
- Displays formatted prompt output
- Provides copy and download actions
- Shows metadata and variables used
- Supports re-rendering with same settings

### ComparisonView
Side-by-side comparison of multiple renders:
- Configurable layout (side-by-side or stacked)
- Adjustable font size
- Bulk copy and download functionality
- Comparison statistics (length, timing)
- Difference highlighting

## State Management

The rendering functionality uses the `renderingSlice` which manages:
- Active renders and their results
- Loading states and errors
- Compare mode toggle
- Selected renders for comparison

## Usage

```tsx
import { MultiProviderRenderer } from './components/prompts';

// In a component
<MultiProviderRenderer
  prompt={selectedPrompt}
  onClose={() => setShowRenderer(false)}
/>
```

## Features

- **Multi-provider support**: Render prompts across OpenAI and AWS Bedrock
- **Variable validation**: Ensure all required variables are provided
- **Real-time rendering**: See results as they complete
- **Comparison mode**: Compare outputs side-by-side
- **Export functionality**: Copy to clipboard or download as files
- **Error handling**: Graceful handling of failed renders
- **Responsive design**: Works on desktop and mobile devices

## Testing

Each component has comprehensive unit tests covering:
- Rendering with different props
- User interactions
- Error states
- Accessibility features

Run tests with:
```bash
npm test src/components/prompts/rendering/
```