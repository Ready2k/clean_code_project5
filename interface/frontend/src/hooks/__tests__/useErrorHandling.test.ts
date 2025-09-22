import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useErrorHandling, useAsyncOperation } from '../useErrorHandling';
import { AppError, ErrorType } from '../../types/errors';

// Mock the ErrorHandler
vi.mock('../../utils/errorHandler', () => ({
  ErrorHandler: {
    handle: vi.fn(),
    isRetryable: vi.fn(() => true),
    getErrorMessage: vi.fn(() => 'Test error message'),
    getActionableMessage: vi.fn(() => 'Test actionable message')
  }
}));

// Mock the retry mechanism
vi.mock('../../utils/retryMechanism', () => ({
  useRetry: () => ({
    execute: vi.fn((operation) => operation())
  })
}));

describe('useErrorHandling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with no error state', () => {
    const { result } = renderHook(() => useErrorHandling());

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.retryCount).toBe(0);
  });

  it('handles errors correctly', () => {
    const { result } = renderHook(() => useErrorHandling());
    const testError = new AppError(ErrorType.NETWORK_ERROR, 'Test error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(result.current.hasError).toBe(true);
    expect(result.current.error).toBe(testError);
  });

  it('clears error state', () => {
    const { result } = renderHook(() => useErrorHandling());
    const testError = new AppError(ErrorType.NETWORK_ERROR, 'Test error');

    act(() => {
      result.current.handleError(testError);
    });

    expect(result.current.hasError).toBe(true);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('executes operations with error handling', async () => {
    const { result } = renderHook(() => useErrorHandling());
    const successOperation = vi.fn().mockResolvedValue('success');

    let operationResult;
    await act(async () => {
      operationResult = await result.current.executeWithErrorHandling(successOperation);
    });

    expect(successOperation).toHaveBeenCalled();
    expect(operationResult).toBe('success');
    expect(result.current.hasError).toBe(false);
  });

  it('handles operation failures', async () => {
    const { result } = renderHook(() => useErrorHandling());
    const failingOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));

    let operationResult;
    await act(async () => {
      operationResult = await result.current.executeWithErrorHandling(failingOperation);
    });

    expect(failingOperation).toHaveBeenCalled();
    expect(operationResult).toBe(null);
    expect(result.current.hasError).toBe(true);
  });
});

describe('useAsyncOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    const operation = vi.fn().mockResolvedValue('test data');
    const { result } = renderHook(() => useAsyncOperation(operation));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('executes operation and updates state', async () => {
    const operation = vi.fn().mockResolvedValue('test data');
    const { result } = renderHook(() => useAsyncOperation(operation));

    await act(async () => {
      await result.current.execute();
    });

    expect(operation).toHaveBeenCalled();
    expect(result.current.data).toBe('test data');
    expect(result.current.loading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('handles operation failures', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
    const { result } = renderHook(() => useAsyncOperation(operation));

    await act(async () => {
      await result.current.execute();
    });

    expect(operation).toHaveBeenCalled();
    expect(result.current.data).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasError).toBe(true);
  });

  it('executes immediately when immediate option is true', async () => {
    const operation = vi.fn().mockResolvedValue('immediate data');
    
    await act(async () => {
      renderHook(() => useAsyncOperation(operation, [], { immediate: true }));
    });

    expect(operation).toHaveBeenCalled();
  });

  it('resets state correctly', () => {
    const operation = vi.fn().mockResolvedValue('test data');
    const { result } = renderHook(() => useAsyncOperation(operation));

    act(() => {
      result.current.reset();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.hasError).toBe(false);
    expect(result.current.error).toBe(null);
  });
});