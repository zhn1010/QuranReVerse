'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { useAccessibleDialog } from '@/hooks/use-accessible-dialog';
import { HERO_HIDDEN_STORAGE_KEY } from '@/lib/app-constants';

export function ChatHomeIntroModal() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(HERO_HIDDEN_STORAGE_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const hideModal = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(HERO_HIDDEN_STORAGE_KEY, 'true');
    } catch {
      // ignore localStorage failures
    }
  };
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { descriptionId, dialogRef, titleId } = useAccessibleDialog<HTMLDivElement>({
    initialFocusRef: closeButtonRef,
    isOpen: isVisible,
    onClose: hideModal,
  });

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--surface-scrim-soft) p-4 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          hideModal();
        }
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-(--shadow-modal) sm:p-10"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Close intro"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-(--ink-soft) transition hover:bg-(--surface-subtle-strong) hover:text-(--ink-strong)"
          onClick={hideModal}
          ref={closeButtonRef}
          type="button"
        >
          ×
        </button>

        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <Image
              alt="Sakinah.now logo"
              className="object-contain p-1"
              fill
              sizes="40px"
              src="/LogoSakinah.now.png"
            />
          </div>
          <div className="relative h-6 w-35">
            <Image
              alt="Sakinah.now"
              className="object-contain object-left"
              fill
              sizes="140px"
              src="/LogoTypeSakinah.now.png"
            />
          </div>
        </div>

        <h2
          className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)"
          id={titleId}
        >
          Return to inner calm through Quranic reflection
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--ink-soft)" id={descriptionId}>
          Share what shook your heart, and receive a grounded reading path back to sakinah.
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--surface-subtle) text-xs font-semibold text-(--ink-soft)">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-(--ink-strong)">Describe the moment</p>
              <p className="text-xs leading-5 text-(--ink-soft)">What disrupted your peace?</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--surface-subtle) text-xs font-semibold text-(--ink-soft)">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-(--ink-strong)">Name what you feel</p>
              <p className="text-xs leading-5 text-(--ink-soft)">So the reading can meet you there.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--surface-subtle) text-xs font-semibold text-(--ink-soft)">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-(--ink-strong)">Sit with a guided verse</p>
              <p className="text-xs leading-5 text-(--ink-soft)">
                A reflection and Quran passage to steady your heart.
              </p>
            </div>
          </div>
        </div>

        <button
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-(--ink-strong) px-5 py-3 text-sm font-semibold text-white transition hover:bg-(--accent)"
          onClick={hideModal}
          type="button"
        >
          Start reflecting
        </button>
      </div>
    </div>
  );
}
