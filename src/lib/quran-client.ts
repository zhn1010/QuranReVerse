import {
  Language,
  QuranClient,
  type TranslationResource,
  type Verse,
  type VerseKey,
} from '@quranjs/api';

const QURAN_DEFAULT_AUTH_BASE_URL = 'https://oauth2.quran.foundation';

function getRequiredEnv(name: 'QURAN_CLIENT_ID' | 'QURAN_CLIENT_SECRET') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAuthBaseUrl() {
  return process.env.QURAN_ENDPOINT ?? QURAN_DEFAULT_AUTH_BASE_URL;
}

export function getQuranClient() {
  return new QuranClient({
    authBaseUrl: getAuthBaseUrl(),
    clientId: getRequiredEnv('QURAN_CLIENT_ID'),
    clientSecret: getRequiredEnv('QURAN_CLIENT_SECRET'),
    defaults: {
      language: Language.ENGLISH,
    },
  });
}

let preferredTranslationPromise: Promise<TranslationResource | undefined> | null = null;

async function getPreferredTranslationResource() {
  if (!preferredTranslationPromise) {
    preferredTranslationPromise = (async () => {
      const client = getQuranClient();
      const translations = await client.resources.findAllTranslations();
      const englishTranslations = translations.filter(
        (translation) => translation.languageName?.toLowerCase() === 'english',
      );

      const priorityMatchers = [/clear quran/i, /sahih international/i];

      for (const matcher of priorityMatchers) {
        const match = englishTranslations.find(
          (translation) =>
            matcher.test(translation.name ?? '') ||
            matcher.test(translation.authorName ?? '') ||
            matcher.test(translation.translatedName?.name ?? ''),
        );

        if (match) {
          return match;
        }
      }

      return englishTranslations[0];
    })();
  }

  return preferredTranslationPromise;
}

export type EnrichedAyah = {
  arabicText: string;
  ayahNo: string;
  englishTranslation: string;
  surahName: string;
  surahNo: number;
  translationName: string;
  verseKey: string;
};

type ParsedAyahSelection = {
  from: number;
  to: number;
};

function buildSurahName(verse: Verse) {
  const verseKey = verse.verseKey ?? '';
  const chapterId = Number(String(verseKey).split(':')[0] || 0);
  return Number.isInteger(chapterId) && chapterId > 0 ? `Surah ${chapterId}` : 'Surah';
}

function parseAyahSelection(ayahNo: string): ParsedAyahSelection | null {
  const normalized = ayahNo.trim();
  const match = /^(\d+)(?:-(\d+))?$/u.exec(normalized);

  if (!match) {
    return null;
  }

  const from = Number.parseInt(match[1], 10);
  const to = match[2] ? Number.parseInt(match[2], 10) : from;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return null;
  }

  return { from, to };
}

function getTranslationText(verse: Verse) {
  return verse.translations?.[0]?.text ?? '';
}

function getTranslationName(verse: Verse, fallback?: TranslationResource) {
  return (
    verse.translations?.[0]?.resourceName ??
    fallback?.name ??
    fallback?.translatedName?.name ??
    'English translation'
  );
}

export async function getVerseWithTranslation(
  surahNo: number,
  ayahNo: string,
  surahName?: string,
): Promise<EnrichedAyah | null> {
  const selection = parseAyahSelection(ayahNo);

  if (!selection) {
    return null;
  }

  const client = getQuranClient();
  const translation = await getPreferredTranslationResource();
  const translationId = translation?.id;

  const baseOptions = {
    fields: {
      textUthmani: true,
    },
    translations: translationId ? [translationId] : undefined,
  };

  if (selection.from === selection.to) {
    const verseKey = `${surahNo}:${selection.from}` as VerseKey;
    const verse = await client.verses.findByKey(verseKey, baseOptions);

    return {
      arabicText: verse.textUthmani ?? '',
      ayahNo,
      englishTranslation: getTranslationText(verse),
      surahName: surahName?.trim() || buildSurahName(verse),
      surahNo,
      translationName: getTranslationName(verse, translation),
      verseKey: verse.verseKey,
    };
  }

  const fromKey = `${surahNo}:${selection.from}` as VerseKey;
  const toKey = `${surahNo}:${selection.to}` as VerseKey;
  const verses = await client.verses.findByRange(fromKey, toKey, baseOptions);

  if (verses.length === 0) {
    return null;
  }

  const firstVerse = verses[0];

  return {
    arabicText: verses
      .map((verse) => verse.textUthmani ?? '')
      .filter(Boolean)
      .join('\n'),
    ayahNo,
    englishTranslation: verses
      .map((verse) => {
        const translationText = getTranslationText(verse);
        return translationText ? `${verse.verseKey} — ${translationText}` : '';
      })
      .filter(Boolean)
      .join('\n\n'),
    surahName: surahName?.trim() || buildSurahName(firstVerse),
    surahNo,
    translationName: getTranslationName(firstVerse, translation),
    verseKey: `${surahNo}:${selection.from}-${selection.to}`,
  };
}
