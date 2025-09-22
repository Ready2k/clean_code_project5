// Enhancement-related models

import { StructuredPrompt } from './prompt';
import { Question } from './variable';

export interface EnhancementResult {
  structuredPrompt: StructuredPrompt;
  questions: Question[];
  rationale: string;
  confidence: number; // 0-1 score
  changes_made: string[];
  warnings?: string[];
}

import { EnhancementContext } from '../types/common';

export interface EnhancementRequest {
  prompt_id: string;
  human_prompt: string;
  context?: EnhancementContext;
  options?: {
    preserve_style: boolean;
    add_examples: boolean;
    optimize_for_clarity: boolean;
  };
}