# Intelligent Question Generation Solution

## Problem Identified

The AI enhancer was always asking the same two generic questions regardless of context:
1. "What specific data or content should be processed?"
2. "Any additional context or constraints?"

This created a poor user experience because:
- Questions were asked even when unnecessary
- Questions weren't relevant to the specific task
- Users had to answer the same questions repeatedly
- No adaptation based on prompt completeness or task type

## Solution Implemented

### 1. Created `IntelligentQuestionGenerator`

A new service that provides context-aware question generation with:

- **Task Type Detection**: Automatically detects the type of task (analysis, generation, code, etc.)
- **Context Awareness**: Determines if questions are actually needed
- **Task-Specific Questions**: Generates relevant questions based on the detected task type
- **Smart Filtering**: Avoids questions for self-contained or already-complete prompts

### 2. Key Features

#### Task Type Detection
```typescript
detectTaskType(humanPrompt: HumanPrompt): TaskType
```
Detects task types including:
- `analysis` - Data analysis, evaluation, review tasks
- `generation` - Content creation, writing tasks  
- `code` - Programming, function writing tasks
- `transformation` - Format conversion, restructuring
- `classification` - Categorization, labeling tasks
- `conversation` - Chat, dialogue tasks
- `creative` - Story, design, brainstorming tasks

#### Smart Question Generation
```typescript
shouldGenerateQuestions(context: QuestionGenerationContext): boolean
```
Determines if questions are needed based on:
- Prompt specificity and completeness
- Task self-containment
- Existing variable requirements

#### Context-Aware Questions
Different question sets for different task types:
- **Analysis tasks**: Ask for data source and analysis focus
- **Code tasks**: Ask for programming language and requirements
- **Generation tasks**: Ask for topic and style preferences
- **Transformation tasks**: Ask for source and target formats

### 3. Integration Points

#### Enhanced `EnhancementAgent`
```typescript
// Old approach - generic questions for all variables
const questions = await this.generateQuestions(variables);

// New approach - intelligent, context-aware questions
const questions = await this.questionGenerator.generateQuestions({
  humanPrompt,
  structuredPrompt,
  enhancementContext: context,
  taskType: this.questionGenerator.detectTaskType(humanPrompt)
});
```

#### Updated `PromptLibraryService`
Replaced hardcoded generic questions with intelligent generation:
```typescript
// Old: Always the same 2 questions
const questions: Question[] = [
  { text: 'What specific data or content should be processed?' },
  { text: 'Any additional context or constraints?' }
];

// New: Context-aware generation
const questionGenerator = new IntelligentQuestionGeneratorImpl();
const questions = await questionGenerator.generateQuestions({
  humanPrompt: prompt.humanPrompt,
  structuredPrompt,
  enhancementContext: options?.context,
  taskType: questionGenerator.detectTaskType(prompt.humanPrompt)
});
```

## Results & Benefits

### Before vs After Examples

#### 1. Self-Contained Task
**Prompt**: "Explain how photosynthesis works in plants"
- **Before**: 2 generic questions (unnecessary)
- **After**: 0 questions (task is complete as-is)

#### 2. Vague Analysis Task  
**Prompt**: "Analyze customer feedback"
- **Before**: 2 generic questions
- **After**: 2 specific questions about data source and analysis focus

#### 3. Code Generation
**Prompt**: "Write a sorting function"
- **Before**: 2 generic questions
- **After**: 1 specific question about programming language

#### 4. Complete Requirements
**Prompt**: "Generate a professional email template for customer onboarding with greeting, steps, and contact info"
- **Before**: 2 generic questions (unnecessary)
- **After**: 0 questions (requirements already clear)

### Key Improvements

✅ **Context Awareness**: No questions for complete prompts  
✅ **Task-Specific**: Relevant questions based on task type  
✅ **Reduced Friction**: Eliminates unnecessary questioning  
✅ **Better UX**: Users only see questions when they add value  
✅ **Intelligent**: Adapts to prompt content and completeness  

## Testing

Comprehensive test suite covers:
- Task type detection accuracy
- Question generation logic
- Context-aware filtering
- Edge cases and error handling

Run tests with:
```bash
npm test -- intelligent-question-generator.test.ts
```

## Usage

The intelligent question generator is automatically integrated into the enhancement workflow. No changes needed for existing API consumers - the improvement is transparent and backward-compatible.

## Future Enhancements

Potential improvements:
- Machine learning-based task detection
- User preference learning
- Domain-specific question templates
- Multi-language support for questions
- Integration with user feedback loops

---

**Impact**: This solution transforms the AI enhancer from a generic, repetitive questioner into an intelligent assistant that only asks relevant questions when they're actually needed, significantly improving the user experience.