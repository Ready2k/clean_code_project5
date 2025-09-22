import { createTheme, ThemeOptions } from '@mui/material/styles';
import { useAppSelector } from '../hooks/redux';
import { useMemo } from 'react';

// Accessibility and responsive breakpoints
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
};

// Define color palette
// High contrast palette for accessibility
const highContrastLightPalette = {
  primary: {
    main: '#000000',
    light: '#333333',
    dark: '#000000',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#ffffff',
    light: '#ffffff',
    dark: '#cccccc',
    contrastText: '#000000',
  },
  error: {
    main: '#cc0000',
    light: '#ff3333',
    dark: '#990000',
  },
  warning: {
    main: '#ff6600',
    light: '#ff9933',
    dark: '#cc5200',
  },
  info: {
    main: '#0066cc',
    light: '#3399ff',
    dark: '#004499',
  },
  success: {
    main: '#006600',
    light: '#339933',
    dark: '#004400',
  },
  background: {
    default: '#ffffff',
    paper: '#ffffff',
  },
  text: {
    primary: '#000000',
    secondary: '#333333',
  },
};

const lightPalette = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#9a0036',
    contrastText: '#ffffff',
  },
  error: {
    main: '#d32f2f',
    light: '#ef5350',
    dark: '#c62828',
  },
  warning: {
    main: '#ed6c02',
    light: '#ff9800',
    dark: '#e65100',
  },
  info: {
    main: '#0288d1',
    light: '#03a9f4',
    dark: '#01579b',
  },
  success: {
    main: '#2e7d32',
    light: '#4caf50',
    dark: '#1b5e20',
  },
  background: {
    default: '#fafafa',
    paper: '#ffffff',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
  },
};

// High contrast dark palette for accessibility
const highContrastDarkPalette = {
  primary: {
    main: '#ffffff',
    light: '#ffffff',
    dark: '#cccccc',
    contrastText: '#000000',
  },
  secondary: {
    main: '#000000',
    light: '#333333',
    dark: '#000000',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ff4444',
    light: '#ff6666',
    dark: '#cc0000',
  },
  warning: {
    main: '#ffaa00',
    light: '#ffcc33',
    dark: '#cc8800',
  },
  info: {
    main: '#44aaff',
    light: '#66bbff',
    dark: '#0088cc',
  },
  success: {
    main: '#44cc44',
    light: '#66dd66',
    dark: '#339933',
  },
  background: {
    default: '#000000',
    paper: '#000000',
  },
  text: {
    primary: '#ffffff',
    secondary: '#cccccc',
  },
};

const darkPalette = {
  primary: {
    main: '#90caf9',
    light: '#e3f2fd',
    dark: '#42a5f5',
    contrastText: '#000000',
  },
  secondary: {
    main: '#f48fb1',
    light: '#fce4ec',
    dark: '#ad1457',
    contrastText: '#000000',
  },
  error: {
    main: '#f44336',
    light: '#e57373',
    dark: '#d32f2f',
  },
  warning: {
    main: '#ffa726',
    light: '#ffb74d',
    dark: '#f57c00',
  },
  info: {
    main: '#29b6f6',
    light: '#4fc3f7',
    dark: '#0288d1',
  },
  success: {
    main: '#66bb6a',
    light: '#81c784',
    dark: '#388e3c',
  },
  background: {
    default: '#121212',
    paper: '#1e1e1e',
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
  },
};

// Font size multipliers for accessibility
const fontSizeMultipliers = {
  small: 0.875,
  medium: 1,
  large: 1.125,
  extraLarge: 1.25,
};

// Common theme options with accessibility enhancements
const createCommonThemeOptions = (
  fontSizeMultiplier: number = 1,
  reducedMotion: boolean = false
): ThemeOptions => ({
  breakpoints,
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: `${2.125 * fontSizeMultiplier}rem`,
      fontWeight: 300,
      lineHeight: 1.167,
    },
    h2: {
      fontSize: `${1.5 * fontSizeMultiplier}rem`,
      fontWeight: 400,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: `${1.25 * fontSizeMultiplier}rem`,
      fontWeight: 500,
      lineHeight: 1.167,
    },
    h4: {
      fontSize: `${1.125 * fontSizeMultiplier}rem`,
      fontWeight: 500,
      lineHeight: 1.235,
    },
    h5: {
      fontSize: `${1 * fontSizeMultiplier}rem`,
      fontWeight: 500,
      lineHeight: 1.334,
    },
    h6: {
      fontSize: `${0.875 * fontSizeMultiplier}rem`,
      fontWeight: 500,
      lineHeight: 1.6,
    },
    body1: {
      fontSize: `${1 * fontSizeMultiplier}rem`,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: `${0.875 * fontSizeMultiplier}rem`,
      lineHeight: 1.43,
    },
    button: {
      fontSize: `${0.875 * fontSizeMultiplier}rem`,
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  transitions: {
    duration: {
      shortest: reducedMotion ? 0 : 150,
      shorter: reducedMotion ? 0 : 200,
      short: reducedMotion ? 0 : 250,
      standard: reducedMotion ? 0 : 300,
      complex: reducedMotion ? 0 : 375,
      enteringScreen: reducedMotion ? 0 : 225,
      leavingScreen: reducedMotion ? 0 : 195,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 44, // Minimum touch target size for accessibility
          '&:focus-visible': {
            outline: '2px solid currentColor',
            outlineOffset: '2px',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44, // Minimum touch target size
          minHeight: 44,
          '&:focus-visible': {
            outline: '2px solid currentColor',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
          '&:focus-within': {
            outline: '2px solid currentColor',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:focus-within': {
              outline: '2px solid currentColor',
              outlineOffset: '2px',
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
          boxShadow: '2px 0px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: 16,
          paddingRight: 16,
          '@media (min-width: 600px)': {
            paddingLeft: 24,
            paddingRight: 24,
          },
        },
      },
    },
    MuiGrid: {
      styleOverrides: {
        container: {
          '@media (max-width: 599px)': {
            margin: 0,
            width: '100%',
            '& > .MuiGrid-item': {
              paddingLeft: 8,
              paddingTop: 8,
            },
          },
        },
      },
    },
  },
});

// Create theme variants
const createThemeVariant = (
  palette: any,
  mode: 'light' | 'dark',
  fontSizeMultiplier: number = 1,
  reducedMotion: boolean = false
) => {
  return createTheme({
    ...createCommonThemeOptions(fontSizeMultiplier, reducedMotion),
    palette: {
      mode,
      ...palette,
    },
  });
};

// Hook to get the current theme based on user preferences
export const useTheme = () => {
  const themeMode = useAppSelector((state) => state.ui.themeMode);
  const highContrast = useAppSelector((state) => state.ui.highContrast);
  const fontSize = useAppSelector((state) => state.ui.fontSize);
  const reducedMotion = useAppSelector((state) => state.ui.reducedMotion);

  const theme = useMemo(() => {
    const fontSizeMultiplier = fontSizeMultipliers[fontSize] || 1;
    const prefersReducedMotion = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let selectedMode: 'light' | 'dark' = 'light';
    if (themeMode === 'dark') {
      selectedMode = 'dark';
    } else if (themeMode === 'auto') {
      selectedMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    let selectedPalette;
    if (highContrast) {
      selectedPalette = selectedMode === 'dark' ? highContrastDarkPalette : highContrastLightPalette;
    } else {
      selectedPalette = selectedMode === 'dark' ? darkPalette : lightPalette;
    }

    return createThemeVariant(selectedPalette, selectedMode, fontSizeMultiplier, prefersReducedMotion);
  }, [themeMode, highContrast, fontSize, reducedMotion]);

  return theme;
};

// Default themes for fallback
export const lightTheme = createThemeVariant(lightPalette, 'light');
export const darkTheme = createThemeVariant(darkPalette, 'dark');
export const theme = lightTheme;