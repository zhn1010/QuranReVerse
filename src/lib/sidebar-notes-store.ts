import { createResourceStore } from '@/lib/create-resource-store';
import type { QfSavedNote } from '@/lib/qf/types';

type SidebarNotesPayload = {
  error?: string;
  notes?: QfSavedNote[];
};

export type SidebarNotesSnapshot = {
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
  notes: QfSavedNote[];
};

const INITIAL_SNAPSHOT: SidebarNotesSnapshot = {
  error: null,
  hasFetched: false,
  isLoading: false,
  notes: [],
};
const store = createResourceStore({
  fetchResource: async () => {
    const response = await fetch('/api/qf/note', {
      credentials: 'include',
    });
    const payload = (await response.json()) as SidebarNotesPayload;

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load notes.');
    }

    return {
      notes: Array.isArray(payload.notes) ? payload.notes : [],
    };
  },
  getErrorMessage: (error) => (error instanceof Error ? error.message : 'Could not load notes.'),
  initialData: {
    notes: [],
  },
});

function buildSnapshot(snapshot: ReturnType<typeof store.getSnapshot>): SidebarNotesSnapshot {
  return {
    error: snapshot.error,
    hasFetched: snapshot.hasFetched,
    isLoading: snapshot.isLoading,
    notes: snapshot.data.notes,
  };
}

let lastStoreSnapshot = store.getSnapshot();
let lastSidebarSnapshot = buildSnapshot(lastStoreSnapshot);

export function subscribeSidebarNotes(listener: () => void) {
  return store.subscribe(listener);
}

export function getSidebarNotesSnapshot() {
  const snapshot = store.getSnapshot();
  if (snapshot === lastStoreSnapshot) {
    return lastSidebarSnapshot;
  }

  lastStoreSnapshot = snapshot;
  lastSidebarSnapshot = buildSnapshot(snapshot);
  return lastSidebarSnapshot;
}

export function getSidebarNotesServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function resetSidebarNotes() {
  store.reset();
}

export function prefetchSidebarNotes() {
  return store.prefetch();
}

export function revalidateSidebarNotes() {
  return store.revalidate();
}
