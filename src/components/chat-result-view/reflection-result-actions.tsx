'use client';

import type { Dispatch, MouseEvent, SetStateAction } from 'react';
import { NotePenIcon } from '@/components/icons';
import { SaveNoteModal } from '@/components/reflection/save-note-modal';

type NoteState = {
  body: string;
  error: string | null;
  isGenerating: boolean;
  isSaving: boolean;
  open: boolean;
};

export function ReflectionResultActions({
  handleConnectClick,
  handleNoteDraftGenerate,
  handleNoteSave,
  loginHref,
  noteState,
  setNoteState,
  isAuthenticated,
}: {
  handleConnectClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  handleNoteDraftGenerate: () => void;
  handleNoteSave: () => void;
  loginHref: string;
  noteState: NoteState;
  setNoteState: Dispatch<SetStateAction<NoteState>>;
  isAuthenticated: boolean;
}) {
  return (
    <>
      <div className="flex gap-3 pl-2">
        {isAuthenticated ? (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-card) px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
            onClick={() =>
              setNoteState({
                body: '',
                error: null,
                isGenerating: false,
                isSaving: false,
                open: true,
              })
            }
            type="button"
          >
            <NotePenIcon className="h-3.5 w-3.5" />
            Save a note
          </button>
        ) : (
          <a
            className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-card) px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
            href={loginHref}
            onClick={handleConnectClick}
          >
            <NotePenIcon className="h-3.5 w-3.5" />
            Connect to save as a note
          </a>
        )}
      </div>

      <SaveNoteModal
        body={noteState.body}
        description="This note will be saved to your Quran Foundation account."
        error={noteState.error}
        isGenerating={noteState.isGenerating}
        isOpen={noteState.open}
        isSaving={noteState.isSaving}
        onBodyChange={(body) =>
          setNoteState((prev) => ({
            ...prev,
            body,
            error: null,
          }))
        }
        onClose={() => setNoteState((prev) => ({ ...prev, open: false }))}
        onGenerateDraft={handleNoteDraftGenerate}
        onSave={handleNoteSave}
        placeholder="Write your personal note here..."
        title="Save a note"
      />
    </>
  );
}
