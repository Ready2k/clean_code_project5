// Tests for variable data models

import { describe, it, expect } from 'vitest';
import { QuestionClass, AnswerClass } from '../variable';
import { VariableType } from '../../types/common';

describe('QuestionClass', () => {
  it('should create a question with required fields', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'test_var',
      text: 'What is your name?',
      type: 'string'
    });

    expect(question.id).toBeDefined();
    expect(question.prompt_id).toBe('prompt-1');
    expect(question.variable_key).toBe('test_var');
    expect(question.text).toBe('What is your name?');
    expect(question.type).toBe('string');
    expect(question.required).toBe(false);
  });

  it('should validate correctly', () => {
    const validQuestion = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'test_var',
      text: 'What is your name?',
      type: 'string'
    });

    const result = validQuestion.validate();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should fail validation for select without options', () => {
    const invalidQuestion = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'test_var',
      text: 'Choose an option',
      type: 'select'
    });

    const result = invalidQuestion.validate();
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Question of type 'select' must have options");
  });

  it('should create question from variable definition', () => {
    const variable = {
      key: 'user_name',
      label: 'User Name',
      type: 'string' as VariableType,
      required: true
    };

    const question = QuestionClass.fromVariable(variable, 'prompt-1');
    
    expect(question.variable_key).toBe('user_name');
    expect(question.text).toBe('User Name *');
    expect(question.required).toBe(true);
  });

  it('should create select question with options', () => {
    const variable = {
      key: 'priority',
      label: 'Priority Level',
      type: 'select' as VariableType,
      required: false,
      options: ['low', 'medium', 'high']
    };

    const question = QuestionClass.fromVariable(variable, 'prompt-1');
    
    expect(question.text).toBe('Priority Level (choose one: low, medium, high)');
    expect(question.options).toEqual(['low', 'medium', 'high']);
  });
});

describe('AnswerClass', () => {
  it('should create an answer with required fields', () => {
    const answer = new AnswerClass({
      question_id: 'question-1',
      user_id: 'user-1',
      value: 'John Doe'
    });

    expect(answer.id).toBeDefined();
    expect(answer.question_id).toBe('question-1');
    expect(answer.user_id).toBe('user-1');
    expect(answer.value).toBe('John Doe');
    expect(answer.created_at).toBeDefined();
  });

  it('should validate string answer correctly', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'name',
      text: 'What is your name?',
      type: 'string',
      required: true
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: 'John Doe'
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(true);
  });

  it('should fail validation for required field with empty value', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'name',
      text: 'What is your name?',
      type: 'string',
      required: true
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: ''
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Answer is required for this question');
  });

  it('should validate number answer correctly', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'age',
      text: 'What is your age?',
      type: 'number',
      required: true
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: 25
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(true);
  });

  it('should fail validation for invalid number', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'age',
      text: 'What is your age?',
      type: 'number',
      required: true
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: 'not a number'
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Answer must be a valid number');
  });

  it('should validate select answer correctly', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'priority',
      text: 'Choose priority',
      type: 'select',
      required: true,
      options: ['low', 'medium', 'high']
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: 'high'
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(true);
  });

  it('should fail validation for invalid select option', () => {
    const question = new QuestionClass({
      prompt_id: 'prompt-1',
      variable_key: 'priority',
      text: 'Choose priority',
      type: 'select',
      required: true,
      options: ['low', 'medium', 'high']
    });

    const answer = new AnswerClass({
      question_id: question.id,
      user_id: 'user-1',
      value: 'invalid'
    });

    const result = answer.validate(question);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Answer must be one of: low, medium, high');
  });

  it('should normalize values correctly', () => {
    const stringAnswer = new AnswerClass({
      question_id: 'q1',
      user_id: 'u1',
      value: 'test'
    });
    expect(stringAnswer.getNormalizedValue()).toBe('test');

    const numberAnswer = new AnswerClass({
      question_id: 'q1',
      user_id: 'u1',
      value: 42
    });
    expect(numberAnswer.getNormalizedValue()).toBe(42);

    const arrayAnswer = new AnswerClass({
      question_id: 'q1',
      user_id: 'u1',
      value: ['a', 'b', 'c']
    });
    expect(arrayAnswer.getNormalizedValue()).toBe('a, b, c');
  });
});