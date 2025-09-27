# Import Variant Fix

## Problem
When importing prompts from Git or other sources, the system was incorrectly placing them in the "variant prompts space" instead of creating them as base prompts. This happened because imported prompts often contained variant-like characteristics such as:

- Enhancement tags (`enhanced`)
- Provider-model tags (`anthropic-claude-3-sonnet`, `openai-gpt-4`)
- Variant metadata fields (`variant_of`, `tuned_for_provider`, `preferred_model`)
- Variant title patterns ("(Enhanced)", "(provider-model)")

## Solution
Implemented a comprehensive fix that:

1. **Detects variant characteristics** in imported content
2. **Asks the user** when ambiguous content is detected (configurable)
3. **Cleans variant metadata** to ensure imported prompts become base prompts
4. **Adds appropriate tags** (`imported`, `base-prompt`) to clearly identify the prompt type

## Key Changes

### Core Library (`src/services/import-service.js`)
- Added `detectVariantCharacteristics()` method to identify variant indicators
- Added `handleVariantDetection()` method for user interaction
- Added `cleanVariantMetadata()` method to strip variant-specific data
- Updated `importFromContent()` to use the new variant detection flow

### Backend Service (`interface/backend/src/services/import-service.ts`)
- Mirrored the core library changes for the web interface
- Added TypeScript interfaces for variant detection
- Updated import controllers to use new options

### New Import Options
```typescript
interface ImportOptions {
  // ... existing options
  forceAsBasePrompt?: boolean;     // Force import as base prompt (default: true)
  allowVariantImport?: boolean;    // Allow importing as variants
  forceAsVariant?: boolean;        // Force import as variant
  interactive?: boolean;           // Enable user prompts
  onVariantDetected?: (info) => boolean; // Callback for variant detection
}
```

## Variant Detection Logic

The system identifies variants by checking for:

### Tags
- `enhanced` tag
- Provider-model patterns: `openai-*`, `anthropic-*`, `meta-*`, `aws-*`, `google-*`

### Metadata Fields
- `variant_of` - Links to base prompt
- `tuned_for_provider` - Provider optimization
- `preferred_model` - Model preference

### Title Patterns
- `(Enhanced)` suffix
- `(provider-model)` patterns
- Keywords: "enhanced", "optimized for", "tuned for"

## Cleaning Process

When `forceAsBasePrompt: true` (default), the system:

1. **Removes variant metadata fields**
   - `variant_of`
   - `tuned_for_provider` 
   - `preferred_model`

2. **Filters variant tags**
   - Removes `enhanced` tag
   - Removes provider-model tags

3. **Cleans titles and summaries**
   - Removes "(Enhanced)" patterns
   - Removes "(provider-model)" patterns
   - Removes enhancement descriptions

4. **Adds base prompt tags**
   - `imported` - Marks as imported content
   - `base-prompt` - Clearly identifies as base prompt

## Usage Examples

### Default Behavior (Force as Base Prompt)
```javascript
const options = {
  sourceProvider: 'openai',
  conflictResolution: 'create_new',
  forceAsBasePrompt: true  // Default behavior
};

const result = await importService.importFromContent(content, options);
// Result will always be a base prompt, regardless of source characteristics
```

### Interactive Mode (Ask User)
```javascript
const options = {
  sourceProvider: 'anthropic',
  interactive: true,
  onVariantDetected: async (variantInfo) => {
    console.log('Variant detected:', variantInfo.indicators);
    // Return true to import as base prompt, false for variant
    return confirm('Import as base prompt?');
  }
};
```

### Allow Variant Import (Future Feature)
```javascript
const options = {
  allowVariantImport: true,
  forceAsBasePrompt: false,
  // Would require additional logic to link to base prompts
};
```

## Test Results

The fix has been tested with various scenarios:

✅ **Enhanced Anthropic Prompt**
- Detected: `enhanced` tag, `anthropic-claude-3-sonnet` tag, title pattern
- Cleaned: Removed variant tags, cleaned title, added base prompt tags

✅ **OpenAI Optimized Prompt** 
- Detected: `openai-gpt-4` tag, `variant_of` field, title pattern
- Cleaned: Removed variant metadata, cleaned title, added base prompt tags

✅ **Regular Base Prompt**
- Detected: No variant characteristics
- Result: Added import tags, preserved original content

## Benefits

1. **Consistent Import Behavior**: All imports create base prompts by default
2. **User Control**: Options to handle edge cases and user preferences
3. **Clear Identification**: Imported prompts are clearly tagged
4. **Backward Compatible**: Existing import functionality unchanged
5. **Future Ready**: Framework for variant import features

## Migration

No migration required. The fix:
- Defaults to safe behavior (force as base prompt)
- Preserves existing import functionality
- Only adds new optional features
- Works with all existing import endpoints