import React from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { Variable } from '../../../types/prompts';

interface VariableInputFormProps {
  variables: Variable[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

const VariableInputForm: React.FC<VariableInputFormProps> = ({
  variables,
  values,
  onChange,
}) => {
  const handleValueChange = (key: string, value: any) => {
    onChange({
      ...values,
      [key]: value,
    });
  };

  const validateValue = (variable: Variable, value: any): string | null => {
    if (variable.required && (value === undefined || value === '' || value === null)) {
      return 'This field is required';
    }

    // Note: validation rules are not part of the new Variable interface
    // This can be extended later if needed
    return null;
  };

  const renderInput = (variable: Variable) => {
    const value = values[variable.key];
    const error = validateValue(variable, value);
    const hasError = error !== null;

    switch (variable.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={value || false}
                onChange={(e) => handleValueChange(variable.key, e.target.checked)}
              />
            }
            label={variable.label || variable.key}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            label={variable.label || variable.key}
            type="number"
            value={value || ''}
            onChange={(e) => handleValueChange(variable.key, parseFloat(e.target.value) || 0)}
            error={hasError}
            helperText={error}
            required={variable.required}
            size="small"
          />
        );

      case 'select':
        return (
          <TextField
            fullWidth
            select
            label={variable.label || variable.key}
            value={value || ''}
            onChange={(e) => handleValueChange(variable.key, e.target.value)}
            error={hasError}
            helperText={error}
            required={variable.required}
            size="small"
            SelectProps={{
              native: true,
            }}
          >
            <option value="">Select an option</option>
            {(variable.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </TextField>
        );

      case 'multiselect':
        return (
          <Box>
            <TextField
              fullWidth
              label={variable.label || variable.key}
              value={Array.isArray(value) ? value.join(', ') : ''}
              onChange={(e) => {
                const arrayValue = e.target.value
                  .split(',')
                  .map(item => item.trim())
                  .filter(item => item.length > 0);
                handleValueChange(variable.key, arrayValue);
              }}
              error={hasError}
              helperText={error || `${variable.label || variable.key} (comma-separated)`}
              required={variable.required}
              size="small"
            />
            {Array.isArray(value) && value.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {value.map((item, index) => (
                  <Chip
                    key={index}
                    label={item}
                    size="small"
                    onDelete={() => {
                      const newValue = value.filter((_, i) => i !== index);
                      handleValueChange(variable.key, newValue);
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        );

      default: // string
        return (
          <TextField
            fullWidth
            label={variable.label || variable.key}
            multiline={variable.sensitive ? false : true}
            type={variable.sensitive ? 'password' : 'text'}
            rows={variable.sensitive ? 1 : 3}
            value={value || ''}
            onChange={(e) => handleValueChange(variable.key, e.target.value)}
            error={hasError}
            helperText={error}
            required={variable.required}
            size="small"
          />
        );
    }
  };

  const requiredVariables = variables.filter(v => v.required);
  const optionalVariables = variables.filter(v => !v.required);

  const requiredErrors = requiredVariables.filter(v => 
    validateValue(v, values[v.key]) !== null
  ).length;

  const optionalErrors = optionalVariables.filter(v => 
    validateValue(v, values[v.key]) !== null
  ).length;

  if (variables.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Variables
      </Typography>

      {requiredVariables.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ mr: 1 }}>
              Required Variables
            </Typography>
            {requiredErrors > 0 ? (
              <Chip
                icon={<ErrorIcon />}
                label={`${requiredErrors} errors`}
                color="error"
                size="small"
              />
            ) : (
              <Chip
                icon={<CheckIcon />}
                label="Complete"
                color="success"
                size="small"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {requiredVariables.map((variable) => (
              <Box key={variable.key}>
                {renderInput(variable)}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {optionalVariables.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ mr: 1 }}>
                Optional Variables ({optionalVariables.length})
              </Typography>
              {optionalErrors > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${optionalErrors} errors`}
                  color="warning"
                  size="small"
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {optionalVariables.map((variable) => (
                <Box key={variable.key}>
                  {renderInput(variable)}
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {(requiredErrors > 0 || optionalErrors > 0) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Please fix validation errors before rendering.
        </Alert>
      )}
    </Box>
  );
};

export default VariableInputForm;