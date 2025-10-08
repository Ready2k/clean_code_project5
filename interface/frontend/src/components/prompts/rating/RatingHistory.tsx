import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Rating,
  Chip,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';

interface RatingData {
  id: string;
  userId: string;
  username: string;
  score: number;
  note?: string;
  createdAt: string;
  promptVersion?: number;
}

interface RatingFilters {
  minScore?: number;
  maxScore?: number;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'score' | 'date' | 'user';
  sortOrder?: 'asc' | 'desc';
}

interface RatingHistoryProps {
  ratings: RatingData[];
  totalRatings: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: RatingFilters) => void;
  loading?: boolean;
}

export const RatingHistory: React.FC<RatingHistoryProps> = ({
  ratings,
  totalRatings,
  currentPage,
  pageSize,
  onPageChange,
  onFiltersChange,
  loading = false,
}) => {
  const [filters, setFilters] = useState<RatingFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRatings, setExpandedRatings] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(totalRatings / pageSize);

  const handleFilterChange = (newFilters: Partial<RatingFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearFilters = () => {
    const clearedFilters: RatingFilters = {
      sortBy: 'date',
      sortOrder: 'desc',
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const toggleRatingExpansion = (ratingId: string) => {
    const newExpanded = new Set(expandedRatings);
    if (newExpanded.has(ratingId)) {
      newExpanded.delete(ratingId);
    } else {
      newExpanded.add(ratingId);
    }
    setExpandedRatings(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'success';
    if (score >= 3) return 'warning';
    return 'error';
  };

  const hasActiveFilters = filters.minScore !== undefined || 
                          filters.maxScore !== undefined || 
                          filters.userId || 
                          filters.dateFrom || 
                          filters.dateTo;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Rating History ({totalRatings} total)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Filter ratings">
            <IconButton
              onClick={() => setShowFilters(!showFilters)}
              color={hasActiveFilters ? 'primary' : 'default'}
            >
              <FilterIcon />
            </IconButton>
          </Tooltip>
          {hasActiveFilters && (
            <Tooltip title="Clear filters">
              <IconButton onClick={clearFilters} size="small">
                <ClearIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Filters Panel */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: '#000000' }}>
            Filter Options
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <FormControl size="small">
              <InputLabel>Min Score</InputLabel>
              <Select
                value={filters.minScore || ''}
                onChange={(e) => handleFilterChange({ minScore: e.target.value ? Number(e.target.value) : undefined })}
                label="Min Score"
              >
                <MenuItem value="">Any</MenuItem>
                {[1, 2, 3, 4, 5].map(score => (
                  <MenuItem key={score} value={score}>{score} stars</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Max Score</InputLabel>
              <Select
                value={filters.maxScore || ''}
                onChange={(e) => handleFilterChange({ maxScore: e.target.value ? Number(e.target.value) : undefined })}
                label="Max Score"
              >
                <MenuItem value="">Any</MenuItem>
                {[1, 2, 3, 4, 5].map(score => (
                  <MenuItem key={score} value={score}>{score} stars</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              label="From Date"
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value || undefined })}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              size="small"
              label="To Date"
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value || undefined })}
              InputLabelProps={{ shrink: true }}
            />

            <FormControl size="small">
              <InputLabel>Sort By</InputLabel>
              <Select
                value={filters.sortBy || 'date'}
                onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
                label="Sort By"
              >
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="score">Score</MenuItem>
                <MenuItem value="user">User</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel>Sort Order</InputLabel>
              <Select
                value={filters.sortOrder || 'desc'}
                onChange={(e) => handleFilterChange({ sortOrder: e.target.value as any })}
                label="Sort Order"
              >
                <MenuItem value="desc">Descending</MenuItem>
                <MenuItem value="asc">Ascending</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </Collapse>

      {/* Ratings List */}
      {ratings.length > 0 ? (
        <>
          <List>
            {ratings.map((rating) => (
              <ListItem
                key={rating.id}
                alignItems="flex-start"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {rating.username?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2" component="span">
                        {rating.username || 'Anonymous User'}
                      </Typography>
                      <Rating value={rating.score} size="small" readOnly />
                      <Chip
                        label={`${rating.score}/5`}
                        size="small"
                        color={getScoreColor(rating.score) as any}
                        variant="outlined"
                      />
                      {rating.promptVersion && (
                        <Chip
                          label={`v${rating.promptVersion}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {(() => {
                          try {
                            return rating.createdAt ? formatDistanceToNow(new Date(rating.createdAt), { addSuffix: true }) : 'Unknown date';
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box>
                      {rating.note && (
                        <Box sx={{ mt: 1 }}>
                          {rating.note.length > 150 ? (
                            <>
                              <Typography variant="body2" component="div">
                                {expandedRatings.has(rating.id) 
                                  ? rating.note 
                                  : `${rating.note.substring(0, 150)}...`
                                }
                              </Typography>
                              <Button
                                size="small"
                                onClick={() => toggleRatingExpansion(rating.id)}
                                endIcon={expandedRatings.has(rating.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              >
                                {expandedRatings.has(rating.id) ? 'Show Less' : 'Show More'}
                              </Button>
                            </>
                          ) : (
                            <Typography variant="body2">
                              {rating.note}
                            </Typography>
                          )}
                        </Box>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {(() => {
                          try {
                            return rating.createdAt ? format(new Date(rating.createdAt), 'PPpp') : 'Unknown date';
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={currentPage}
                onChange={(_, page) => onPageChange(page)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            {loading ? 'Loading ratings...' : 'No ratings found'}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};