import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';

import { RegisterPage } from '../RegisterPage';
import authReducer from '../../../store/slices/authSlice';

// Mock the auth API
vi.mock('../../../services/api/authAPI', () => ({
  authAPI: {
    register: vi.fn(),
  },
}));

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
    },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        ...initialState,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('RegisterPage', () => {
  it('renders registration form', () => {
    renderWithProviders(<RegisterPage />);
    
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    renderWithProviders(<RegisterPage />);
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('shows password mismatch error', async () => {
    renderWithProviders(<RegisterPage />);
    
    const passwordInput = screen.getByLabelText(/^password/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPassword123!' } });
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('displays error message when registration fails', () => {
    renderWithProviders(<RegisterPage />, { error: 'Registration failed' });
    
    expect(screen.getByText('Registration failed')).toBeInTheDocument();
  });

  it('shows loading state during registration', () => {
    renderWithProviders(<RegisterPage />, { isLoading: true });
    
    expect(screen.getByText('Creating Account...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });
});