import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProviderSelector from '../ProviderSelector';
import { LLMConnection } from '../../../../types/connections';

const mockConnections: LLMConnection[] = [
  {
    id: '1',
    name: 'OpenAI GPT-4',
    provider: 'openai',
    status: 'active',
    config: {
      apiKey: 'encrypted-key',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      defaultModel: 'gpt-4',
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    lastTested: '2023-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'AWS Bedrock Claude',
    provider: 'bedrock',
    status: 'active',
    config: {
      accessKeyId: 'encrypted-key',
      secretAccessKey: 'encrypted-secret',
      region: 'us-east-1',
      models: ['claude-v1', 'claude-v2'],
      defaultModel: 'claude-v2',
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
    lastTested: '2023-01-01T00:00:00Z',
  },
];

describe('ProviderSelector', () => {
  const defaultProps = {
    connections: mockConnections,
    selectedConnections: [],
    onSelectionChange: vi.fn(),
    renderOptions: { temperature: 0.7, maxTokens: 2000 },
    onOptionsChange: vi.fn(),
  };

  it('renders provider selection interface', () => {
    render(<ProviderSelector {...defaultProps} />);
    
    expect(screen.getByText('Provider Selection')).toBeInTheDocument();
    expect(screen.getByText('OpenAI GPT-4')).toBeInTheDocument();
    expect(screen.getByText('AWS Bedrock Claude')).toBeInTheDocument();
  });

  it('shows select all checkbox', () => {
    render(<ProviderSelector {...defaultProps} />);
    
    expect(screen.getByText(/Select All \(0\/2\)/)).toBeInTheDocument();
  });

  it('displays advanced options', () => {
    render(<ProviderSelector {...defaultProps} />);
    
    expect(screen.getByText('Advanced Options')).toBeInTheDocument();
  });

  it('shows empty state when no connections', () => {
    render(<ProviderSelector {...defaultProps} connections={[]} />);
    
    expect(screen.getByText('No active connections available. Please configure LLM connections first.')).toBeInTheDocument();
  });
});