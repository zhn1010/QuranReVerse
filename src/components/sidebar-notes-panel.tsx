'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useToast } from '@/components/toast';
import {
  detectTextDirection,
  getDirectionStyles,
  type TextDirection,
} from '@/lib/reflection-ui';
import {
  getSidebarNotesServerSnapshot,
  getSidebarNotesSnapshot,
  prefetchSidebarNotes,
  revalidateSidebarNotes,
  resetSidebarNotes,
  subscribeSidebarNotes,
} from '@/lib/sidebar-notes-store';
import type { QfSavedNote } from '@/lib/qf-user';

type ActiveNoteState = {
  draftBody: string;
  error: string | null;
  isDeleting: boolean;
  isSaving: boolean;
  note: QfSavedNote;
};

function buildNotePreview(note: QfSavedNote) {
  const normalized = note.body.replace(/\s+/gu, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function SidebarNotesPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const toast = useToast();
  const state = useSyncExternalStore(
    subscribeSidebarNotes,
    getSidebarNotesSnapshot,
    getSidebarNotesServerSnapshot,
  );
  const [activeNote, setActiveNote] = useState<ActiveNoteState | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      resetSidebarNotes();
      setActiveNote(null);
      return;
    }

    void prefetchSidebarNotes();
  }, [isAuthenticated]);

  const noteDirection = useMemo<TextDirection>(
    () => detectTextDirection(activeNote?.draftBody ?? ''),
    [activeNote?.draftBody],
  );

  async function handleSaveNote() {
    if (!activeNote) {
      return;
    }

    const body = activeNote.draftBody.trim();
    if (body.length < 6) {
      setActiveNote((current) =>
        current
          ? {
              ...current,
              error: 'Note body must be at least 6 characters.',
            }
          : null,
      );
      return;
    }

    setActiveNote((current) =>
      current
        ? {
            ...current,
            error: null,
            isSaving: true,
          }
        : null,
    );

    try {
      const response = await fetch('/api/qf/note', {
        body: JSON.stringify({
          body,
          id: activeNote.note.id,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not update the note.');
      }

      await revalidateSidebarNotes();
      toast.success('Note updated.');
      setActiveNote(null);
    } catch (error) {
      setActiveNote((current) =>
        current
          ? {
              ...current,
              error: error instanceof Error ? error.message : 'Could not update the note.',
              isSaving: false,
            }
          : null,
      );
    }
  }

  async function handleDeleteNote() {
    if (!activeNote) {
      return;
    }

    const shouldDelete = window.confirm('Delete this note from your Quran Foundation account?');
    if (!shouldDelete) {
      return;
    }

    setActiveNote((current) =>
      current
        ? {
            ...current,
            error: null,
            isDeleting: true,
          }
        : null,
    );

    try {
      const response = await fetch('/api/qf/note', {
        body: JSON.stringify({
          id: activeNote.note.id,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not delete the note.');
      }

      await revalidateSidebarNotes();
      toast.success('Note deleted.');
      setActiveNote(null);
    } catch (error) {
      setActiveNote((current) =>
        current
          ? {
              ...current,
              error: error instanceof Error ? error.message : 'Could not delete the note.',
              isDeleting: false,
            }
          : null,
      );
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-(--line) bg-white/55 px-4 py-5">
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
              className="rounded-[1.4rem] border border-[rgba(63,63,70,0.08)] bg-white/60 px-4 py-4"
              key={index}
            >
              <div className="shimmer-bar h-3 w-20 rounded-full" />
              <div className="mt-3 shimmer-bar h-3 w-full rounded-full" />
              <div className="mt-2 shimmer-bar h-3 w-[84%] rounded-full" />
            </div>
          ))}
        </div>
      ) : state.error ? (
        <div className="rounded-[1.75rem] border border-[rgba(140,32,32,0.18)] bg-[rgba(140,32,32,0.05)] px-4 py-5">
          <p className="text-sm font-semibold text-[rgb(110,28,28)]">Could not load notes</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(110,28,28)]">{state.error}</p>
        </div>
      ) : state.notes.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-(--line) bg-white/55 px-4 py-5">
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
                className="block w-full cursor-pointer rounded-[1.25rem] border border-[rgba(63,63,70,0.08)] bg-white/68 px-4 py-3 text-left transition hover:bg-white/92"
                key={note.id}
                onClick={() =>
                  setActiveNote({
                    draftBody: note.body,
                    error: null,
                    isDeleting: false,
                    isSaving: false,
                    note,
                  })
                }
                type="button"
              >
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-(--ink-soft)">
                  {new Date(note.updatedAt ?? note.createdAt ?? Date.now()).toLocaleDateString(
                    undefined,
                    {
                      day: 'numeric',
                      month: 'short',
                    },
                  )}
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

      {activeNote ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,24,27,0.28)] px-4 py-6"
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
          <div className="flex max-h-[min(760px,90vh)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[rgba(63,63,70,0.12)] bg-[rgba(255,255,255,0.96)] shadow-[0_30px_80px_rgba(24,24,27,0.18)] backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[rgba(63,63,70,0.08)] px-6 py-4">
              <div>
                <p className="text-lg font-semibold text-(--ink-strong)">Saved note</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--ink-soft)">
                  {new Date(
                    activeNote.note.updatedAt ?? activeNote.note.createdAt ?? Date.now(),
                  ).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-(--line) bg-white/80 text-(--ink-soft) transition hover:bg-white"
                disabled={activeNote.isSaving || activeNote.isDeleting}
                onClick={() => setActiveNote(null)}
                type="button"
              >
                <span className="sr-only">Close note</span>
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <textarea
                className={`min-h-72 w-full resize-none rounded-[1.4rem] border border-(--line) bg-[rgba(244,244,245,0.52)] px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)] ${getDirectionStyles(noteDirection)}`}
                dir={noteDirection}
                disabled={activeNote.isSaving || activeNote.isDeleting}
                onChange={(event) =>
                  setActiveNote((current) =>
                    current
                      ? {
                          ...current,
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
                  className={`mt-3 text-sm text-[rgb(146,64,14)] ${getDirectionStyles(
                    detectTextDirection(activeNote.error, noteDirection),
                  )}`}
                  dir={detectTextDirection(activeNote.error, noteDirection)}
                >
                  {activeNote.error}
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t border-[rgba(63,63,70,0.08)] px-6 py-4">
              <button
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[rgba(140,32,32,0.18)] px-4 py-2.5 text-sm font-semibold text-[rgb(110,28,28)] transition hover:bg-[rgba(140,32,32,0.05)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={activeNote.isSaving || activeNote.isDeleting}
                onClick={handleDeleteNote}
                type="button"
              >
                {activeNote.isDeleting ? 'Deleting...' : 'Delete note'}
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
      ) : null}
    </>
  );
}
