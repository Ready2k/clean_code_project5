import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography,
  Divider,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Accessibility as AccessibilityIcon,
  TextIncrease as TextIncreaseIcon,
  Contrast as ContrastIcon,
  Speed as SpeedIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  setThemeMode,
  setHighContrast,
  setFontSize,
  setReducedMotion,
  ThemeMode,
  FontSize,
} from '../../store/slices/uiSlice';

export const AccessibilitySettings: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    themeMode,
    highContrast,
    fontSize,
    reducedMotion,
  } = useAppSelector((state) => state.ui);

  const handleThemeModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setThemeMode(event.target.value as ThemeMode));
  };

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setFontSize(event.target.value as FontSize));
  };

  const handleHighContrastChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setHighContrast(event.target.checked));
  };

  const handleReducedMotionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setReducedMotion(event.target.checked));
  };

  const handleResetToDefaults = () => {
    dispatch(setThemeMode('auto'));
    dispatch(setHighContrast(false));
    dispatch(setFontSize('medium'));
    dispatch(setReducedMotion(false));
  };

  return (
    <Card
      sx={{
        maxWidth: 600,
        margin: 'auto',
      }}
      role="region"
      aria-labelledby="accessibility-settings-title"
    >
      <CardHeader
        avatar={<AccessibilityIcon />}
        title={
          <Typography
            id="accessibility-settings-title"
            variant="h6"
            component="h2"
          >
            Accessibility Settings
          </Typography>
        }
        subheader="Customize the interface to meet your accessibility needs"
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Theme Mode */}
          <FormControl component="fieldset">
            <FormLabel
              component="legend"
              id="theme-mode-label"
              sx={{ mb: 1, fontWeight: 500 }}
            >
              Theme Mode
            </FormLabel>
            <RadioGroup
              aria-labelledby="theme-mode-label"
              value={themeMode}
              onChange={handleThemeModeChange}
              row
            >
              <FormControlLabel
                value="light"
                control={<Radio />}
                label="Light"
              />
              <FormControlLabel
                value="dark"
                control={<Radio />}
                label="Dark"
              />
              <FormControlLabel
                value="auto"
                control={<Radio />}
                label="Auto (System)"
              />
            </RadioGroup>
          </FormControl>

          <Divider />

          {/* Font Size */}
          <FormControl component="fieldset">
            <FormLabel
              component="legend"
              id="font-size-label"
              sx={{ mb: 1, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <TextIncreaseIcon fontSize="small" />
              Font Size
            </FormLabel>
            <RadioGroup
              aria-labelledby="font-size-label"
              value={fontSize}
              onChange={handleFontSizeChange}
              row
            >
              <FormControlLabel
                value="small"
                control={<Radio />}
                label="Small"
              />
              <FormControlLabel
                value="medium"
                control={<Radio />}
                label="Medium"
              />
              <FormControlLabel
                value="large"
                control={<Radio />}
                label="Large"
              />
              <FormControlLabel
                value="extraLarge"
                control={<Radio />}
                label="Extra Large"
              />
            </RadioGroup>
          </FormControl>

          <Divider />

          {/* High Contrast */}
          <Box>
            <Tooltip
              title="Increases color contrast for better visibility"
              placement="top"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={highContrast}
                    onChange={handleHighContrastChange}
                    inputProps={{
                      'aria-describedby': 'high-contrast-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ContrastIcon fontSize="small" />
                    High Contrast Mode
                  </Box>
                }
              />
            </Tooltip>
            <Typography
              id="high-contrast-description"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 4, mt: 0.5 }}
            >
              Enhances color contrast for improved readability
            </Typography>
          </Box>

          <Divider />

          {/* Reduced Motion */}
          <Box>
            <Tooltip
              title="Reduces animations and transitions for users sensitive to motion"
              placement="top"
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={reducedMotion}
                    onChange={handleReducedMotionChange}
                    inputProps={{
                      'aria-describedby': 'reduced-motion-description',
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SpeedIcon fontSize="small" />
                    Reduce Motion
                  </Box>
                }
              />
            </Tooltip>
            <Typography
              id="reduced-motion-description"
              variant="body2"
              color="text.secondary"
              sx={{ ml: 4, mt: 0.5 }}
            >
              Minimizes animations and transitions
            </Typography>
          </Box>

          <Divider />

          {/* Reset Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<ResetIcon />}
              onClick={handleResetToDefaults}
              aria-label="Reset all accessibility settings to default values"
            >
              Reset to Defaults
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AccessibilitySettings;