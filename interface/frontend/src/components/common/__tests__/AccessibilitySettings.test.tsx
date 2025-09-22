import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '@mui/material/styles';
import { AccessibilitySettings } from '../AccessibilitySettings';
import uiSlice from '../../../store/slices/uiSlice';
import { lightTheme } from '../../../theme';

// Mock store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      ui: uiSlice,
    },
    preloadedState: {
      ui: {
        themeMode: 'light',
        highContrast: false,
        fontSize: 'medium',
        reducedMotion: false,
        sidebarOpen: true,
        loading: { global: false },
        notifications: [],
        modals: {},
        ...initialState,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createMockStore(initialState);
  return render(
    <Provider store={store}>
      <ThemeProvider theme={lightTheme}>
        {component}
      </ThemeProvider>
    </Provider>
  );
};

describe('AccessibilitySettings', () => {
  it('renders accessibility settings with proper ARIA labels', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    expect(screen.getByRole('region', { name: /accessibility settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/theme mode/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/font size/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /increases color contrast for better visibility/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /reduces animations and transitions for users sensitive to motion/i })).toBeInTheDocument();
  });

  it('allows changing theme mode', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    const darkModeRadio = screen.getByRole('radio', { name: /dark/i });
    fireEvent.click(darkModeRadio);
    
    expect(darkModeRadio).toBeChecked();
  });

  it('allows changing font size', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    const largeFontRadio = screen.getByRole('radio', { name: 'Large' });
    fireEvent.click(largeFontRadio);
    
    expect(largeFontRadio).toBeChecked();
  });

  it('allows toggling high contrast mode', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    const highContrastSwitch = screen.getByRole('checkbox', { name: /increases color contrast for better visibility/i });
    fireEvent.click(highContrastSwitch);
    
    expect(highContrastSwitch).toBeChecked();
  });

  it('allows toggling reduced motion', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    const reducedMotionSwitch = screen.getByRole('checkbox', { name: /reduces animations and transitions for users sensitive to motion/i });
    fireEvent.click(reducedMotionSwitch);
    
    expect(reducedMotionSwitch).toBeChecked();
  });

  it('has proper keyboard navigation', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    const resetButton = screen.getByRole('button', { name: /reset all accessibility settings/i });
    expect(resetButton).toBeInTheDocument();
    
    // Test that the button is focusable
    resetButton.focus();
    expect(resetButton).toHaveFocus();
  });

  it('provides descriptive text for screen readers', () => {
    renderWithProviders(<AccessibilitySettings />);
    
    expect(screen.getByText(/enhances color contrast for improved readability/i)).toBeInTheDocument();
    expect(screen.getByText(/minimizes animations and transitions/i)).toBeInTheDocument();
  });
});