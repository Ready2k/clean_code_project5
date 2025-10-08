import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Button,
  Paper,
  Typography,
  Slider,
  Collapse,
  IconButton,
  SelectChangeEvent,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { PromptFilters as IPromptFilters, PromptStatus } from '../../types/prompts';

interface PromptFiltersProps {
  filters: IPromptFilters;
  onFiltersChange: (filters: Partial<IPromptFilters>) => void;
  onClearFilters: () => void;
  availableTags?: string[];
  availableOwners?: string[];
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const statusOptions: { value: PromptStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
  { value: 'deprecated', label: 'Deprecated' },
];

const sortOptions = [
  { value: 'title', label: 'Title' },
  { value: 'created_at', label: 'Created Date' },
  { value: 'updated_at', label: 'Updated Date' },
  { value: 'rating', label: 'Rating' },
];

export const PromptFilters: React.FC<PromptFiltersProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  availableTags = [],
  availableOwners = [],
}) => {
  const [expanded, setExpanded] = React.useState(false);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ search: event.target.value });
  };

  const handleTagsChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    onFiltersChange({ tags: typeof value === 'string' ? value.split(',') : value });
  };

  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    onFiltersChange({ 
      status: (typeof value === 'string' ? value.split(',') : value) as PromptStatus[] 
    });
  };

  const handleOwnerChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ owner: event.target.value || undefined });
  };

  const handleSortChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ sortBy: event.target.value as any });
  };

  const handleSortOrderChange = (event: SelectChangeEvent<string>) => {
    onFiltersChange({ sortOrder: event.target.value as 'asc' | 'desc' });
  };

  const handleRatingChange = (_event: Event, newValue: number | number[]) => {
    const [min, max] = newValue as number[];
    onFiltersChange({ rating: { min, max } });
  };

  const handleStartDateChange = (date: Date | null) => {
    onFiltersChange({
      dateRange: {
        start: date?.toISOString() || '',
        end: filters.dateRange?.end || '',
      },
    });
  };

  const handleEndDateChange = (date: Date | null) => {
    onFiltersChange({
      dateRange: {
        start: filters.dateRange?.start || '',
        end: date?.toISOString() || '',
      },
    });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.tags?.length ||
    filters.status?.length ||
    filters.owner ||
    filters.rating ||
    filters.dateRange?.start ||
    filters.dateRange?.end
  );

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Basic Filters Row */}
      <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
        {/* Search */}
        <TextField
          placeholder="Search prompts..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          size="small"
          sx={{ minWidth: 200, flexGrow: 1 }}
        />

        {/* Sort By */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={filters.sortBy || 'updated_at'}
            label="Sort By"
            onChange={handleSortChange}
          >
            {sortOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sort Order */}
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Order</InputLabel>
          <Select
            value={filters.sortOrder || 'desc'}
            label="Order"
            onChange={handleSortOrderChange}
          >
            <MenuItem value="asc">Asc</MenuItem>
            <MenuItem value="desc">Desc</MenuItem>
          </Select>
        </FormControl>

        {/* Advanced Filters Toggle */}
        <IconButton
          onClick={() => setExpanded(!expanded)}
          sx={{
            color: hasActiveFilters ? 'primary.main' : 'text.secondary',
          }}
        >
          <FilterIcon />
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            startIcon={<ClearIcon />}
            onClick={onClearFilters}
            size="small"
            color="secondary"
          >
            Clear
          </Button>
        )}
      </Box>

      {/* Advanced Filters */}
      <Collapse in={expanded}>
        <Box mt={2} display="flex" flexDirection="column" gap={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Advanced Filters
          </Typography>

          <Box display="flex" gap={2} flexWrap="wrap">
            {/* Tags */}
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Tags</InputLabel>
              <Select
                multiple
                value={filters.tags || []}
                onChange={handleTagsChange}
                input={<OutlinedInput label="Tags" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
                MenuProps={MenuProps}
              >
                {availableTags.map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Status */}
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                multiple
                value={filters.status || []}
                onChange={handleStatusChange}
                input={<OutlinedInput label="Status" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
                MenuProps={MenuProps}
              >
                {statusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Owner */}
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Owner</InputLabel>
              <Select
                value={filters.owner || ''}
                onChange={handleOwnerChange}
                label="Owner"
              >
                <MenuItem value="">All</MenuItem>
                {availableOwners.map((owner) => (
                  <MenuItem key={owner} value={owner}>
                    {owner}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Rating Range */}
          <Box>
            <Typography variant="body2" gutterBottom>
              Rating Range: {filters.rating?.min || 0} - {filters.rating?.max || 5}
            </Typography>
            <Slider
              value={[filters.rating?.min || 0, filters.rating?.max || 5]}
              onChange={handleRatingChange}
              valueLabelDisplay="auto"
              min={0}
              max={5}
              step={0.1}
              sx={{ width: 200 }}
            />
          </Box>

          {/* Date Range */}
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box display="flex" gap={2}>
              <DatePicker
                label="Start Date"
                value={filters.dateRange?.start ? new Date(filters.dateRange.start) : null}
                onChange={handleStartDateChange}
                slotProps={{ textField: { size: 'small' } }}
              />
              <DatePicker
                label="End Date"
                value={filters.dateRange?.end ? new Date(filters.dateRange.end) : null}
                onChange={handleEndDateChange}
                slotProps={{ textField: { size: 'small' } }}
              />
            </Box>
          </LocalizationProvider>
        </Box>
      </Collapse>
    </Paper>
  );
};