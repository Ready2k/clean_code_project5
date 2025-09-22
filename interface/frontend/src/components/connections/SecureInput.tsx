import React, { useState } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Alert
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Security as SecurityIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface SecureInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  margin?: 'none' | 'dense' | 'normal';
  showSecurityInfo?: boolean;
}

export const SecureInput: React.FC<SecureInputProps> = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  placeholder,
  fullWidth = true,
  margin = 'normal',
  showSecurityInfo = true
}) => {
  const [showValue, setShowValue] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleToggleVisibility = () => {
    setShowValue(!showValue);
  };

  const getMaskedValue = () => {
    if (showValue || focused) return value;
    if (!value) return '';
    
    // Show first 4 and last 4 characters, mask the middle
    if (value.length <= 8) {
      return '•'.repeat(value.length);
    }
    
    const start = value.substring(0, 4);
    const end = value.substring(value.length - 4);
    const middle = '•'.repeat(Math.max(0, value.length - 8));
    
    return `${start}${middle}${end}`;
  };

  return (
    <Box>
      <TextField
        fullWidth={fullWidth}
        label={label}
        type={showValue ? 'text' : 'password'}
        value={focused ? value : getMaskedValue()}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        error={!!error}
        helperText={error || helperText}
        margin={margin}
        required={required}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SecurityIcon color="action" fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={showValue ? 'Hide value' : 'Show value'}>
                <IconButton
                  onClick={handleToggleVisibility}
                  edge="end"
                  size="small"
                >
                  {showValue ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          )
        }}
      />
      
      {showSecurityInfo && (
        <Alert 
          severity="info" 
          icon={<InfoIcon />}
          sx={{ mt: 1, fontSize: '0.75rem' }}
        >
          <Typography variant="caption">
            Your credentials are encrypted before storage and never logged or transmitted in plain text.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};