'use client';

import { useMemo, useState } from 'react';
import type { ToastContextValue } from '@/components/toast-public';
import { deleteQfNote, updateQfNote } from '@/lib/client/qf/api-client';
import { detectTextDirection, type TextDirection } from '@/lib/shared/reflection/ui';
import { revalidateSidebarNotes } from '@/lib/client/stores/sidebar-notes-store';
import type { QfSavedNote } from '@/lib/shared/qf/types';

export type ActiveSidebarNoteState = {
  confirmingDelete: boolean;
  draftBody: string;
  error: string | null;
  isDeleting: boolean;
  isSaving: boolean;
  note: QfSavedNote;
};

export function useQfSidebarNoteEditor({
  toast,
}: {
  toast: Pick<ToastContextValue, 'success'>;
}) {
  const [activeNote, setActiveNote] = useState<ActiveSidebarNoteState | null>(null);
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
      await updateQfNote({
        body,
        id: activeNote.note.id,
      });

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

    setActiveNote((current) =>
      current
        ? {
            ...current,
            confirmingDelete: false,
            error: null,
            isDeleting: true,
          }
        : null,
    );

    try {
      await deleteQfNote({
        id: activeNote.note.id,
      });

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

  function openNote(note: QfSavedNote) {
    setActiveNote({
      confirmingDelete: false,
      draftBody: note.body,
      error: null,
      isDeleting: false,
      isSaving: false,
      note,
    });
  }

  function handleDeleteConfirmationToggle() {
    setActiveNote((current) =>
      current
        ? {
            ...current,
            confirmingDelete: !current.confirmingDelete,
            error: null,
          }
        : null,
    );
  }

  return {
    activeNote,
    handleDeleteConfirmationToggle,
    handleDeleteNote,
    handleSaveNote,
    noteDirection,
    openNote,
    setActiveNote,
  };
}
