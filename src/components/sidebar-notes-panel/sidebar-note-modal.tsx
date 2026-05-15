'use client';

import { type Dispatch, type SetStateAction } from 'react';
import { SaveNoteModal } from '@/components/reflection/save-note-modal';
import type { ActiveSidebarNoteState } from '@/hooks/use-qf-sidebar-note-editor';
import { detectTextDirection, getDirectionStyles, type TextDirection } from '@/lib/reflection-ui';
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
  const statusMessage = activeNote.isDeleting
    ? 'Deleting note...'
    : activeNote.isSaving
      ? 'Saving note...'
      : '';

  return (
    <SaveNoteModal
      beforeTextarea={
        activeNote.note.ranges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeNote.note.ranges.map((range) => (
              <a
                className="inline-flex items-center rounded-full border border-(--line) bg-(--surface-card) px-3 py-1.5 text-sm font-medium text-(--ink-strong) transition hover:bg-white"
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
        ) : null
      }
      body={activeNote.draftBody}
      bodyDirection={noteDirection}
      closeLabel="Close note"
      description={
        formatNoteDate(activeNote.note.updatedAt ?? activeNote.note.createdAt, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) ?? 'Unknown date'
      }
      disableGenerate
      error={activeNote.error}
      feedbackDirection={detectTextDirection(activeNote.error ?? '', noteDirection)}
      footerStart={
        <div className="flex flex-col gap-3">
          {activeNote.confirmingDelete ? (
            <div className="rounded-[1.2rem] border border-(--border-danger) bg-(--surface-danger-soft) px-4 py-3">
              <p className="text-sm font-semibold text-(--ink-danger)">Delete this note?</p>
              <p className="mt-1 text-xs leading-5 text-(--ink-danger)">
                This removes it from your Quran Foundation account.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="inline-flex items-center justify-center rounded-full border border-(--border-danger-strong) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--ink-danger) transition hover:bg-(--surface-danger-strong) disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activeNote.isSaving || activeNote.isDeleting}
                  onClick={handleDeleteNote}
                  type="button"
                >
                  {activeNote.isDeleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-(--border-strong) px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activeNote.isSaving || activeNote.isDeleting}
                  onClick={handleDeleteConfirmationToggle}
                  type="button"
                >
                  No
                </button>
              </div>
            </div>
          ) : null}
          <button
            className="inline-flex items-center justify-center self-start rounded-full border border-(--border-danger) px-4 py-2.5 text-sm font-semibold text-(--ink-danger) transition hover:bg-(--surface-danger-soft) disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeNote.isSaving || activeNote.isDeleting}
            onClick={handleDeleteConfirmationToggle}
            type="button"
          >
            {activeNote.confirmingDelete ? 'Cancel delete' : 'Delete note'}
          </button>
        </div>
      }
      isBusy={activeNote.isSaving || activeNote.isDeleting}
      isGenerating={false}
      isOpen
      isSaving={activeNote.isSaving}
      onBodyChange={(body) =>
        setActiveNote((current) =>
          current
            ? {
                ...current,
                confirmingDelete: false,
                draftBody: body,
                error: null,
              }
            : null,
        )
      }
      onClose={() => setActiveNote(null)}
      onGenerateDraft={() => undefined}
      onSave={handleSaveNote}
      placeholder="Write your personal note here..."
      portalHost={portalHost}
      saveLabel="Save changes"
      showGenerateAction={false}
      statusMessage={statusMessage}
      title="Saved note"
    />
  );
}
