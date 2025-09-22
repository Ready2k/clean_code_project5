import React, { useEffect, useCallback } from 'react';
import { Box } from '@mui/material';

interface KeyboardNavigationProps {
  children: React.ReactNode;
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onPageUp?: () => void;
  onPageDown?: () => void;
  disabled?: boolean;
}

export const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  children,
  onEscape,
  onEnter,
  onArrowUp,
  onArrowDown,
  onArrowLeft,
  onArrowRight,
  onHome,
  onEnd,
  onPageUp,
  onPageDown,
  disabled = false,
}) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      switch (event.key) {
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter();
          }
          break;
        case 'ArrowUp':
          if (onArrowUp) {
            event.preventDefault();
            onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (onArrowDown) {
            event.preventDefault();
            onArrowDown();
          }
          break;
        case 'ArrowLeft':
          if (onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (onArrowRight) {
            event.preventDefault();
            onArrowRight();
          }
          break;
        case 'Home':
          if (onHome) {
            event.preventDefault();
            onHome();
          }
          break;
        case 'End':
          if (onEnd) {
            event.preventDefault();
            onEnd();
          }
          break;
        case 'PageUp':
          if (onPageUp) {
            event.preventDefault();
            onPageUp();
          }
          break;
        case 'PageDown':
          if (onPageDown) {
            event.preventDefault();
            onPageDown();
          }
          break;
      }
    },
    [
      disabled,
      onEscape,
      onEnter,
      onArrowUp,
      onArrowDown,
      onArrowLeft,
      onArrowRight,
      onHome,
      onEnd,
      onPageUp,
      onPageDown,
    ]
  );

  useEffect(() => {
    if (!disabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown, disabled]);

  return <Box>{children}</Box>;
};

// Hook for keyboard navigation in lists/grids
export const useKeyboardListNavigation = (
  items: any[],
  selectedIndex: number,
  onSelectionChange: (index: number) => void,
  onActivate?: (index: number) => void
) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          onSelectionChange(Math.max(0, selectedIndex - 1));
          break;
        case 'ArrowDown':
          event.preventDefault();
          onSelectionChange(Math.min(items.length - 1, selectedIndex + 1));
          break;
        case 'Home':
          event.preventDefault();
          onSelectionChange(0);
          break;
        case 'End':
          event.preventDefault();
          onSelectionChange(items.length - 1);
          break;
        case 'Enter':
        case ' ':
          if (onActivate) {
            event.preventDefault();
            onActivate(selectedIndex);
          }
          break;
      }
    },
    [items.length, selectedIndex, onSelectionChange, onActivate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return { handleKeyDown };
};

export default KeyboardNavigation;