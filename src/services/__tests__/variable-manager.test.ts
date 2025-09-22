// Tests for VariableManager

import { describe, it, expect, beforeEach } from 'vitest';
import { VariableManager } from '../variable-manager';
import { MemoryAnswerStorage } from '../memory-answer-storage';
import { Variable } from '../../models/prompt';
import { Question, Answer, QuestionClass, AnswerClass } from '../../models/variable';
import { VariableType } from '../../types/common';

describe('VariableManager', () => {
  let variableManager: VariableManager;
  let variableManagerWithStorage: VariableManager;
  let answerStorage: MemoryAnswerStorage;
  let mockVariables: Variable[];
  let promptId: string;

  beforeEach(() => {
    variableManager = new VariableManager();
    answerStorage = new MemoryAnswerStorage();
    variableManagerWithStorage = new VariableManager(answerStorage);
    promptId = 'test-prompt-id';
    
    mockVariables = [
      {
        key: 'user_name',
        label: 'User Name',
        type: 'string' as VariableType,
        required: true
      },
      {
        key: 'age',
        label: 'Age',
        type: 'number' as VariableType,
        required: false
      },
      {
        key: 'is_premium',
        label: 'Premium User',
        type: 'boolean' as VariableType,
        required: true
      },
      {
        key: 'preferred_language',
        label: 'Preferred Language',
        type: 'select' as VariableType,
        required: true,
        options: ['English', 'Spanish', 'French']
      },
      {
        key: 'interests',
        label: 'Interests',
        type: 'multiselect' as VariableType,
        required: false,
        options: ['Technology', 'Sports', 'Music', 'Travel']
      }
    ];
  });

  describe('generateQuestions', () => {
    it('should generate questions for all variables by default', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      
      expect(questions).toHaveLength(5);
      expect(questions.map(q => q.variable_key)).toEqual([
        'user_name', 'age', 'is_premium', 'preferred_language', 'interests'
      ]);
    });

    it('should generate questions only for required variables when includeOptional is false', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId);
      
      expect(questions).toHaveLength(3);
      expect(questions.map(q => q.variable_key)).toEqual([
        'user_name', 'is_premium', 'preferred_language'
      ]);
    });

    it('should generate appropriate question text for different variable types', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      
      const stringQuestion = questions.find(q => q.variable_key === 'user_name');
      expect(stringQuestion?.text).toBe('What is the user name? *');
      
      const numberQuestion = questions.find(q => q.variable_key === 'age');
      expect(numberQuestion?.text).toBe('What is the age? (enter a number)');
      
      const booleanQuestion = questions.find(q => q.variable_key === 'is_premium');
      expect(booleanQuestion?.text).toBe('Premium User? (yes/no) *');
      
      const selectQuestion = questions.find(q => q.variable_key === 'preferred_language');
      expect(selectQuestion?.text).toBe('Select preferred language (choose one: English, Spanish, French) *');
      
      const multiselectQuestion = questions.find(q => q.variable_key === 'interests');
      expect(multiselectQuestion?.text).toBe('Select interests (choose multiple: Technology, Sports, Music, Travel)');
    });

    it('should use custom labels when provided', () => {
      const customLabels = {
        'user_name': 'Full Name',
        'age': 'Your Age'
      };
      
      const questions = variableManager.generateQuestions(
        mockVariables, 
        promptId, 
        { includeOptional: true, customLabels }
      );
      
      const nameQuestion = questions.find(q => q.variable_key === 'user_name');
      expect(nameQuestion?.text).toBe('What is the full name? *');
      
      const ageQuestion = questions.find(q => q.variable_key === 'age');
      expect(ageQuestion?.text).toBe('What is the your age? (enter a number)');
    });

    it('should include help text when provided', () => {
      const helpText = {
        'user_name': 'Enter your full legal name'
      };
      
      const questions = variableManager.generateQuestions(
        mockVariables, 
        promptId, 
        { helpText }
      );
      
      const nameQuestion = questions.find(q => q.variable_key === 'user_name');
      expect(nameQuestion?.help_text).toBe('Enter your full legal name');
    });

    it('should handle variables without options for select types', () => {
      const variableWithoutOptions: Variable = {
        key: 'category',
        label: 'Category',
        type: 'select',
        required: true
      };
      
      const questions = variableManager.generateQuestions([variableWithoutOptions], promptId);
      
      expect(questions).toHaveLength(1);
      expect(questions[0].text).toBe('Select category *');
    });

    it('should humanize variable keys when no label is provided', () => {
      const variableWithoutLabel: Variable = {
        key: 'user_first_name',
        label: '',
        type: 'string',
        required: true
      };
      
      const questions = variableManager.generateQuestions([variableWithoutLabel], promptId);
      
      expect(questions[0].text).toBe('What is the user first name? *');
    });
  });

  describe('validateQuestions', () => {
    let validQuestions: Question[];

    beforeEach(() => {
      validQuestions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
    });

    it('should validate correct questions successfully', () => {
      const result = variableManager.validateQuestions(validQuestions, mockVariables);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect questions for undefined variables', () => {
      const invalidQuestion = new QuestionClass({
        prompt_id: promptId,
        variable_key: 'undefined_variable',
        text: 'Test question',
        type: 'string'
      });
      
      const result = variableManager.validateQuestions([invalidQuestion], mockVariables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Question references undefined variable: undefined_variable');
    });

    it('should detect type mismatches', () => {
      const invalidQuestion = new QuestionClass({
        prompt_id: promptId,
        variable_key: 'user_name',
        text: 'Test question',
        type: 'number' // Should be string
      });
      
      const result = variableManager.validateQuestions([invalidQuestion], mockVariables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Question type 'number' doesn't match variable type 'string' for 'user_name'");
    });

    it('should detect required flag mismatches', () => {
      const invalidQuestion = new QuestionClass({
        prompt_id: promptId,
        variable_key: 'user_name',
        text: 'Test question',
        type: 'string',
        required: false // Should be true
      });
      
      const result = variableManager.validateQuestions([invalidQuestion], mockVariables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Question required flag doesn't match variable definition for 'user_name'");
    });

    it('should detect missing questions for required variables', () => {
      const incompleteQuestions = validQuestions.filter(q => q.variable_key !== 'user_name');
      
      const result = variableManager.validateQuestions(incompleteQuestions, mockVariables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing question for required variable: user_name');
    });

    it('should validate select/multiselect options', () => {
      const invalidQuestion = new QuestionClass({
        prompt_id: promptId,
        variable_key: 'preferred_language',
        text: 'Test question',
        type: 'select',
        required: true,
        options: ['English', 'German'] // Different from variable options
      });
      
      const result = variableManager.validateQuestions([invalidQuestion], mockVariables);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Question options don't match variable options for 'preferred_language'");
    });
  });

  describe('validateAnswers', () => {
    let questions: Question[];
    let validAnswers: Answer[];

    beforeEach(() => {
      questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      
      validAnswers = [
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'user_name')!.id,
          user_id: 'test-user',
          value: 'John Doe'
        }),
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'is_premium')!.id,
          user_id: 'test-user',
          value: true
        }),
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'preferred_language')!.id,
          user_id: 'test-user',
          value: 'English'
        })
      ];
    });

    it('should validate correct answers successfully', () => {
      const result = variableManager.validateAnswers(validAnswers, questions);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect answers for unknown questions', () => {
      const invalidAnswer = new AnswerClass({
        question_id: 'unknown-question-id',
        user_id: 'test-user',
        value: 'test'
      });
      
      const result = variableManager.validateAnswers([invalidAnswer], questions);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Answer references unknown question: unknown-question-id');
    });

    it('should detect missing answers for required questions', () => {
      const incompleteAnswers = validAnswers.filter(a => {
        const question = questions.find(q => q.id === a.question_id);
        return question?.variable_key !== 'user_name';
      });
      
      const result = variableManager.validateAnswers(incompleteAnswers, questions);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing answer for required question: user_name');
    });

    it('should validate answer types', () => {
      const invalidAnswer = new AnswerClass({
        question_id: questions.find(q => q.variable_key === 'age')!.id,
        user_id: 'test-user',
        value: 'not a number'
      });
      
      const result = variableManager.validateAnswers([invalidAnswer], questions);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a valid number'))).toBe(true);
    });
  });

  describe('answersToVariableValues', () => {
    it('should convert answers to variable values', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      const answers = [
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'user_name')!.id,
          user_id: 'test-user',
          value: 'John Doe'
        }),
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'age')!.id,
          user_id: 'test-user',
          value: 25
        }),
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'interests')!.id,
          user_id: 'test-user',
          value: ['Technology', 'Sports']
        })
      ];
      
      const variableValues = variableManager.answersToVariableValues(answers, questions);
      
      expect(variableValues).toHaveLength(3);
      expect(variableValues.find(v => v.key === 'user_name')?.value).toBe('John Doe');
      expect(variableValues.find(v => v.key === 'age')?.value).toBe(25);
      expect(variableValues.find(v => v.key === 'interests')?.value).toBe('Technology, Sports');
      
      // All should be from user input
      expect(variableValues.every(v => v.source === 'user_input')).toBe(true);
    });
  });

  describe('getMissingRequiredVariables', () => {
    it('should identify missing required variables', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      const partialAnswers = [
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'user_name')!.id,
          user_id: 'test-user',
          value: 'John Doe'
        })
        // Missing answers for is_premium and preferred_language
      ];
      
      const missing = variableManager.getMissingRequiredVariables(mockVariables, partialAnswers, questions);
      
      expect(missing).toHaveLength(2);
      expect(missing.map(v => v.key)).toEqual(['is_premium', 'preferred_language']);
    });

    it('should return empty array when all required variables are answered', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId);
      const completeAnswers = questions.map(q => new AnswerClass({
        question_id: q.id,
        user_id: 'test-user',
        value: q.type === 'boolean' ? true : 'test-value'
      }));
      
      const missing = variableManager.getMissingRequiredVariables(mockVariables, completeAnswers, questions);
      
      expect(missing).toHaveLength(0);
    });
  });

  describe('generateMissingQuestions', () => {
    it('should generate questions only for missing required variables', () => {
      const allQuestions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      const partialAnswers = [
        new AnswerClass({
          question_id: allQuestions.find(q => q.variable_key === 'user_name')!.id,
          user_id: 'test-user',
          value: 'John Doe'
        })
      ];
      
      const missingQuestions = variableManager.generateMissingQuestions(
        mockVariables, 
        partialAnswers, 
        allQuestions, 
        promptId
      );
      
      expect(missingQuestions).toHaveLength(2);
      expect(missingQuestions.map(q => q.variable_key)).toEqual(['is_premium', 'preferred_language']);
    });
  });

  describe('areAllRequiredVariablesAnswered', () => {
    it('should return true when all required variables are answered', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId);
      const completeAnswers = questions.map(q => new AnswerClass({
        question_id: q.id,
        user_id: 'test-user',
        value: q.type === 'boolean' ? true : 'test-value'
      }));
      
      const result = variableManager.areAllRequiredVariablesAnswered(mockVariables, completeAnswers, questions);
      
      expect(result).toBe(true);
    });

    it('should return false when required variables are missing', () => {
      const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
      const partialAnswers = [
        new AnswerClass({
          question_id: questions.find(q => q.variable_key === 'user_name')!.id,
          user_id: 'test-user',
          value: 'John Doe'
        })
      ];
      
      const result = variableManager.areAllRequiredVariablesAnswered(mockVariables, partialAnswers, questions);
      
      expect(result).toBe(false);
    });
  });

  describe('Answer Collection and Persistence', () => {
    let questions: Question[];

    beforeEach(() => {
      questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
    });

    describe('collectAnswers', () => {
      it('should collect and validate answers successfully', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'age': 25,
          'is_premium': true,
          'preferred_language': 'English',
          'interests': ['Technology', 'Sports']
        };

        const answers = await variableManagerWithStorage.collectAnswers(questions, 'test-user', answerValues);

        expect(answers).toHaveLength(5);
        expect(answerStorage.size()).toBe(5);
        
        const nameAnswer = answers.find(a => {
          const question = questions.find(q => q.id === a.question_id);
          return question?.variable_key === 'user_name';
        });
        expect(nameAnswer?.value).toBe('John Doe');
      });

      it('should skip optional questions with no values', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'is_premium': true,
          'preferred_language': 'English'
          // age and interests are optional and not provided
        };

        const answers = await variableManagerWithStorage.collectAnswers(questions, 'test-user', answerValues);

        expect(answers).toHaveLength(3);
        expect(answerStorage.size()).toBe(3);
      });

      it('should throw error for invalid answers', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'age': 'not a number', // Invalid type
          'is_premium': true,
          'preferred_language': 'English'
        };

        await expect(
          variableManagerWithStorage.collectAnswers(questions, 'test-user', answerValues)
        ).rejects.toThrow('Answer collection failed');
      });

      it('should work without storage but not persist answers', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'is_premium': true,
          'preferred_language': 'English'
        };

        const answers = await variableManager.collectAnswers(questions, 'test-user', answerValues);

        expect(answers).toHaveLength(3);
        // Answers are returned but not persisted since no storage is configured
      });
    });

    describe('getAnswers', () => {
      it('should retrieve answers by question IDs', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'is_premium': true,
          'preferred_language': 'English'
        };

        await variableManagerWithStorage.collectAnswers(questions, 'test-user', answerValues);
        
        const questionIds = questions
          .filter(q => ['user_name', 'is_premium'].includes(q.variable_key))
          .map(q => q.id);

        const retrievedAnswers = await variableManagerWithStorage.getAnswers(questionIds);

        expect(retrievedAnswers).toHaveLength(2);
      });

      it('should return empty array when no storage configured', async () => {
        const answers = await variableManager.getAnswers(['test-id']);
        expect(answers).toHaveLength(0);
      });
    });

    describe('updateAnswer', () => {
      it('should update an existing answer', async () => {
        const answerValues = {
          'user_name': 'John Doe',
          'is_premium': true,
          'preferred_language': 'English'
        };
        const answers = await variableManagerWithStorage.collectAnswers(questions, 'test-user', answerValues);
        
        const nameQuestion = questions.find(q => q.variable_key === 'user_name')!;
        const nameAnswer = answers.find(a => {
          const question = questions.find(q => q.id === a.question_id);
          return question?.variable_key === 'user_name';
        })!;

        await variableManagerWithStorage.updateAnswer(nameAnswer.id, 'Jane Smith', nameQuestion);

        const updatedAnswers = await variableManagerWithStorage.getAnswers([nameQuestion.id]);
        expect(updatedAnswers[0].value).toBe('Jane Smith');
      });

      it('should validate new value before updating', async () => {
        const answerValues = { 'age': 25 };
        const ageQuestions = questions.filter(q => q.variable_key === 'age');
        const answers = await variableManagerWithStorage.collectAnswers(ageQuestions, 'test-user', answerValues);
        
        const ageQuestion = questions.find(q => q.variable_key === 'age')!;
        const answerId = answers[0].id;

        await expect(
          variableManagerWithStorage.updateAnswer(answerId, 'not a number', ageQuestion)
        ).rejects.toThrow('Invalid answer value');
      });
    });
  });

  describe('Variable Substitution Engine', () => {
    describe('substituteVariables', () => {
      it('should substitute variables in template', () => {
        const template = 'Hello {{name}}, you are {{age}} years old and your status is {{premium}}.';
        const values = {
          name: 'John',
          age: 25,
          premium: true
        };

        const result = variableManager.substituteVariables(template, values);

        expect(result).toBe('Hello John, you are 25 years old and your status is true.');
      });

      it('should use default values when variables are missing', () => {
        const template = 'Hello {{name}}, welcome to {{platform}}!';
        const values = { name: 'John' };
        const options = { defaultValues: { platform: 'our service' } };

        const result = variableManager.substituteVariables(template, values, options);

        expect(result).toBe('Hello John, welcome to our service!');
      });

      it('should replace missing variables with empty string in non-strict mode', () => {
        const template = 'Hello {{name}}, your {{missing}} is here.';
        const values = { name: 'John' };

        const result = variableManager.substituteVariables(template, values);

        expect(result).toBe('Hello John, your  is here.');
      });

      it('should throw error for missing variables in strict mode', () => {
        const template = 'Hello {{name}}, your {{missing}} is here.';
        const values = { name: 'John' };

        expect(() => {
          variableManager.substituteVariables(template, values, { strict: true });
        }).toThrow('Missing required variables: missing');
      });

      it('should handle array values by joining with commas', () => {
        const template = 'Your interests are: {{interests}}';
        const values = { interests: ['Technology', 'Sports', 'Music'] };

        const result = variableManager.substituteVariables(template, values);

        expect(result).toBe('Your interests are: Technology, Sports, Music');
      });

      it('should handle object values by JSON stringifying', () => {
        const template = 'Config: {{config}}';
        const values = { config: { theme: 'dark', lang: 'en' } };

        const result = variableManager.substituteVariables(template, values);

        expect(result).toBe('Config: {"theme":"dark","lang":"en"}');
      });
    });

    describe('substituteVariablesFromAnswers', () => {
      it('should substitute variables using answers and questions', () => {
        const questions = variableManager.generateQuestions(mockVariables, promptId, { includeOptional: true });
        const answers = [
          new AnswerClass({
            question_id: questions.find(q => q.variable_key === 'user_name')!.id,
            user_id: 'test-user',
            value: 'John Doe'
          }),
          new AnswerClass({
            question_id: questions.find(q => q.variable_key === 'age')!.id,
            user_id: 'test-user',
            value: 25
          })
        ];

        const template = 'Hello {{user_name}}, you are {{age}} years old.';
        const result = variableManager.substituteVariablesFromAnswers(template, answers, questions);

        expect(result).toBe('Hello John Doe, you are 25 years old.');
      });
    });

    describe('extractVariableNames', () => {
      it('should extract all variable names from template', () => {
        const template = 'Hello {{name}}, you are {{age}} years old. {{name}} is {{status}}.';
        const variables = variableManager.extractVariableNames(template);

        expect(variables).toEqual(['name', 'age', 'status']);
      });

      it('should handle templates with no variables', () => {
        const template = 'This is a plain text template.';
        const variables = variableManager.extractVariableNames(template);

        expect(variables).toEqual([]);
      });

      it('should handle variables with spaces', () => {
        const template = 'Hello {{ name }}, welcome to {{ platform }}!';
        const variables = variableManager.extractVariableNames(template);

        expect(variables).toEqual(['name', 'platform']);
      });
    });

    describe('validateVariableSubstitution', () => {
      it('should validate successful substitution', () => {
        const questions = variableManager.generateQuestions(mockVariables, promptId);
        const answers = questions.map(q => new AnswerClass({
          question_id: q.id,
          user_id: 'test-user',
          value: q.type === 'boolean' ? true : 'test-value'
        }));

        const template = 'Hello {{user_name}}, premium: {{is_premium}}, language: {{preferred_language}}';
        const result = variableManager.validateVariableSubstitution(template, mockVariables, answers, questions);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect undefined variables in template', () => {
        const questions = variableManager.generateQuestions(mockVariables, promptId);
        const answers: Answer[] = [];

        const template = 'Hello {{user_name}}, your {{undefined_var}} is here.';
        const result = variableManager.validateVariableSubstitution(template, mockVariables, answers, questions);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Template references undefined variable: undefined_var');
      });

      it('should detect missing required variables', () => {
        const questions = variableManager.generateQuestions(mockVariables, promptId);
        const partialAnswers = [
          new AnswerClass({
            question_id: questions.find(q => q.variable_key === 'user_name')!.id,
            user_id: 'test-user',
            value: 'John Doe'
          })
          // Missing is_premium and preferred_language
        ];

        const template = 'Hello {{user_name}}, premium: {{is_premium}}, language: {{preferred_language}}';
        const result = variableManager.validateVariableSubstitution(template, mockVariables, partialAnswers, questions);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Required variable 'is_premium' has no answer");
        expect(result.errors).toContain("Required variable 'preferred_language' has no answer");
      });
    });
  });
});