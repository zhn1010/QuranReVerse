'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export function useAccessibleDialog<T extends HTMLElement>({
  initialFocusRef,
  isOpen,
  onClose,
}: {
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose?: () => void;
}) {
  const dialogRef = useRef<T | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusDialog = () => {
      const focusableElements = getFocusableElements(dialog);
      const target = initialFocusRef?.current ?? focusableElements[0] ?? dialog;
      target.focus();
    };

    const animationFrameId = window.requestAnimationFrame(focusDialog);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onClose) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements(dialog);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const activeElement = document.activeElement;
      const currentIndex = focusableElements.indexOf(activeElement as HTMLElement);

      if (event.shiftKey) {
        if (currentIndex <= 0) {
          event.preventDefault();
          focusableElements[focusableElements.length - 1]?.focus();
        }
        return;
      }

      if (currentIndex === -1 || currentIndex === focusableElements.length - 1) {
        event.preventDefault();
        focusableElements[0]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      const returnFocusTarget = returnFocusRef.current;
      if (returnFocusTarget?.isConnected) {
        window.requestAnimationFrame(() => {
          returnFocusTarget.focus();
        });
      }
    };
  }, [initialFocusRef, isOpen, onClose]);

  return {
    descriptionId,
    dialogRef,
    titleId,
  };
}
