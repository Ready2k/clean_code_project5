import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QuickActions } from '../QuickActions';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('QuickActions', () => {
  it('renders all quick action buttons', () => {
    renderWithRouter(<QuickActions />);

    expect(screen.getByText('Create Prompt')).toBeInTheDocument();
    expect(screen.getByText('Manage Connections')).toBeInTheDocument();
    expect(screen.getByText('Browse Library')).toBeInTheDocument();
    expect(screen.getByText('System Settings')).toBeInTheDocument();
  });

  it('shows disabled state for unimplemented features', () => {
    renderWithRouter(<QuickActions />);

    const analyticsButton = screen.getByText('View Analytics').closest('button');
    const exportButton = screen.getByText('Export Data').closest('button');

    expect(analyticsButton).toBeDisabled();
    expect(exportButton).toBeDisabled();
  });

  it('allows clicking on enabled actions', () => {
    renderWithRouter(<QuickActions />);

    const createButton = screen.getByText('Create Prompt').closest('button');
    const connectionsButton = screen.getByText('Manage Connections').closest('button');

    expect(createButton).not.toBeDisabled();
    expect(connectionsButton).not.toBeDisabled();

    // Test that buttons are clickable (won't navigate in test environment)
    fireEvent.click(createButton!);
    fireEvent.click(connectionsButton!);
  });
});