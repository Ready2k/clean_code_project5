import React from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  Paper,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Send as SubmitIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { submitQuestionnaireResponse } from '../../../store/slices/enhancementSlice';
import { EnhancementProgress, EnhancementQuestion } from '../../../types/enhancement';

// Backend Question interface (different from frontend EnhancementQuestion)
interface BackendQuestion {
  id: string;
  text: string;
  type: 'string' | 'number' | 'select' | 'multiselect' | 'boolean';
  required: boolean;
  options?: string[];
  help_text?: string;
}

// Transform backend questions to frontend format
const transformQuestions = (backendQuestions: BackendQuestion[]): EnhancementQuestion[] => {
  return backendQuestions.map(q => ({
    id: q.id,
    question: q.text, // Backend uses 'text', frontend expects 'question'
    type: q.type === 'string' ? 'text' : q.type, // Map 'string' to 'text'
    required: q.required,
    options: q.options,
    helpText: q.help_text, // Backend uses 'help_text', frontend expects 'helpText'
  }));
};

interface EnhancementQuestionnaireProps {
  job: EnhancementProgress | null;
  onSubmitted: () => void;
}

export const EnhancementQuestionnaire: React.FC<EnhancementQuestionnaireProps> = ({
  job,
  onSubmitted,
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.enhancement);

  const [answers, setAnswers] = React.useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  // Memoize the transformed questions to prevent unnecessary re-renders
  const questions = React.useMemo(() => {
    const backendQuestions = job?.result?.questions || [];
    return transformQuestions(backendQuestions as unknown as BackendQuestion[]);
  }, [job?.result?.questions]);

  React.useEffect(() => {
    // Initialize answers with default values
    const initialAnswers: Record<string, any> = {};
    questions.forEach(question => {
      if (question.type === 'boolean') {
        initialAnswers[question.id] = false;
      } else if (question.type === 'multiselect') {
        initialAnswers[question.id] = [];
      } else {
        initialAnswers[question.id] = '';
      }
    });
    setAnswers(initialAnswers);
  }, [questions]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));

    // Clear validation error for this question
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateAnswers = (): boolean => {
    const errors: Record<string, string> = {};

    (questions || []).forEach(question => {
      if (question.required) {
        const answer = answers[question.id];

        if (question.type === 'multiselect') {
          if (!Array.isArray(answer) || answer.length === 0) {
            errors[question.id] = 'Please select at least one option';
          }
        } else if (question.type === 'boolean') {
          // Boolean questions are always valid (true/false)
        } else {
          if (!answer || (typeof answer === 'string' && answer.trim() === '')) {
            errors[question.id] = 'This field is required';
          }
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!job || !validateAnswers()) return;

    try {
      await dispatch(submitQuestionnaireResponse({
        promptId: job.promptId,
        jobId: job.jobId,
        answers,
      })).unwrap();

      onSubmitted();
    } catch (error) {
      console.error('Failed to submit questionnaire:', error);
    }
  };

  const renderQuestion = (question: EnhancementQuestion) => {
    const answer = answers[question.id];
    const hasError = !!validationErrors[question.id];

    switch (question.type) {
      case 'text':
      case 'string': // Backend sends 'string' type, treat as 'text'
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            value={answer || ''}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder={question.placeholder}
            error={hasError}
            helperText={validationErrors[question.id] || question.helpText}
            required={question.required}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={hasError}>
            <InputLabel required={question.required}>Select an option</InputLabel>
            <Select
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              label="Select an option"
            >
              {question.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {(validationErrors[question.id] || question.helpText) && (
              <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'} sx={{ mt: 0.5, ml: 1.5 }}>
                {validationErrors[question.id] || question.helpText}
              </Typography>
            )}
          </FormControl>
        );

      case 'multiselect':
        return (
          <Box>
            {question.options?.map((option) => (
              <FormControlLabel
                key={option}
                control={
                  <Checkbox
                    checked={Array.isArray(answer) && answer.includes(option)}
                    onChange={(e) => {
                      const currentAnswers = Array.isArray(answer) ? answer : [];
                      if (e.target.checked) {
                        handleAnswerChange(question.id, [...currentAnswers, option]);
                      } else {
                        handleAnswerChange(question.id, currentAnswers.filter(a => a !== option));
                      }
                    }}
                  />
                }
                label={option}
              />
            ))}
            {(validationErrors[question.id] || question.helpText) && (
              <Typography variant="caption" color={hasError ? 'error' : 'text.secondary'} sx={{ display: 'block', mt: 0.5 }}>
                {validationErrors[question.id] || question.helpText}
              </Typography>
            )}
          </Box>
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            value={answer || ''}
            onChange={(e) => handleAnswerChange(question.id, parseFloat(e.target.value) || '')}
            placeholder={question.placeholder}
            error={hasError}
            helperText={validationErrors[question.id] || question.helpText}
            required={question.required}
          />
        );

      case 'boolean':
        return (
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!answer}
                  onChange={(e) => handleAnswerChange(question.id, e.target.checked)}
                />
              }
              label="Yes"
            />
            {question.helpText && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {question.helpText}
              </Typography>
            )}
          </Box>
        );

      default:
        return (
          <Alert severity="warning">
            Unsupported question type: {question.type}
          </Alert>
        );
    }
  };

  if (!job || !questions.length) {
    return (
      <Alert severity="info">
        No questions available for this enhancement.
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Alert severity="info">
        The AI needs additional information to provide the best enhancement.
        Please answer the following questions to help improve your prompt.
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Enhancement Questions ({questions.length})
        </Typography>

        <Box display="flex" flexDirection="column" gap={3}>
          {questions.map((question, index) => (
            <Box key={question.id}>
              <Typography variant="subtitle1" gutterBottom>
                {index + 1}. {question.question}
                {question.required && (
                  <Typography component="span" color="error.main">
                    {' *'}
                  </Typography>
                )}
              </Typography>

              {renderQuestion(question)}

              {index < questions.length - 1 && (
                <Divider sx={{ mt: 2 }} />
              )}
            </Box>
          ))}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="flex-end" gap={2}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <SubmitIcon />}
          size="large"
        >
          {isLoading ? 'Submitting...' : 'Submit Answers'}
        </Button>
      </Box>
    </Box>
  );
};