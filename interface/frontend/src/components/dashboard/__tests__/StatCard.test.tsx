import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';
import { Description as DescriptionIcon } from '@mui/icons-material';

describe('StatCard', () => {
  it('renders basic stat card correctly', () => {
    render(
      <StatCard
        title="Test Stat"
        value={42}
        subtitle="Test subtitle"
        icon={<DescriptionIcon />}
        color="primary"
      />
    );

    expect(screen.getByText('Test Stat')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    render(
      <StatCard
        title="Loading Stat"
        value={0}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading Stat')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays trend information when provided', () => {
    render(
      <StatCard
        title="Trending Stat"
        value={100}
        trend={{
          value: 15,
          label: 'vs last week',
          direction: 'up',
        }}
      />
    );

    expect(screen.getByText('Trending Stat')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('+15% vs last week')).toBeInTheDocument();
  });
});