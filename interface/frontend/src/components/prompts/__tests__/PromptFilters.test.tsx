import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { theme } from '../../../theme';
import { PromptFilters } from '../PromptFilters';
import { PromptFilters as IPromptFilters } from '../../../types/prompts';

const mockFilters: IPromptFilters = {
  search: '',
  tags: [],
  status: [],
  sortBy: 'updated_at',
  sortOrder: 'desc',
  page: 1,
  limit: 20,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        {component}
      </LocalizationProvider>
    </ThemeProvider>
  );
};

describe('PromptFilters', () => {
  const mockOnFiltersChange = vi.fn();
  const mockOnClearFilters = vi.fn();

  beforeEach(() => {
    mockOnFiltersChange.mockClear();
    mockOnClearFilters.mockClear();
  });

  it('renders search input and sort controls', () => {
    renderWithProviders(
      <PromptFilters
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    );
    
    expect(screen.getByPlaceholderText('Search prompts...')).toBeInTheDocument();
    expect(screen.getAllByText('Sort By')).toHaveLength(2); // Label and legend
    expect(screen.getAllByText('Order')).toHaveLength(2); // Label and legend
  });

  it('calls onFiltersChange when search input changes', () => {
    renderWithProviders(
      <PromptFilters
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    );
    
    const searchInput = screen.getByPlaceholderText('Search prompts...');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    expect(mockOnFiltersChange).toHaveBeenCalledWith({ search: 'test search' });
  });

  it('shows clear button when filters are active', () => {
    const filtersWithSearch = { ...mockFilters, search: 'test' };
    
    renderWithProviders(
      <PromptFilters
        filters={filtersWithSearch}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    );
    
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('calls onClearFilters when clear button is clicked', () => {
    const filtersWithSearch = { ...mockFilters, search: 'test' };
    
    renderWithProviders(
      <PromptFilters
        filters={filtersWithSearch}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    );
    
    fireEvent.click(screen.getByText('Clear'));
    expect(mockOnClearFilters).toHaveBeenCalled();
  });

  it('expands advanced filters when filter button is clicked', () => {
    renderWithProviders(
      <PromptFilters
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
      />
    );
    
    const filterButton = screen.getByTestId('FilterListIcon').closest('button');
    fireEvent.click(filterButton!);
    
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
  });

  it('renders available tags and owners in dropdowns', () => {
    const availableTags = ['tag1', 'tag2', 'tag3'];
    const availableOwners = ['user1', 'user2'];
    
    renderWithProviders(
      <PromptFilters
        filters={mockFilters}
        onFiltersChange={mockOnFiltersChange}
        onClearFilters={mockOnClearFilters}
        availableTags={availableTags}
        availableOwners={availableOwners}
      />
    );
    
    // Expand advanced filters first
    const filterButton = screen.getByTestId('FilterListIcon').closest('button');
    fireEvent.click(filterButton!);
    
    expect(screen.getAllByText('Tags')).toHaveLength(2); // Label and legend
    expect(screen.getAllByText('Owner')).toHaveLength(2); // Label and legend
  });
});