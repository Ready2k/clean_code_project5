import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { RatingWidget } from '../RatingWidget';

describe('RatingWidget', () => {
  const mockOnSubmitRating = vi.fn();

  beforeEach(() => {
    mockOnSubmitRating.mockClear();
  });

  it('renders rating widget correctly', () => {
    render(
      <RatingWidget
        onSubmitRating={mockOnSubmitRating}
      />
    );

    expect(screen.getByText('Rate This Prompt')).toBeInTheDocument();
    expect(screen.getByText('How would you rate this prompt?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit rating/i })).toBeDisabled();
  });

  it('enables submit button when rating is selected', async () => {
    render(
      <RatingWidget
        onSubmitRating={mockOnSubmitRating}
      />
    );

    const stars = screen.getAllByRole('radio');
    fireEvent.click(stars[4]); // Click 5th star

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit rating/i })).not.toBeDisabled();
    });
  });

  it('shows current user rating when provided', () => {
    const currentRating = {
      id: '1',
      score: 4,
      note: 'Great prompt!'
    };

    render(
      <RatingWidget
        currentUserRating={currentRating}
        onSubmitRating={mockOnSubmitRating}
      />
    );

    expect(screen.getByText('Update Your Rating')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Great prompt!')).toBeInTheDocument();
  });

  it('calls onSubmitRating when form is submitted', async () => {
    mockOnSubmitRating.mockResolvedValue(undefined);

    render(
      <RatingWidget
        onSubmitRating={mockOnSubmitRating}
      />
    );

    const stars = screen.getAllByRole('radio');
    fireEvent.click(stars[3]); // Click 4th star

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmitRating).toHaveBeenCalledWith({
        score: 4,
        note: undefined
      });
    });
  });
});