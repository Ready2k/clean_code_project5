import { useState, useEffect, useCallback } from 'react';
import { AppError, ErrorType } from '../types/errors';

interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
}

interface OfflineDetectionConfig {
  checkInterval?: number;
  pingUrl?: string;
  timeout?: number;
}

const DEFAULT_CONFIG: Required<OfflineDetectionConfig> = {
  checkInterval: 30000, // 30 seconds
  pingUrl: '/api/health',
  timeout: 5000 // 5 seconds
};

export function useOfflineDetection(config: OfflineDetectionConfig = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isOffline: !navigator.onLine,
    lastOnlineAt: navigator.onLine ? new Date() : undefined,
    lastOfflineAt: !navigator.onLine ? new Date() : undefined
  });

  const checkOnlineStatus = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

      const response = await fetch(finalConfig.pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }, [finalConfig.pingUrl, finalConfig.timeout]);

  const updateOnlineStatus = useCallback((isOnline: boolean) => {
    setState(prevState => {
      if (prevState.isOnline === isOnline) {
        return prevState; // No change
      }

      const now = new Date();
      return {
        isOnline,
        isOffline: !isOnline,
        lastOnlineAt: isOnline ? now : prevState.lastOnlineAt,
        lastOfflineAt: !isOnline ? now : prevState.lastOfflineAt
      };
    });
  }, []);

  const handleOnline = useCallback(() => {
    updateOnlineStatus(true);
  }, [updateOnlineStatus]);

  const handleOffline = useCallback(() => {
    updateOnlineStatus(false);
  }, [updateOnlineStatus]);

  // Periodic connectivity check
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const isOnline = await checkOnlineStatus();
      updateOnlineStatus(isOnline);
    }, finalConfig.checkInterval);

    return () => clearInterval(intervalId);
  }, [checkOnlineStatus, updateOnlineStatus, finalConfig.checkInterval]);

  // Browser online/offline events
  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  // Manual connectivity check
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    const isOnline = await checkOnlineStatus();
    updateOnlineStatus(isOnline);
    return isOnline;
  }, [checkOnlineStatus, updateOnlineStatus]);

  // Create offline error
  const createOfflineError = useCallback((): AppError => {
    return new AppError(
      ErrorType.OFFLINE_ERROR,
      'You appear to be offline',
      'OFFLINE',
      { lastOnlineAt: state.lastOnlineAt },
      true
    );
  }, [state.lastOnlineAt]);

  return {
    ...state,
    checkConnectivity,
    createOfflineError
  };
}

// Global offline state hook
let globalOfflineState: OfflineState = {
  isOnline: navigator.onLine,
  isOffline: !navigator.onLine
};

const offlineListeners: ((state: OfflineState) => void)[] = [];

export function useGlobalOfflineState() {
  const [state, setState] = useState(globalOfflineState);

  useEffect(() => {
    const listener = (newState: OfflineState) => {
      setState(newState);
    };

    offlineListeners.push(listener);

    return () => {
      const index = offlineListeners.indexOf(listener);
      if (index > -1) {
        offlineListeners.splice(index, 1);
      }
    };
  }, []);

  return state;
}

// Update global offline state
function updateGlobalOfflineState(newState: OfflineState) {
  globalOfflineState = newState;
  offlineListeners.forEach(listener => listener(newState));
}

// Browser event listeners for global state
window.addEventListener('online', () => {
  updateGlobalOfflineState({
    ...globalOfflineState,
    isOnline: true,
    isOffline: false,
    lastOnlineAt: new Date()
  });
});

window.addEventListener('offline', () => {
  updateGlobalOfflineState({
    ...globalOfflineState,
    isOnline: false,
    isOffline: true,
    lastOfflineAt: new Date()
  });
});