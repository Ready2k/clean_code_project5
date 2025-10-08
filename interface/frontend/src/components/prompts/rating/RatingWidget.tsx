import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Rating,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { StarBorder, Star } from '@mui/icons-material';

interface RatingWidgetProps {
  currentUserRating?: {
    id: string;
    score: number;
    note?: string;
  } | null;
  onSubmitRating: (rating: { score: number; note?: string }) => Promise<void>;
  disabled?: boolean;
}

export const RatingWidget: React.FC<RatingWidgetProps> = ({
  currentUserRating,
  onSubmitRating,
  disabled = false,
}) => {
  const [score, setScore] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with current user rating if available
  useEffect(() => {
    if (currentUserRating) {
      setScore(currentUserRating.score);
      setNote(currentUserRating.note || '');
    } else {
      setScore(0);
      setNote('');
    }
  }, [currentUserRating]);

  const handleSubmit = async () => {
    if (score === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await onSubmitRating({
        score,
        note: note.trim() || undefined,
      });
      setSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setScore(0);
    setNote('');
    setError(null);
    setSuccess(false);
  };

  const isModified = currentUserRating 
    ? score !== currentUserRating.score || note !== (currentUserRating.note || '')
    : score > 0 || note.trim().length > 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        {currentUserRating ? 'Update Your Rating' : 'Rate This Prompt'}
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Rating {currentUserRating ? 'updated' : 'submitted'} successfully!
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          How would you rate this prompt?
        </Typography>
        <Rating
          value={score}
          onChange={(_, newValue) => {
            setScore(newValue || 0);
            setError(null);
          }}
          size="large"
          icon={<Star fontSize="inherit" />}
          emptyIcon={<StarBorder fontSize="inherit" />}
          disabled={disabled || isSubmitting}
          sx={{ fontSize: '2rem' }}
        />
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {score === 0 && 'Select a rating'}
            {score === 1 && 'Poor - Not useful'}
            {score === 2 && 'Fair - Somewhat useful'}
            {score === 3 && 'Good - Useful'}
            {score === 4 && 'Very Good - Very useful'}
            {score === 5 && 'Excellent - Extremely useful'}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Additional Comments (Optional)"
          multiline
          rows={3}
          fullWidth
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Share your thoughts about this prompt..."
          disabled={disabled || isSubmitting}
          inputProps={{ maxLength: 1000 }}
          helperText={`${note.length}/1000 characters`}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || score === 0 || !isModified}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting 
            ? 'Submitting...' 
            : currentUserRating 
              ? 'Update Rating' 
              : 'Submit Rating'
          }
        </Button>
        
        {isModified && (
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={disabled || isSubmitting}
          >
            Reset
          </Button>
        )}
      </Box>
    </Paper>
  );
};