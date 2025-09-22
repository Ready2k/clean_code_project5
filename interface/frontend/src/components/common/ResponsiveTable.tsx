import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Box,
  Card,
  CardContent,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';

export interface Column {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'right' | 'left' | 'center';
  format?: (value: any) => string | React.ReactNode;
  sortable?: boolean;
  hideOnMobile?: boolean;
  priority?: 'high' | 'medium' | 'low'; // For responsive hiding
}

export interface ResponsiveTableProps {
  columns: Column[];
  rows: any[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: any, index: number) => void;
  ariaLabel?: string;
  caption?: string;
  emptyMessage?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  columns,
  rows,
  onSort,
  sortColumn,
  sortDirection,
  onRowClick,
  ariaLabel = 'Data table',
  caption,
  emptyMessage = 'No data available',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));

  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  // Filter columns based on screen size
  const visibleColumns = columns.filter((column) => {
    if (isMobile) {
      return !column.hideOnMobile && column.priority === 'high';
    }
    if (isTablet) {
      return column.priority !== 'low';
    }
    return true;
  });

  const handleSort = (columnId: string) => {
    if (!onSort) return;
    
    const isAsc = sortColumn === columnId && sortDirection === 'asc';
    onSort(columnId, isAsc ? 'desc' : 'asc');
  };

  const handleRowKeyDown = (event: React.KeyboardEvent, row: any, index: number) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (onRowClick) {
          onRowClick(row, index);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedRowIndex(Math.max(0, index - 1));
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedRowIndex(Math.min(rows.length - 1, index + 1));
        break;
    }
  };

  // Mobile card view
  if (isMobile) {
    return (
      <Box
        role="region"
        aria-label={ariaLabel}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {caption && (
          <Typography variant="h6" component="h3" sx={{ mb: 2 }}>
            {caption}
          </Typography>
        )}
        
        {rows.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary" align="center">
                {emptyMessage}
              </Typography>
            </CardContent>
          </Card>
        ) : (
          rows.map((row, index) => (
            <Card
              key={index}
              sx={{
                cursor: onRowClick ? 'pointer' : 'default',
                '&:hover': onRowClick ? {
                  backgroundColor: 'action.hover',
                } : {},
                '&:focus-within': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: '2px',
                },
              }}
              tabIndex={onRowClick ? 0 : -1}
              role={onRowClick ? 'button' : undefined}
              aria-label={onRowClick ? `View details for row ${index + 1}` : undefined}
              onClick={() => onRowClick?.(row, index)}
              onKeyDown={(e) => handleRowKeyDown(e, row, index)}
            >
              <CardContent>
                {visibleColumns.map((column) => (
                  <Box key={column.id} sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {column.label}
                    </Typography>
                    <Typography variant="body2">
                      {column.format ? column.format(row[column.id]) : row[column.id]}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </Box>
    );
  }

  // Desktop table view
  return (
    <TableContainer
      component={Paper}
      sx={{
        '& .MuiTable-root': {
          minWidth: 650,
        },
      }}
    >
      <Table aria-label={ariaLabel}>
        {caption && <caption>{caption}</caption>}
        
        <TableHead>
          <TableRow>
            {visibleColumns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                style={{ minWidth: column.minWidth }}
                sortDirection={sortColumn === column.id ? sortDirection : false}
              >
                {column.sortable && onSort ? (
                  <TableSortLabel
                    active={sortColumn === column.id}
                    direction={sortColumn === column.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(column.id)}
                  >
                    {column.label}
                    {sortColumn === column.id ? (
                      <Box component="span" sx={visuallyHidden}>
                        {sortDirection === 'desc' ? 'sorted descending' : 'sorted ascending'}
                      </Box>
                    ) : null}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length} align="center">
                <Typography color="text.secondary">
                  {emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={index}
                hover={!!onRowClick}
                tabIndex={onRowClick ? 0 : -1}
                role={onRowClick ? 'button' : undefined}
                aria-label={onRowClick ? `View details for row ${index + 1}` : undefined}
                sx={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:focus': {
                    backgroundColor: 'action.focus',
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: '-2px',
                  },
                }}
                onClick={() => onRowClick?.(row, index)}
                onKeyDown={(e) => handleRowKeyDown(e, row, index)}
              >
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} align={column.align}>
                    {column.format ? column.format(row[column.id]) : row[column.id]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ResponsiveTable;