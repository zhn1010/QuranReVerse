'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/toast';
import { useQfSidebarNoteEditor } from '@/hooks/use-qf-sidebar-note-editor';
import { detectTextDirection, getDirectionStyles } from '@/lib/reflection-ui';
import {
  getSidebarNotesServerSnapshot,
  getSidebarNotesSnapshot,
  prefetchSidebarNotes,
  resetSidebarNotes,
  subscribeSidebarNotes,
} from '@/lib/sidebar-notes-store';
import type { QfSavedNote } from '@/lib/qf/types';

function buildNotePreview(note: QfSavedNote) {
  const normalized = note.body.replace(/\s+/gu, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

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

function formatNoteDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, options);
}

export function SidebarNotesPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const toast = useToast();
  const state = useSyncExternalStore(
    subscribeSidebarNotes,
    getSidebarNotesSnapshot,
    getSidebarNotesServerSnapshot,
  );
  const {
    activeNote,
    handleDeleteConfirmationToggle,
    handleDeleteNote,
    handleSaveNote,
    noteDirection,
    openNote,
    setActiveNote,
  } = useQfSidebarNoteEditor({
    toast,
  });
  const portalHost = typeof document === 'undefined' ? null : document.body;

  useEffect(() => {
    if (!isAuthenticated) {
      resetSidebarNotes();
      setActiveNote(null);
      return;
    }

    void prefetchSidebarNotes();
  }, [isAuthenticated, setActiveNote]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-7 border border-dashed border-(--line) bg-white/55 px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-strong)">Notes</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-soft)">
          Connect your Quran Foundation account to load and manage saved notes.
        </p>
      </div>
    );
  }

  return (
    <>
      {state.isLoading && !state.hasFetched ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="rounded-[1.4rem] border border-(--border-subtle) bg-(--surface-card-muted) px-4 py-4"
              key={index}
            >
              <div className="shimmer-bar h-3 w-20 rounded-full" />
              <div className="mt-3 shimmer-bar h-3 w-full rounded-full" />
              <div className="mt-2 shimmer-bar h-3 w-[84%] rounded-full" />
            </div>
          ))}
        </div>
      ) : state.error ? (
        <div className="rounded-7 border border-(--border-danger) bg-(--surface-danger-soft) px-4 py-5">
          <p className="text-sm font-semibold text-(--ink-danger)">Could not load notes</p>
          <p className="mt-2 text-sm leading-6 text-(--ink-danger)">{state.error}</p>
        </div>
      ) : state.notes.length === 0 ? (
        <div className="rounded-7 border border-dashed border-(--line) bg-white/55 px-4 py-5">
          <p className="text-sm font-semibold text-(--ink-strong)">Notes</p>
          <p className="mt-2 text-sm leading-6 text-(--ink-soft)">
            Saved reflection notes will appear here once you create them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.notes.map((note) => {
            const previewDirection = detectTextDirection(note.body);

            return (
              <button
                className="block w-full cursor-pointer rounded-5 border border-(--border-subtle) bg-(--surface-card-tint) px-4 py-3 text-left transition hover:bg-(--surface-card-hover)"
                key={note.id}
                onClick={() => openNote(note)}
                type="button"
              >
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-(--ink-soft)">
                  {formatNoteDate(note.updatedAt ?? note.createdAt, {
                    day: 'numeric',
                    month: 'short',
                  }) ?? 'Unknown'}
                </p>
                <p
                  className={`mt-2 line-clamp-3 text-sm leading-6 text-(--ink-strong) ${getDirectionStyles(previewDirection)}`}
                  dir={previewDirection}
                >
                  {buildNotePreview(note)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {portalHost && activeNote
        ? createPortal(
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
                        <p className="text-sm font-semibold text-(--ink-danger)">
                          Delete this note?
                        </p>
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
          )
        : null}
    </>
  );
}
