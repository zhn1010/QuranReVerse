import { QF_BOOKMARK_COLLECTION_NAME } from '@/lib/shared/constants/app';
import { createResourceStore } from '@/lib/client/stores/create-resource-store';

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
  collectionName: QF_BOOKMARK_COLLECTION_NAME,
  error: null,
  hasFetched: false,
  isLoading: false,
};
const store = createResourceStore({
  fetchResource: async () => {
    const response = await fetch('/api/qf/bookmark/collection', {
      credentials: 'include',
    });
    const payload = (await response.json()) as SidebarBookmarksPayload;

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load bookmarks.');
    }

    return {
      bookmarks: Array.isArray(payload.bookmarks) ? payload.bookmarks : [],
      collectionName: payload.collectionName?.trim() || QF_BOOKMARK_COLLECTION_NAME,
    };
  },
  getErrorMessage: (error) =>
    error instanceof Error ? error.message : 'Could not load bookmarks.',
  initialData: {
    bookmarks: [],
    collectionName: QF_BOOKMARK_COLLECTION_NAME,
  },
});

function buildSnapshot(snapshot: ReturnType<typeof store.getSnapshot>): SidebarBookmarksSnapshot {
  return {
    bookmarks: snapshot.data.bookmarks,
    collectionName: snapshot.data.collectionName,
    error: snapshot.error,
    hasFetched: snapshot.hasFetched,
    isLoading: snapshot.isLoading,
  };
}

let lastStoreSnapshot = store.getSnapshot();
let lastSidebarSnapshot = buildSnapshot(lastStoreSnapshot);

export function subscribeSidebarBookmarks(listener: () => void) {
  return store.subscribe(listener);
}

export function getSidebarBookmarksSnapshot() {
  const snapshot = store.getSnapshot();
  if (snapshot === lastStoreSnapshot) {
    return lastSidebarSnapshot;
  }

  lastStoreSnapshot = snapshot;
  lastSidebarSnapshot = buildSnapshot(snapshot);
  return lastSidebarSnapshot;
}

export function getSidebarBookmarksServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

export function resetSidebarBookmarks() {
  store.reset();
}

export function prefetchSidebarBookmarks() {
  return store.prefetch();
}

export function revalidateSidebarBookmarks() {
  return store.revalidate();
}
