'use client';

import { detectTextDirection, getDirectionStyles } from '@/lib/shared/reflection/ui';
import type { QfSavedNote } from '@/lib/shared/qf/types';
import type { SidebarNotesSnapshot } from '@/lib/client/stores/sidebar-notes-store';

function buildNotePreview(note: QfSavedNote) {
  const normalized = note.body.replace(/\s+/gu, ' ').trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function formatNoteDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, options);
}

export function SidebarNotesList({
  notesState,
  onOpenNote,
}: {
  notesState: SidebarNotesSnapshot;
  onOpenNote: (note: QfSavedNote) => void;
}) {
  if (notesState.isLoading && !notesState.hasFetched) {
    return (
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
    );
  }

  if (notesState.error) {
    return (
      <div className="rounded-7 border border-(--border-danger) bg-(--surface-danger-soft) px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-danger)">Could not load notes</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-danger)">{notesState.error}</p>
      </div>
    );
  }

  if (notesState.notes.length === 0) {
    return (
      <div className="rounded-7 border border-dashed border-(--line) bg-white/55 px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-strong)">Notes</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-soft)">
          Saved reflection notes will appear here once you create them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notesState.notes.map((note) => {
        const previewDirection = detectTextDirection(note.body);

        return (
          <button
            className="block w-full cursor-pointer rounded-5 border border-(--border-subtle) bg-(--surface-card-tint) px-4 py-3 text-left transition hover:bg-(--surface-card-hover)"
            key={note.id}
            onClick={() => onOpenNote(note)}
            type="button"
          >
            <p className="text-[0.74rem] font-medium uppercase tracking-[0.14em] text-(--ink-soft)">
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
  );
}
