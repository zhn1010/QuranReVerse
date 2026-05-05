import type { QfSavedNote } from '@/lib/qf-user';

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

let snapshot: SidebarNotesSnapshot = INITIAL_SNAPSHOT;
let inFlightRequest: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(nextSnapshot: SidebarNotesSnapshot) {
  snapshot = nextSnapshot;
  emitChange();
}

async function requestSidebarNotes(force: boolean) {
  if (inFlightRequest) {
    return inFlightRequest;
  }

  if (!force && snapshot.hasFetched) {
    return Promise.resolve();
  }

  setSnapshot({
    ...snapshot,
    error: null,
    isLoading: true,
  });

  inFlightRequest = (async () => {
    try {
      const response = await fetch('/api/qf/note', {
        credentials: 'include',
      });
      const payload = (await response.json()) as SidebarNotesPayload;

      if (!response.ok) {
        throw new Error(payload.error || 'Could not load notes.');
      }

      setSnapshot({
        error: null,
        hasFetched: true,
        isLoading: false,
        notes: Array.isArray(payload.notes) ? payload.notes : [],
      });
    } catch (error) {
      setSnapshot({
        ...snapshot,
        error: error instanceof Error ? error.message : 'Could not load notes.',
        hasFetched: true,
        isLoading: false,
      });
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function subscribeSidebarNotes(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSidebarNotesSnapshot() {
  return snapshot;
}

export function getSidebarNotesServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function resetSidebarNotes() {
  if (snapshot === INITIAL_SNAPSHOT) {
    return;
  }

  inFlightRequest = null;
  setSnapshot(INITIAL_SNAPSHOT);
}

export function prefetchSidebarNotes() {
  return requestSidebarNotes(false);
}

export function revalidateSidebarNotes() {
  return requestSidebarNotes(true);
}
