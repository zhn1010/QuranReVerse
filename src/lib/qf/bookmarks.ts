import type { AyahSelection } from '@/lib/ayah';
import type { QfAyahBookmark, QfBookmark, QfCollection } from '@/lib/qf/types';

export function normalizeCollectionBookmark(raw: unknown): QfBookmark | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const verseNumber = typeof record.verseNumber === 'number' ? record.verseNumber : null;
  const nestedBookmarkType =
    typeof record.bookmarkType === 'object' && record.bookmarkType
      ? (record.bookmarkType as Record<string, unknown>).type
      : undefined;
  const nestedBookmarkGroup =
    typeof record.bookmarkGroup === 'object' && record.bookmarkGroup
      ? (record.bookmarkGroup as Record<string, unknown>).name
      : undefined;
  const bookmarkType =
    typeof record.type === 'string'
      ? record.type
      : typeof record.bookmarkType === 'string'
        ? record.bookmarkType
        : typeof nestedBookmarkType === 'string'
          ? nestedBookmarkType
          : verseNumber !== null
            ? 'ayah'
            : undefined;
  const bookmarkGroup =
    typeof record.group === 'string'
      ? record.group
      : typeof record.bookmarkGroup === 'string'
        ? record.bookmarkGroup
        : typeof nestedBookmarkGroup === 'string'
          ? nestedBookmarkGroup
          : '';

  if (typeof record.id !== 'string' || typeof record.createdAt !== 'string') {
    return null;
  }

  if (typeof bookmarkType !== 'string') {
    return null;
  }

  if (typeof record.key !== 'number') {
    return null;
  }

  const isInDefaultCollection =
    typeof record.isInDefaultCollection === 'boolean' ? record.isInDefaultCollection : false;
  const isReading = typeof record.isReading === 'boolean' ? record.isReading : null;

  return {
    createdAt: record.createdAt,
    group: bookmarkGroup,
    id: record.id,
    isInDefaultCollection,
    isReading,
    key: record.key,
    type: bookmarkType,
    verseNumber,
  };
}

export function pickPreferredVerseCollection(collections: QfCollection[], collectionName: string) {
  return collections
    .filter((collection) => collection.name === collectionName)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0];
}

export function buildBookmarkIdsByVerseNumber(
  bookmarks: QfBookmark[],
  surahNo: number,
  selection: AyahSelection,
) {
  const idsByVerseNumber: Record<number, string> = {};

  for (const bookmark of bookmarks) {
    if (bookmark.type !== 'ayah') {
      continue;
    }

    if (bookmark.key !== surahNo) {
      continue;
    }

    if (!bookmark.verseNumber) {
      continue;
    }

    if (bookmark.verseNumber < selection.from || bookmark.verseNumber > selection.to) {
      continue;
    }

    idsByVerseNumber[bookmark.verseNumber] = bookmark.id;
  }

  return idsByVerseNumber;
}

export function mapAyahBookmarks(bookmarks: QfBookmark[]): QfAyahBookmark[] {
  return bookmarks
    .filter(
      (bookmark): bookmark is QfBookmark & { verseNumber: number } =>
        bookmark.type === 'ayah' &&
        Number.isInteger(bookmark.key) &&
        Boolean(bookmark.verseNumber) &&
        (bookmark.verseNumber ?? 0) > 0,
    )
    .map((bookmark) => ({
      ayahNo: String(bookmark.verseNumber),
      bookmarkId: bookmark.id,
      createdAt: bookmark.createdAt,
      surahNo: bookmark.key,
      verseNumber: bookmark.verseNumber,
    }))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}
