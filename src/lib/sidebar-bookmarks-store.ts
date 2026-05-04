type SidebarBookmark = {
  arabicText: string;
  ayahNo: string;
  bookmarkId: string;
  createdAt: string;
  englishTranslation: string;
  surahArabicName: string;
  surahName: string;
  surahNo: number;
  translationName: string;
  verseKey: string;
};

type SidebarBookmarksPayload = {
  bookmarks?: SidebarBookmark[];
  collectionName?: string | null;
  error?: string;
};

export type SidebarBookmarksSnapshot = {
  bookmarks: SidebarBookmark[];
  collectionName: string;
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
};

const INITIAL_SNAPSHOT: SidebarBookmarksSnapshot = {
  bookmarks: [],
  collectionName: 'Sakinah.now',
  error: null,
  hasFetched: false,
  isLoading: false,
};

let snapshot: SidebarBookmarksSnapshot = INITIAL_SNAPSHOT;
let inFlightRequest: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(nextSnapshot: SidebarBookmarksSnapshot) {
  snapshot = nextSnapshot;
  emitChange();
}

async function requestSidebarBookmarks(force: boolean) {
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
      const response = await fetch('/api/qf/bookmark/collection', {
        credentials: 'include',
      });
      const payload = (await response.json()) as SidebarBookmarksPayload;

      if (!response.ok) {
        throw new Error(payload.error || 'Could not load bookmarks.');
      }

      setSnapshot({
        bookmarks: Array.isArray(payload.bookmarks) ? payload.bookmarks : [],
        collectionName: payload.collectionName?.trim() || 'Sakinah.now',
        error: null,
        hasFetched: true,
        isLoading: false,
      });
    } catch (error) {
      setSnapshot({
        ...snapshot,
        error: error instanceof Error ? error.message : 'Could not load bookmarks.',
        hasFetched: true,
        isLoading: false,
      });
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

export function subscribeSidebarBookmarks(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSidebarBookmarksSnapshot() {
  return snapshot;
}

export function getSidebarBookmarksServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function resetSidebarBookmarks() {
  if (snapshot === INITIAL_SNAPSHOT) {
    return;
  }

  inFlightRequest = null;
  setSnapshot(INITIAL_SNAPSHOT);
}

export function prefetchSidebarBookmarks() {
  return requestSidebarBookmarks(false);
}

export function revalidateSidebarBookmarks() {
  return requestSidebarBookmarks(true);
}
