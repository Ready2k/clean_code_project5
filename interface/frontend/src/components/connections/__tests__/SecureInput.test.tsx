import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SecureInput } from '../SecureInput';

describe('SecureInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with label and security icon', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
      />
    );

    expect(screen.getByLabelText(/Test Input/i)).toBeInTheDocument();
    expect(screen.getByTestId('SecurityIcon')).toBeInTheDocument();
  });

  it('masks value when not focused', () => {
    render(
      <SecureInput
        label="Test Input"
        value="secret-value-123"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText(/Test Input/i) as HTMLInputElement;
    // The masking logic shows first 4 and last 4 characters
    expect(input.value).toBe('secr••••••••-123');
  });

  it('shows full value when focused', () => {
    render(
      <SecureInput
        label="Test Input"
        value="secret-value-123"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText(/Test Input/i) as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.value).toBe('secret-value-123');
  });

  it('toggles visibility when visibility button is clicked', () => {
    render(
      <SecureInput
        label="Test Input"
        value="secret-value-123"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText(/Test Input/i) as HTMLInputElement;
    const toggleButton = screen.getByRole('button');

    // Initially masked
    expect(input.value).toBe('secr••••••••-123');

    // Click to show
    fireEvent.click(toggleButton);
    expect(input.value).toBe('secret-value-123');

    // Click to hide
    fireEvent.click(toggleButton);
    expect(input.value).toBe('secr••••••••-123');
  });

  it('calls onChange when value changes', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByLabelText(/Test Input/i);
    fireEvent.change(input, { target: { value: 'new-value' } });

    expect(mockOnChange).toHaveBeenCalledWith('new-value');
  });

  it('displays error message', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
        error="This field is required"
      />
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('displays helper text', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
        helperText="Enter your API key"
      />
    );

    expect(screen.getByText('Enter your API key')).toBeInTheDocument();
  });

  it('shows security info by default', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/Your credentials are encrypted/i)).toBeInTheDocument();
  });

  it('hides security info when showSecurityInfo is false', () => {
    render(
      <SecureInput
        label="Test Input"
        value=""
        onChange={mockOnChange}
        showSecurityInfo={false}
      />
    );

    expect(screen.queryByText(/Your credentials are encrypted/i)).not.toBeInTheDocument();
  });
});