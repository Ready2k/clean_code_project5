import { createContext, useContext, ReactNode } from 'react';
import { useOfflineDetection } from '../hooks/useOfflineDetection';

interface OfflineContextType {
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
  checkConnectivity: () => Promise<boolean>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const offlineState = useOfflineDetection();

  return (
    <OfflineContext.Provider value={offlineState}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOfflineContext() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineContext must be used within an OfflineProvider');
  }
  return context;
}