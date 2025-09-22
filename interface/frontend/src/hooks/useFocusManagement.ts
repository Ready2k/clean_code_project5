import { useEffect, useRef, useCallback } from 'react';

interface UseFocusManagementOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  autoFocus?: boolean;
}

export const useFocusManagement = (
  isActive: boolean = true,
  options: UseFocusManagementOptions = {}
) => {
  const {
    trapFocus = false,
    restoreFocus = false,
    autoFocus = false,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  }, []);

  // Handle focus trap
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!trapFocus || !isActive || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [trapFocus, isActive, getFocusableElements]
  );

  // Handle Escape key to exit focus trap
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && trapFocus && isActive) {
        if (restoreFocus && previousActiveElement.current) {
          (previousActiveElement.current as HTMLElement).focus();
        }
      }
    },
    [trapFocus, isActive, restoreFocus]
  );

  // Focus the first focusable element
  const focusFirstElement = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }, [getFocusableElements]);

  // Focus the last focusable element
  const focusLastElement = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus();
    }
  }, [getFocusableElements]);

  // Set up event listeners and initial focus
  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement;
    }

    // Auto focus the first element if requested
    if (autoFocus) {
      setTimeout(() => {
        focusFirstElement();
      }, 0);
    }

    // Add event listeners
    if (trapFocus) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      // Remove event listeners
      if (trapFocus) {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keydown', handleEscapeKey);
      }

      // Restore focus if requested
      if (restoreFocus && previousActiveElement.current) {
        (previousActiveElement.current as HTMLElement).focus();
      }
    };
  }, [
    isActive,
    trapFocus,
    restoreFocus,
    autoFocus,
    handleKeyDown,
    handleEscapeKey,
    focusFirstElement,
  ]);

  return {
    containerRef,
    focusFirstElement,
    focusLastElement,
    getFocusableElements,
  };
};

export default useFocusManagement;