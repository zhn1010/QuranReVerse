import type { ChapterId } from '@quranjs/api';
import { NextResponse } from 'next/server';
import { getQuranClient, getVerseWithTranslation } from '@/lib/quran-client';
import {
  listAyahBookmarksInSakinahCollection,
  persistQfUserSession,
  QF_BOOKMARK_COLLECTION_NAME,
} from '@/lib/qf-user';

async function buildSurahNames(surahNumbers: number[]) {
  const client = getQuranClient();
  const uniqueSurahNumbers = [...new Set(surahNumbers)];
  const entries = await Promise.all(
    uniqueSurahNumbers.map(async (surahNo) => {
      try {
        const chapter = await client.chapters.findById(surahNo as ChapterId);
        return [
          surahNo,
          {
            arabic: chapter.nameArabic || '',
            english: chapter.translatedName?.name || chapter.nameSimple || `Surah ${surahNo}`,
          },
        ] as const;
      } catch {
        return [
          surahNo,
          {
            arabic: '',
            english: `Surah ${surahNo}`,
          },
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<number, { arabic: string; english: string }>;
}

export async function GET() {
  try {
    const result = await listAyahBookmarksInSakinahCollection();
    const surahNames = await buildSurahNames(result.bookmarks.map((bookmark) => bookmark.surahNo));

    const bookmarks = await Promise.all(
      result.bookmarks.map(async (bookmark) => {
        try {
          const enrichedAyah = await getVerseWithTranslation(
            bookmark.surahNo,
            bookmark.ayahNo,
            surahNames[bookmark.surahNo]?.english,
          );

          return {
            arabicText: enrichedAyah?.arabicText ?? '',
            ayahNo: bookmark.ayahNo,
            bookmarkId: bookmark.bookmarkId,
            createdAt: bookmark.createdAt,
            englishTranslation: enrichedAyah?.englishTranslation ?? '',
            surahArabicName: surahNames[bookmark.surahNo]?.arabic ?? '',
            surahName:
              enrichedAyah?.surahName ??
              surahNames[bookmark.surahNo]?.english ??
              `Surah ${bookmark.surahNo}`,
            surahNo: bookmark.surahNo,
            translationName: enrichedAyah?.translationName ?? 'English translation',
            verseKey: enrichedAyah?.verseKey ?? `${bookmark.surahNo}:${bookmark.ayahNo}`,
          };
        } catch {
          return {
            arabicText: '',
            ayahNo: bookmark.ayahNo,
            bookmarkId: bookmark.bookmarkId,
            createdAt: bookmark.createdAt,
            englishTranslation: '',
            surahArabicName: surahNames[bookmark.surahNo]?.arabic ?? '',
            surahName: surahNames[bookmark.surahNo]?.english ?? `Surah ${bookmark.surahNo}`,
            surahNo: bookmark.surahNo,
            translationName: 'English translation',
            verseKey: `${bookmark.surahNo}:${bookmark.ayahNo}`,
          };
        }
      }),
    );

    const response = NextResponse.json({
      bookmarks,
      collectionId: result.collection?.id ?? null,
      collectionName: result.collection?.name ?? QF_BOOKMARK_COLLECTION_NAME,
      success: true,
    });

    await persistQfUserSession(response, result.session);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes('connection expired') ||
      message.includes('connect your Quran Foundation')
    ) {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ error: message || 'Unexpected error' }, { status: 500 });
  }
}
