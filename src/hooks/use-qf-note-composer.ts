'use client';

import { useState } from 'react';
import type { ToastContextValue } from '@/components/toast-public';
import type { ApiResponse } from '@/lib/antidote-types';
import { buildQfNoteDraftPayload, saveQfNote, streamQfNoteDraft } from '@/lib/qf-browser';
import { revalidateSidebarNotes } from '@/lib/sidebar-notes-store';

type NoteState = {
  body: string;
  error: string | null;
  isGenerating: boolean;
  isSaving: boolean;
  open: boolean;
};

export function useQfNoteComposer({
  eventContent,
  result,
  toast,
  userFeeling,
}: {
  eventContent: string;
  result: Pick<ApiResponse, 'diagnosis' | 'reflection_guide' | 'selected_reflection'>;
  toast: Pick<ToastContextValue, 'error' | 'success'>;
  userFeeling: string;
}) {
  const [noteState, setNoteState] = useState<NoteState>({
    body: '',
    error: null,
    isGenerating: false,
    isSaving: false,
    open: false,
  });

  async function handleNoteDraftGenerate() {
    setNoteState((prev) => ({ ...prev, body: '', error: null, isGenerating: true }));

    try {
      await streamQfNoteDraft(
        buildQfNoteDraftPayload({
          eventContent,
          result,
          userFeeling,
        }),
        {
          onChunk: (text) => {
            setNoteState((prev) => ({ ...prev, body: text }));
          },
        },
      );

      setNoteState((prev) => ({ ...prev, isGenerating: false }));
    } catch (error) {
      setNoteState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Could not generate draft.',
        isGenerating: false,
      }));
    }
  }

  async function handleNoteSave() {
    if (!noteState.body.trim() || noteState.body.trim().length < 6) {
      setNoteState((prev) => ({
        ...prev,
        error: 'Note must be at least 6 characters long.',
      }));
      return;
    }

    setNoteState((prev) => ({ ...prev, error: null, isSaving: true }));

    try {
      await saveQfNote({
        body: noteState.body.trim(),
        selectedReflection: result.selected_reflection,
      });

      setNoteState({
        body: '',
        error: null,
        isGenerating: false,
        isSaving: false,
        open: false,
      });
      void revalidateSidebarNotes();
      toast.success('Note saved to your Quran Foundation account.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the note.';
      setNoteState((prev) => ({
        ...prev,
        error: message,
        isSaving: false,
      }));
      toast.error(message);
    }
  }

  return {
    noteState,
    setNoteState,
    handleNoteDraftGenerate,
    handleNoteSave,
  };
}
