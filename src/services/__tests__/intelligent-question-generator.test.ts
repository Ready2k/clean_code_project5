// Tests for IntelligentQuestionGenerator

import { IntelligentQuestionGeneratorImpl } from '../intelligent-question-generator';
import { HumanPrompt } from '../../models/prompt';

describe('IntelligentQuestionGenerator', () => {
  let generator: IntelligentQuestionGeneratorImpl;

  beforeEach(() => {
    generator = new IntelligentQuestionGeneratorImpl();
  });

  describe('detectTaskType', () => {
    it('should detect analysis tasks', () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Analyze the sales data to identify trends',
        audience: 'Business analysts',
        steps: ['Load the data', 'Examine patterns', 'Generate insights'],
        output_expectations: {
          format: 'report',
          fields: ['trends', 'insights']
        }
      };

      const taskType = generator.detectTaskType(humanPrompt);
      expect(taskType).toBe('analysis');
    });

    it('should detect generation tasks', () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Generate a marketing email for our new product',
        audience: 'Marketing team',
        steps: ['Create subject line', 'Write body content', 'Add call to action'],
        output_expectations: {
          format: 'email',
          fields: ['subject', 'body']
        }
      };

      const taskType = generator.detectTaskType(humanPrompt);
      expect(taskType).toBe('generation');
    });

    it('should detect code tasks', () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Write a function to sort an array',
        audience: 'Developers',
        steps: ['Define function signature', 'Implement sorting logic', 'Add error handling'],
        output_expectations: {
          format: 'code',
          fields: ['function']
        }
      };

      const taskType = generator.detectTaskType(humanPrompt);
      expect(taskType).toBe('code');
    });
  });

  describe('shouldGenerateQuestions', () => {
    it('should not generate questions for specific, self-contained prompts', () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Explain how photosynthesis works in plants',
        audience: 'Students',
        steps: [
          'Describe the process of light absorption',
          'Explain the conversion of CO2 and water',
          'Detail the production of glucose and oxygen'
        ],
        output_expectations: {
          format: 'explanation',
          fields: ['process', 'steps', 'outcome']
        }
      };

      const shouldGenerate = generator.shouldGenerateQuestions({
        humanPrompt,
        taskType: 'unknown'
      });

      expect(shouldGenerate).toBe(false);
    });

    it('should generate questions for vague prompts requiring input', () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Analyze data',
        audience: 'Analysts',
        steps: ['Look at the data'],
        output_expectations: {
          format: 'report',
          fields: ['results']
        }
      };

      const shouldGenerate = generator.shouldGenerateQuestions({
        humanPrompt,
        taskType: 'analysis'
      });

      expect(shouldGenerate).toBe(true);
    });
  });

  describe('generateQuestions', () => {
    it('should generate relevant questions for analysis tasks', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Analyze customer feedback',
        audience: 'Product managers',
        steps: ['Review feedback', 'Identify patterns'],
        output_expectations: {
          format: 'summary',
          fields: ['insights']
        }
      };

      const questions = await generator.generateQuestions({
        humanPrompt,
        taskType: 'analysis'
      });

      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some(q => q.text.toLowerCase().includes('data') || q.text.toLowerCase().includes('feedback'))).toBe(true);
    });

    it('should generate no questions for self-contained tasks', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Explain the difference between let and const in JavaScript',
        audience: 'Developers',
        steps: [
          'Define let keyword and its scope',
          'Define const keyword and its immutability',
          'Provide examples of when to use each',
          'Highlight key differences'
        ],
        output_expectations: {
          format: 'explanation',
          fields: ['let_definition', 'const_definition', 'examples', 'differences']
        }
      };

      const questions = await generator.generateQuestions({
        humanPrompt,
        taskType: 'unknown'
      });

      expect(questions.length).toBe(0);
    });

    it('should generate programming language question for code tasks', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Write a sorting function',
        audience: 'Developers',
        steps: ['Create function', 'Implement logic'],
        output_expectations: {
          format: 'code',
          fields: ['function']
        }
      };

      const questions = await generator.generateQuestions({
        humanPrompt,
        taskType: 'code'
      });

      expect(questions.length).toBeGreaterThan(0);
      expect(questions.some(q => q.text.toLowerCase().includes('programming language'))).toBe(true);
    });
  });
});