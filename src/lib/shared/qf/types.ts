export type QfCollection = {
  id: string;
  name: string;
  updatedAt: string;
};

export type QfPagination = {
  endCursor?: string;
  hasNextPage?: boolean;
};

export type QfBookmark = {
  createdAt: string;
  group: string;
  id: string;
  isInDefaultCollection: boolean;
  isReading: boolean | null;
  key: number;
  type: string;
  verseNumber: number | null;
};

export type QfAyahBookmark = {
  ayahNo: string;
  bookmarkId: string;
  createdAt: string;
  surahNo: number;
  verseNumber: number;
};

export type QfSessionSummary = {
  avatarUrl: string | null;
  collectionName: string;
  displayName: string | null;
  isAuthenticated: boolean;
};

export type QfProfile = {
  avatarUrl?: string;
  avatarUrls?: {
    large?: string;
    medium?: string;
    small?: string;
  };
  firstName?: string;
  lastName?: string;
  username?: string;
};

export type QfNoteAttachedEntity = {
  entityId: string;
  entityMetadata?: Record<string, unknown>;
  entityType: 'reflection';
};

export type QfSavedNote = {
  attachedEntities: QfNoteAttachedEntity[];
  body: string;
  createdAt: string | null;
  id: string;
  ranges: string[];
  updatedAt: string | null;
};
