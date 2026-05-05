'use client';

import { createPortal } from 'react-dom';
import { detectTextDirection, getDirectionStyles, type TextDirection } from '@/lib/reflection-ui';
import type { Dispatch, SetStateAction } from 'react';
import type { ActiveSidebarNoteState } from '@/hooks/use-qf-sidebar-note-editor';
import { formatNoteDate } from './sidebar-notes-list';

function buildQuranRangeUrl(range: string) {
  return `https://quran.com/${range}`;
}

function formatRangeLabel(range: string) {
  const match = /^(\d+):(\d+)-(\d+):(\d+)$/u.exec(range.trim());

  if (!match) {
    return range;
  }

  const [, startSurah, startAyah, endSurah, endAyah] = match;

  if (startSurah === endSurah && startAyah === endAyah) {
    return `${startSurah}:${startAyah}`;
  }

  return range;
}

export function SidebarNoteModal({
  activeNote,
  noteDirection,
  portalHost,
  setActiveNote,
  handleDeleteConfirmationToggle,
  handleDeleteNote,
  handleSaveNote,
}: {
  activeNote: ActiveSidebarNoteState;
  noteDirection: TextDirection;
  portalHost: HTMLElement | null;
  setActiveNote: Dispatch<SetStateAction<ActiveSidebarNoteState | null>>;
  handleDeleteConfirmationToggle: () => void;
  handleDeleteNote: () => void;
  handleSaveNote: () => void;
}) {
  if (!portalHost) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--surface-scrim-soft) px-4 py-6"
      onClick={(event) => {
        if (
          event.target === event.currentTarget &&
          !activeNote.isSaving &&
          !activeNote.isDeleting
        ) {
          setActiveNote(null);
        }
      }}
    >
      <div className="flex max-h-[min(760px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-4xl border border-(--border-default) bg-(--surface-overlay) shadow-(--shadow-modal-soft) backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-(--border-subtle) px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-(--ink-strong)">Saved note</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--ink-soft)">
              {formatNoteDate(activeNote.note.updatedAt ?? activeNote.note.createdAt, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }) ?? 'Unknown date'}
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-(--line) bg-(--surface-card) text-(--ink-soft) transition hover:bg-white"
            disabled={activeNote.isSaving || activeNote.isDeleting}
            onClick={() => setActiveNote(null)}
            type="button"
          >
            <span className="sr-only">Close note</span>×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeNote.note.ranges.length > 0 ? (
            <div className="mb-5">
              <div className="mt-3 flex flex-wrap gap-2">
                {activeNote.note.ranges.map((range) => (
                  <a
                    className="inline-flex items-center rounded-full border border-(--border-default) bg-white px-3 py-1.5 text-sm font-medium text-(--ink-strong) transition hover:border-(--border-accent-hover) hover:bg-(--surface-overlay)"
                    href={buildQuranRangeUrl(range)}
                    key={range}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>{formatRangeLabel(range)}</span>
                    <span aria-hidden="true" className="ml-2 text-(--ink-soft)">
                      ↗
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <textarea
            className={`min-h-72 w-full resize-none rounded-[1.4rem] border border-(--line) bg-(--surface-input) px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-(--border-focus) focus:ring-4 focus:ring-(--focus-ring) ${getDirectionStyles(noteDirection)}`}
            dir={noteDirection}
            disabled={activeNote.isSaving || activeNote.isDeleting}
            onChange={(event) =>
              setActiveNote((current) =>
                current
                  ? {
                      ...current,
                      confirmingDelete: false,
                      draftBody: event.target.value,
                      error: null,
                    }
                  : null,
              )
            }
            value={activeNote.draftBody}
          />

          {activeNote.error ? (
            <p
              className={`mt-3 text-sm text-(--ink-danger) ${getDirectionStyles(
                detectTextDirection(activeNote.error, noteDirection),
              )}`}
              dir={detectTextDirection(activeNote.error, noteDirection)}
            >
              {activeNote.error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-(--border-subtle) px-6 py-4">
          {activeNote.confirmingDelete ? (
            <div className="mb-4 flex items-center justify-between rounded-[1.2rem] border border-(--border-danger) bg-(--surface-danger-soft) px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-(--ink-danger)">Delete this note?</p>
                <p className="mt-1 text-xs leading-5 text-(--ink-danger)">
                  This removes it from your Quran Foundation account.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-(--border-danger-strong) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--ink-danger) transition hover:bg-(--surface-danger-strong) disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activeNote.isSaving || activeNote.isDeleting}
                  onClick={handleDeleteNote}
                  type="button"
                >
                  {activeNote.isDeleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-(--border-strong) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activeNote.isSaving || activeNote.isDeleting}
                  onClick={handleDeleteConfirmationToggle}
                  type="button"
                >
                  No
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <button
              className="inline-flex cursor-pointer items-center justify-center rounded-full border border-(--border-danger) px-4 py-2.5 text-sm font-semibold text-(--ink-danger) transition hover:bg-(--surface-danger-soft) disabled:cursor-not-allowed disabled:opacity-50"
              disabled={activeNote.isSaving || activeNote.isDeleting}
              onClick={handleDeleteConfirmationToggle}
              type="button"
            >
              {activeNote.confirmingDelete ? 'Cancel delete' : 'Delete note'}
            </button>
            <button
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-(--ink-strong) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                activeNote.isSaving ||
                activeNote.isDeleting ||
                activeNote.draftBody.trim().length < 6
              }
              onClick={handleSaveNote}
              type="button"
            >
              {activeNote.isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalHost,
  );
}
