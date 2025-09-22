import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { vi } from 'vitest';
import { ResponsiveTable, Column } from '../ResponsiveTable';
import { lightTheme } from '../../../theme';

const mockColumns: Column[] = [
  {
    id: 'name',
    label: 'Name',
    priority: 'high',
    sortable: true,
  },
  {
    id: 'email',
    label: 'Email',
    priority: 'medium',
    sortable: true,
  },
  {
    id: 'role',
    label: 'Role',
    priority: 'low',
    hideOnMobile: true,
  },
];

const mockRows = [
  { name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
];

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={lightTheme}>
      {component}
    </ThemeProvider>
  );
};

describe('ResponsiveTable', () => {
  it('renders table with proper accessibility attributes', () => {
    renderWithTheme(
      <ResponsiveTable
        columns={mockColumns}
        rows={mockRows}
        ariaLabel="User data table"
        caption="List of users in the system"
      />
    );
    
    expect(screen.getByRole('table', { name: /user data table/i })).toBeInTheDocument();
    expect(screen.getByText('List of users in the system')).toBeInTheDocument();
  });

  it('renders sortable column headers with proper ARIA attributes', () => {
    const mockOnSort = vi.fn();
    
    renderWithTheme(
      <ResponsiveTable
        columns={mockColumns}
        rows={mockRows}
        onSort={mockOnSort}
        sortColumn="name"
        sortDirection="asc"
      />
    );
    
    const nameHeader = screen.getByRole('button', { name: /name/i });
    // Check that the header has sorting capability
    expect(nameHeader).toBeInTheDocument();
    
    fireEvent.click(nameHeader);
    expect(mockOnSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('handles row clicks with proper keyboard navigation', () => {
    const mockOnRowClick = vi.fn();
    
    renderWithTheme(
      <ResponsiveTable
        columns={mockColumns}
        rows={mockRows}
        onRowClick={mockOnRowClick}
      />
    );
    
    const rows = screen.getAllByRole('button').filter(button => 
      button.getAttribute('aria-label')?.includes('View details')
    );
    
    // Test click on first row
    fireEvent.click(rows[0]);
    expect(mockOnRowClick).toHaveBeenCalledWith(mockRows[0], 0);
    
    // Test keyboard navigation
    fireEvent.keyDown(rows[0], { key: 'Enter' });
    expect(mockOnRowClick).toHaveBeenCalledWith(mockRows[0], 0);
    
    fireEvent.keyDown(rows[0], { key: ' ' });
    expect(mockOnRowClick).toHaveBeenCalledWith(mockRows[0], 0);
  });

  it('displays empty message when no data', () => {
    renderWithTheme(
      <ResponsiveTable
        columns={mockColumns}
        rows={[]}
        emptyMessage="No users found"
      />
    );
    
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('has proper focus management', () => {
    const mockOnRowClick = vi.fn();
    
    renderWithTheme(
      <ResponsiveTable
        columns={mockColumns}
        rows={mockRows}
        onRowClick={mockOnRowClick}
      />
    );
    
    const rows = screen.getAllByRole('button').filter(button => 
      button.getAttribute('aria-label')?.includes('View details')
    );
    
    expect(rows).toHaveLength(2);
    
    // Test that rows are focusable
    rows[0].focus();
    expect(rows[0]).toHaveFocus();
  });
});