import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RenderPreview from '../RenderPreview';
import { RenderResult } from '../../../../types/prompts';

const mockRender: RenderResult = {
  id: 'render-1',
  promptId: 'prompt-1',
  connectionId: 'conn-1',
  provider: 'openai',
  model: 'gpt-4',
  payload: 'This is a rendered prompt output.',
  variables: { name: 'John', age: 30 },
  createdAt: '2023-01-01T12:00:00Z',
  success: true,
};

const mockFailedRender: RenderResult = {
  id: 'render-2',
  promptId: 'prompt-1',
  connectionId: 'conn-2',
  provider: 'bedrock',
  model: 'claude-v2',
  payload: '',
  variables: {},
  createdAt: '2023-01-01T12:00:00Z',
  success: false,
  error: 'Connection failed',
};

describe('RenderPreview', () => {
  const defaultProps = {
    onCopy: vi.fn(),
    onDownload: vi.fn(),
    onRerender: vi.fn(),
  };

  it('renders successful render result', () => {
    render(<RenderPreview render={mockRender} {...defaultProps} />);
    
    expect(screen.getByText('OPENAI')).toBeInTheDocument();
    expect(screen.getAllByText('gpt-4')).toHaveLength(2); // Appears in chip and metadata
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('This is a rendered prompt output.')).toBeInTheDocument();
  });

  it('renders failed render result', () => {
    render(<RenderPreview render={mockFailedRender} {...defaultProps} />);
    
    expect(screen.getByText('BEDROCK')).toBeInTheDocument();
    expect(screen.getAllByText('claude-v2')).toHaveLength(2); // Appears in chip and metadata
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows metadata section', () => {
    render(<RenderPreview render={mockRender} {...defaultProps} />);
    
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });

  it('disables copy and download for failed renders', () => {
    render(<RenderPreview render={mockFailedRender} {...defaultProps} />);
    
    // Copy and download buttons should be disabled for failed renders
    const buttons = screen.getAllByRole('button');
    const copyButton = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Copy') || 
                                           btn.querySelector('[data-testid="ContentCopyIcon"]'));
    const downloadButton = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Download') || 
                                               btn.querySelector('[data-testid="DownloadIcon"]'));
    
    if (copyButton) expect(copyButton).toBeDisabled();
    if (downloadButton) expect(downloadButton).toBeDisabled();
  });
});