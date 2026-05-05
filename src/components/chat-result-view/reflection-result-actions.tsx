'use client';

import type { Dispatch, MouseEvent, SetStateAction } from 'react';
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
  noteSaved,
  noteState,
  setNoteState,
  isAuthenticated,
}: {
  handleConnectClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  handleNoteDraftGenerate: () => void;
  handleNoteSave: () => void;
  loginHref: string;
  noteSaved: boolean;
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
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Save as note to Quran.com
          </button>
        ) : (
          <a
            className="inline-flex items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-card) px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
            href={loginHref}
            onClick={handleConnectClick}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Connect to save as a note
          </a>
        )}
      </div>

      {noteSaved ? (
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-(--surface-subtle-soft) px-5 py-4 sm:max-w-[75%]">
          <p className="text-sm leading-7 text-(--ink-strong)">
            Your note has been saved to your Quran Foundation account.
          </p>
        </div>
      ) : null}

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
