import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

interface RatingFilterOptions {
  minRating?: number;
  maxRating?: number;
  minRatingCount?: number;
  sortByRating?: boolean;
  ratingTrend?: 'improving' | 'declining' | 'stable' | 'any';
  highlyRated?: boolean; // 4+ stars with 5+ ratings
  controversial?: boolean; // High variance in ratings
}

interface RatingFiltersProps {
  filters: RatingFilterOptions;
  onFiltersChange: (filters: RatingFilterOptions) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export const RatingFilters: React.FC<RatingFiltersProps> = ({
  filters,
  onFiltersChange,
  expanded = false,
  onExpandedChange,
}) => {
  const handleRatingRangeChange = (_event: Event, newValue: number | number[]) => {
    const [min, max] = newValue as number[];
    onFiltersChange({
      ...filters,
      minRating: min,
      maxRating: max,
    });
  };

  const handleMinRatingCountChange = (event: any) => {
    onFiltersChange({
      ...filters,
      minRatingCount: event.target.value || undefined,
    });
  };

  const handleSortByRatingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      sortByRating: event.target.checked,
    });
  };

  const handleRatingTrendChange = (event: any) => {
    onFiltersChange({
      ...filters,
      ratingTrend: event.target.value === 'any' ? undefined : event.target.value,
    });
  };

  const handleHighlyRatedChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      highlyRated: event.target.checked || undefined,
    });
  };

  const handleControversialChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      controversial: event.target.checked || undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== false && value !== 'any'
  );

  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => 
      value !== undefined && value !== false && value !== 'any'
    ).length;
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarIcon color="primary" />
          <Typography variant="h6">
            Rating Filters
          </Typography>
          {hasActiveFilters && (
            <Chip
              label={`${getActiveFilterCount()} active`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasActiveFilters && (
            <Tooltip title="Clear all filters">
              <IconButton onClick={clearFilters} size="small">
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
          {onExpandedChange && (
            <IconButton onClick={() => onExpandedChange(!expanded)} size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Rating Range Slider */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Rating Range: {filters.minRating || 0} - {filters.maxRating || 5} stars
            </Typography>
            <Slider
              value={[filters.minRating || 0, filters.maxRating || 5]}
              onChange={handleRatingRangeChange}
              valueLabelDisplay="auto"
              min={0}
              max={5}
              step={0.1}
              marks={[
                { value: 0, label: '0' },
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
                { value: 5, label: '5' },
              ]}
              sx={{ mt: 1 }}
            />
          </Box>

          <Divider />

          {/* Minimum Rating Count */}
          <Box>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Minimum Rating Count</InputLabel>
              <Select
                value={filters.minRatingCount || ''}
                onChange={handleMinRatingCountChange}
                label="Minimum Rating Count"
              >
                <MenuItem value="">Any</MenuItem>
                <MenuItem value={1}>1+ ratings</MenuItem>
                <MenuItem value={3}>3+ ratings</MenuItem>
                <MenuItem value={5}>5+ ratings</MenuItem>
                <MenuItem value={10}>10+ ratings</MenuItem>
                <MenuItem value={20}>20+ ratings</MenuItem>
                <MenuItem value={50}>50+ ratings</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Rating Trend */}
          <Box>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Rating Trend</InputLabel>
              <Select
                value={filters.ratingTrend || 'any'}
                onChange={handleRatingTrendChange}
                label="Rating Trend"
              >
                <MenuItem value="any">Any Trend</MenuItem>
                <MenuItem value="improving">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon fontSize="small" color="success" />
                    Improving
                  </Box>
                </MenuItem>
                <MenuItem value="declining">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon fontSize="small" color="error" sx={{ transform: 'rotate(180deg)' }} />
                    Declining
                  </Box>
                </MenuItem>
                <MenuItem value="stable">Stable</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider />

          {/* Quick Filter Toggles */}
          <Box>
            <Typography variant="body2" gutterBottom color="text.secondary">
              Quick Filters
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.sortByRating || false}
                    onChange={handleSortByRatingChange}
                    size="small"
                  />
                }
                label="Sort by rating (highest first)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.highlyRated || false}
                    onChange={handleHighlyRatedChange}
                    size="small"
                  />
                }
                label="Highly rated (4+ stars with 5+ ratings)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={filters.controversial || false}
                    onChange={handleControversialChange}
                    size="small"
                  />
                }
                label="Controversial (mixed ratings)"
              />
            </Box>
          </Box>

          {/* Filter Summary */}
          {hasActiveFilters && (
            <>
              <Divider />
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Active Filters
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(filters.minRating !== undefined || filters.maxRating !== undefined) && (
                    <Chip
                      label={`Rating: ${filters.minRating || 0}-${filters.maxRating || 5}`}
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, minRating: undefined, maxRating: undefined })}
                    />
                  )}
                  {filters.minRatingCount && (
                    <Chip
                      label={`Min ${filters.minRatingCount} ratings`}
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, minRatingCount: undefined })}
                    />
                  )}
                  {filters.ratingTrend && (
                    <Chip
                      label={`Trend: ${filters.ratingTrend}`}
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, ratingTrend: undefined })}
                    />
                  )}
                  {filters.sortByRating && (
                    <Chip
                      label="Sorted by rating"
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, sortByRating: undefined })}
                    />
                  )}
                  {filters.highlyRated && (
                    <Chip
                      label="Highly rated"
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, highlyRated: undefined })}
                    />
                  )}
                  {filters.controversial && (
                    <Chip
                      label="Controversial"
                      size="small"
                      variant="outlined"
                      onDelete={() => onFiltersChange({ ...filters, controversial: undefined })}
                    />
                  )}
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};