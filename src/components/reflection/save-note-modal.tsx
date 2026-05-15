'use client';

import { createPortal } from 'react-dom';
import { useId, useRef, type ReactNode } from 'react';
import { MagicStarsIcon } from '@/components/icons';
import { useAccessibleDialog } from '@/hooks/use-accessible-dialog';
import { detectTextDirection, getDirectionStyles, type TextDirection } from '@/lib/reflection-ui';

export function SaveNoteModal({
  beforeTextarea,
  body,
  bodyDirection,
  closeLabel = 'Close note',
  description,
  footerStart,
  disableGenerate = false,
  error,
  feedbackDirection,
  generateLabel = 'Generate draft',
  generatingLabel = 'Drafting...',
  isGenerating,
  isBusy,
  isOpen,
  isSaving,
  onBodyChange,
  onClose,
  onGenerateDraft,
  onSave,
  placeholder,
  portalHost,
  saveLabel = 'Save note',
  savingLabel = 'Saving...',
  showGenerateAction = true,
  statusMessage,
  title,
}: {
  beforeTextarea?: ReactNode;
  body: string;
  bodyDirection?: TextDirection;
  closeLabel?: string;
  description: ReactNode;
  footerStart?: ReactNode;
  disableGenerate?: boolean;
  error: string | null;
  feedbackDirection?: TextDirection;
  generateLabel?: string;
  generatingLabel?: string;
  isGenerating: boolean;
  isBusy?: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onBodyChange: (body: string) => void;
  onClose: () => void;
  onGenerateDraft: () => void;
  onSave: () => void;
  placeholder: string;
  portalHost?: HTMLElement | null;
  saveLabel?: string;
  savingLabel?: string;
  showGenerateAction?: boolean;
  statusMessage?: string;
  title: string;
}) {
  const textareaId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resolvedBusy = isBusy ?? (isGenerating || isSaving);
  const resolvedStatusMessage =
    statusMessage ?? (isGenerating ? generatingLabel : isSaving ? savingLabel : '');
  const shouldShowGenerateAction =
    showGenerateAction && !disableGenerate && body.trim().length === 0;
  const resolvedBodyDirection = detectTextDirection(body, bodyDirection ?? 'ltr');
  const resolvedFeedbackDirection = error
    ? detectTextDirection(error, feedbackDirection ?? resolvedBodyDirection)
    : feedbackDirection;
  const { descriptionId, dialogRef, titleId } = useAccessibleDialog<HTMLDivElement>({
    initialFocusRef: textareaRef,
    isOpen,
    onClose: resolvedBusy ? undefined : onClose,
  });

  if (!isOpen) {
    return null;
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--surface-scrim) p-4"
      onClick={(overlayEvent) => {
        if (overlayEvent.target === overlayEvent.currentTarget && !resolvedBusy) {
          onClose();
        }
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        aria-busy={resolvedBusy}
        className="flex max-h-[min(760px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-(--radius-panel) border border-(--line) bg-white shadow-(--shadow-modal)"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-(--line) px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-(--ink-strong)" id={titleId}>
              {title}
            </h2>
            <p className="mt-1 text-sm leading-7 text-(--ink-soft)" id={descriptionId}>
              {description}
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-(--line) bg-(--surface-card) text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resolvedBusy}
            onClick={onClose}
            type="button"
          >
            <span className="sr-only">{closeLabel}</span>×
          </button>
        </div>
        {resolvedStatusMessage ? (
          <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
            {resolvedStatusMessage}
          </p>
        ) : null}
        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-8">
          {beforeTextarea ? <div className="mb-4">{beforeTextarea}</div> : null}
          <div className="relative">
            <label className="sr-only" htmlFor={textareaId}>
              {title}
            </label>
            <textarea
              aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
              className={`min-h-64 w-full rounded-(--radius-field) border border-(--line) bg-(--surface-input) px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-(--border-focus) focus:ring-4 focus:ring-(--focus-ring) sm:min-h-80 ${
                shouldShowGenerateAction ? 'pb-14' : ''
              } ${getDirectionStyles(resolvedBodyDirection)}`}
              disabled={resolvedBusy}
              dir={resolvedBodyDirection}
              id={textareaId}
              onChange={(inputEvent) => onBodyChange(inputEvent.target.value)}
              placeholder={placeholder}
              ref={textareaRef}
              value={body}
            />
            {shouldShowGenerateAction ? (
              <div className="absolute bottom-3 left-3">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-(--surface-card-strong) px-3.5 py-1.5 text-xs font-medium text-(--ink-soft) shadow-sm transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resolvedBusy}
                  onClick={onGenerateDraft}
                  type="button"
                >
                  <MagicStarsIcon className="h-3.5 w-3.5 shrink-0" />
                  {isGenerating ? generatingLabel : generateLabel}
                </button>
              </div>
            ) : null}
          </div>
          {error ? (
            <p
              className={`mt-2 text-sm text-(--ink-warning) ${
                resolvedFeedbackDirection ? getDirectionStyles(resolvedFeedbackDirection) : ''
              }`}
              dir={resolvedFeedbackDirection}
              id={errorId}
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-(--line) px-6 py-4 sm:px-8">
          <div>{footerStart}</div>
          <div className="flex items-center justify-end gap-3">
            <button
              className="inline-flex items-center justify-center rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle) disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resolvedBusy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center justify-center rounded-full bg-(--accent-strong) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resolvedBusy || body.trim().length < 6}
              onClick={onSave}
              type="button"
            >
              {isSaving ? savingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (portalHost) {
    return createPortal(modal, portalHost);
  }

  return modal;
}
