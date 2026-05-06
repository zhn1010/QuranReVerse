'use client';

import { useId, useRef, type ReactNode } from 'react';
import { useAccessibleDialog } from '@/hooks/use-accessible-dialog';
import { detectTextDirection, getDirectionStyles, type TextDirection } from '@/lib/reflection-ui';

export function SaveNoteModal({
  body,
  bodyDirection,
  description,
  disableGenerate = false,
  error,
  feedbackDirection,
  generateLabel = 'Generate draft',
  generatingLabel = 'Drafting...',
  isGenerating,
  isOpen,
  isSaving,
  onBodyChange,
  onClose,
  onGenerateDraft,
  onSave,
  placeholder,
  saveLabel = 'Save note',
  savingLabel = 'Saving...',
  title,
}: {
  body: string;
  bodyDirection?: TextDirection;
  description: ReactNode;
  disableGenerate?: boolean;
  error: string | null;
  feedbackDirection?: TextDirection;
  generateLabel?: string;
  generatingLabel?: string;
  isGenerating: boolean;
  isOpen: boolean;
  isSaving: boolean;
  onBodyChange: (body: string) => void;
  onClose: () => void;
  onGenerateDraft: () => void;
  onSave: () => void;
  placeholder: string;
  saveLabel?: string;
  savingLabel?: string;
  title: string;
}) {
  const textareaId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const statusMessage = isGenerating ? generatingLabel : isSaving ? savingLabel : '';
  const resolvedBodyDirection = detectTextDirection(body, bodyDirection ?? 'ltr');
  const resolvedFeedbackDirection = error
    ? detectTextDirection(error, feedbackDirection ?? resolvedBodyDirection)
    : feedbackDirection;
  const { descriptionId, dialogRef, titleId } = useAccessibleDialog<HTMLDivElement>({
    initialFocusRef: textareaRef,
    isOpen,
    onClose: isSaving ? undefined : onClose,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--surface-scrim) p-4"
      onClick={(overlayEvent) => {
        if (overlayEvent.target === overlayEvent.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        aria-busy={isGenerating || isSaving}
        className="flex w-full max-w-2xl flex-col rounded-(--radius-panel) border border-(--line) bg-white p-6 shadow-(--shadow-modal) sm:p-8"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <h2 className="text-lg font-semibold text-(--ink-strong)" id={titleId}>
          {title}
        </h2>
        <p className="mt-1 text-sm leading-7 text-(--ink-soft)" id={descriptionId}>
          {description}
        </p>
        {statusMessage ? (
          <p aria-atomic="true" aria-live="polite" className="sr-only" role="status">
            {statusMessage}
          </p>
        ) : null}
        <div className="relative mt-4">
          <label className="sr-only" htmlFor={textareaId}>
            {title}
          </label>
          <textarea
            aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
            className={`min-h-64 w-full rounded-(--radius-field) border border-(--line) bg-(--surface-input) px-5 py-4 pb-14 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-(--border-focus) focus:ring-4 focus:ring-(--focus-ring) sm:min-h-80 ${getDirectionStyles(
              resolvedBodyDirection,
            )}`}
            disabled={isSaving || isGenerating}
            dir={resolvedBodyDirection}
            id={textareaId}
            onChange={(inputEvent) => onBodyChange(inputEvent.target.value)}
            placeholder={placeholder}
            ref={textareaRef}
            value={body}
          />
          <div className="absolute bottom-3 left-3">
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-(--surface-card-strong) px-3.5 py-1.5 text-xs font-medium text-(--ink-soft) shadow-sm transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || isGenerating || disableGenerate}
              onClick={onGenerateDraft}
              type="button"
            >
              {isGenerating ? generatingLabel : generateLabel}
            </button>
          </div>
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
        <div className="mt-4 flex justify-end gap-3">
          <button
            className="inline-flex items-center justify-center rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle) disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isGenerating}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center justify-center rounded-full bg-(--accent-strong) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || isGenerating || body.trim().length < 6}
            onClick={onSave}
            type="button"
          >
            {isSaving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
