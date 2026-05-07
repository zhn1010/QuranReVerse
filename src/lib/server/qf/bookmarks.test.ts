import { describe, expect, it } from 'vitest';
import {
  buildBookmarkIdsByVerseNumber,
  mapAyahBookmarks,
  normalizeCollectionBookmark,
  pickPreferredVerseCollection,
} from '@/lib/server/qf/bookmarks';

describe('normalizeCollectionBookmark', () => {
  it('normalizes nested bookmark types and groups', () => {
    expect(
      normalizeCollectionBookmark({
        bookmarkGroup: { name: 'Favorites' },
        bookmarkType: { type: 'ayah' },
        createdAt: '2026-05-05T12:00:00.000Z',
        id: 'bookmark-1',
        isInDefaultCollection: true,
        isReading: false,
        key: 2,
        verseNumber: 255,
      }),
    ).toEqual({
      createdAt: '2026-05-05T12:00:00.000Z',
      group: 'Favorites',
      id: 'bookmark-1',
      isInDefaultCollection: true,
      isReading: false,
      key: 2,
      type: 'ayah',
      verseNumber: 255,
    });
  });

  it('infers ayah type from verseNumber when explicit type is absent', () => {
    expect(
      normalizeCollectionBookmark({
        createdAt: '2026-05-05T12:00:00.000Z',
        id: 'bookmark-2',
        key: 36,
        verseNumber: 1,
      })?.type,
    ).toBe('ayah');
  });

  it('rejects malformed bookmarks', () => {
    expect(normalizeCollectionBookmark(null)).toBeNull();
    expect(normalizeCollectionBookmark({ id: 'x', key: '2' })).toBeNull();
  });
});

describe('pickPreferredVerseCollection', () => {
  it('returns the most recently updated collection with the preferred name', () => {
    expect(
      pickPreferredVerseCollection(
        [
          { id: '1', name: 'Sakinah.now', updatedAt: '2026-05-01T00:00:00.000Z' },
          { id: '2', name: 'Other', updatedAt: '2026-05-03T00:00:00.000Z' },
          { id: '3', name: 'Sakinah.now', updatedAt: '2026-05-05T00:00:00.000Z' },
        ],
        'Sakinah.now',
      )?.id,
    ).toBe('3');
  });
});

describe('buildBookmarkIdsByVerseNumber', () => {
  it('returns only matching ayah bookmark ids for the selected surah/range', () => {
    expect(
      buildBookmarkIdsByVerseNumber(
        [
          {
            createdAt: '2026-05-05T12:00:00.000Z',
            group: '',
            id: 'a',
            isInDefaultCollection: false,
            isReading: null,
            key: 2,
            type: 'ayah',
            verseNumber: 255,
          },
          {
            createdAt: '2026-05-05T12:00:00.000Z',
            group: '',
            id: 'b',
            isInDefaultCollection: false,
            isReading: null,
            key: 2,
            type: 'ayah',
            verseNumber: 256,
          },
          {
            createdAt: '2026-05-05T12:00:00.000Z',
            group: '',
            id: 'c',
            isInDefaultCollection: false,
            isReading: null,
            key: 3,
            type: 'ayah',
            verseNumber: 255,
          },
        ],
        2,
        { from: 255, to: 255 },
      ),
    ).toEqual({ 255: 'a' });
  });
});

describe('mapAyahBookmarks', () => {
  it('maps and sorts ayah bookmarks for the sidebar collection response', () => {
    expect(
      mapAyahBookmarks([
        {
          createdAt: '2026-05-01T12:00:00.000Z',
          group: '',
          id: 'older',
          isInDefaultCollection: false,
          isReading: null,
          key: 1,
          type: 'ayah',
          verseNumber: 1,
        },
        {
          createdAt: '2026-05-05T12:00:00.000Z',
          group: '',
          id: 'newer',
          isInDefaultCollection: false,
          isReading: null,
          key: 2,
          type: 'ayah',
          verseNumber: 255,
        },
      ]),
    ).toEqual([
      {
        ayahNo: '255',
        bookmarkId: 'newer',
        createdAt: '2026-05-05T12:00:00.000Z',
        surahNo: 2,
        verseNumber: 255,
      },
      {
        ayahNo: '1',
        bookmarkId: 'older',
        createdAt: '2026-05-01T12:00:00.000Z',
        surahNo: 1,
        verseNumber: 1,
      },
    ]);
  });
});
