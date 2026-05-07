'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useToast } from '@/components/toast';
import { useQfSidebarNoteEditor } from '@/hooks/use-qf-sidebar-note-editor';
import {
  getSidebarNotesServerSnapshot,
  getSidebarNotesSnapshot,
  prefetchSidebarNotes,
  resetSidebarNotes,
  subscribeSidebarNotes,
} from '@/lib/sidebar-notes-store';
import { SidebarNoteModal } from './sidebar-note-modal';
import { SidebarNotesList } from './sidebar-notes-list';

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
      <SidebarNotesList notesState={state} onOpenNote={openNote} />
      {activeNote ? (
        <SidebarNoteModal
          activeNote={activeNote}
          handleDeleteConfirmationToggle={handleDeleteConfirmationToggle}
          handleDeleteNote={handleDeleteNote}
          handleSaveNote={handleSaveNote}
          noteDirection={noteDirection}
          portalHost={portalHost}
          setActiveNote={setActiveNote}
        />
      ) : null}
    </>
  );
}
