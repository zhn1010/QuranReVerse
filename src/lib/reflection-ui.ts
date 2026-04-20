import type { ReflectionReference, SelectedReflection } from '@/lib/antidote-types';

export type TextDirection = 'ltr' | 'rtl';

/** ISO 639-1 language code -> first Quran.com translation resource ID */
const TRANSLATION_BY_LANG: Record<string, number> = {
  aa: 854,
  am: 87,
  ar: 1014,
  as: 120,
  az: 75,
  bg: 237,
  bm: 795,
  bn: 161,
  bs: 214,
  ce: 106,
  cs: 26,
  de: 208,
  dv: 86,
  en: 85,
  es: 83,
  fa: 135,
  fi: 30,
  fr: 136,
  gu: 225,
  ha: 32,
  he: 233,
  hi: 122,
  hr: 997,
  id: 134,
  it: 153,
  ja: 35,
  kk: 222,
  km: 128,
  kn: 771,
  ko: 36,
  ku: 81,
  ky: 858,
  lg: 232,
  ln: 855,
  lt: 904,
  mk: 788,
  ml: 80,
  mr: 226,
  ms: 39,
  ne: 108,
  nl: 235,
  no: 41,
  om: 111,
  pa: 857,
  pl: 42,
  ps: 118,
  pt: 103,
  rn: 921,
  ro: 782,
  ru: 79,
  rw: 774,
  sd: 238,
  si: 228,
  so: 46,
  sq: 88,
  sr: 215,
  sv: 48,
  sw: 793,
  ta: 229,
  te: 227,
  tg: 139,
  th: 230,
  tl: 211,
  tr: 210,
  tt: 53,
  ug: 76,
  uk: 217,
  ur: 234,
  uz: 55,
  vi: 220,
  yo: 125,
  zh: 56,
};

const DEFAULT_TRANSLATION_ID = 20;
const RTL_SCRIPT_CHAR_REGEX = /[\u0590-\u08FF]/gu;
const LATIN_SCRIPT_CHAR_REGEX = /[A-Za-z]/g;
const RTL_LANG_CODES = new Set(['ar', 'fa', 'he', 'ps', 'sd', 'ug', 'ur']);

export function getTranslationIdForLanguageCode(languageCode: string | null | undefined): number {
  const normalizedCode = languageCode?.trim().toLowerCase();

  if (normalizedCode && TRANSLATION_BY_LANG[normalizedCode]) {
    return TRANSLATION_BY_LANG[normalizedCode];
  }

  return DEFAULT_TRANSLATION_ID;
}

export function getDirectionFromLanguageCode(
  languageCode: string | null | undefined,
): TextDirection {
  const code = languageCode?.trim().toLowerCase();

  if (code && RTL_LANG_CODES.has(code)) {
    return 'rtl';
  }

  return 'ltr';
}

export function detectTextDirection(
  text: string | null | undefined,
  fallbackDirection: TextDirection = 'ltr',
): TextDirection {
  if (!text || text.trim().length === 0) {
    return fallbackDirection;
  }

  const rtlMatches = text.match(RTL_SCRIPT_CHAR_REGEX);
  const latinMatches = text.match(LATIN_SCRIPT_CHAR_REGEX);
  const rtlCount = rtlMatches?.length ?? 0;
  const latinCount = latinMatches?.length ?? 0;

  if (rtlCount === 0) {
    return fallbackDirection;
  }

  if (latinCount === 0) {
    return 'rtl';
  }

  return rtlCount / (rtlCount + latinCount) >= 0.3 ? 'rtl' : 'ltr';
}

export function getDirectionStyles(direction: TextDirection) {
  return direction === 'rtl' ? 'text-right' : 'text-left';
}

export function buildQuranEmbedUrl(surahNo: number, ayahNo: string, translationId: number) {
  const verseRef = `${surahNo}:${ayahNo}`;
  const params = new URLSearchParams({
    answers: 'false',
    lessons: 'false',
    mergeVerses: 'true',
    mushaf: 'kfgqpc_v2',
    reflections: 'false',
    tafsir: 'false',
    translations: String(translationId),
    verses: verseRef,
  });

  return `https://quran.com/embed/v1?${params.toString()}`;
}

function formatReferenceAyah(reference: ReflectionReference) {
  if (reference.from < 1 || reference.to < 1) {
    return null;
  }

  return reference.from === reference.to
    ? `${reference.chapterId}:${reference.from}`
    : `${reference.chapterId}:${reference.from}-${reference.to}`;
}

export function getSelectedReflectionEmbeds(selectedReflection: SelectedReflection) {
  const references =
    selectedReflection.reflection?.references
      .map((reference) => ({
        label: formatReferenceAyah(reference),
        reference,
      }))
      .filter((item): item is { label: string; reference: ReflectionReference } => Boolean(item.label))
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.label === item.label) === index,
      ) ?? [];

  if (references.length > 0) {
    return references;
  }

  return [
    {
      label: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
      reference: {
        chapterId: selectedReflection.surah_no,
        from: Number.parseInt(selectedReflection.ayah_no.split('-')[0] ?? '0', 10),
        id: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
        to: Number.parseInt(
          selectedReflection.ayah_no.split('-')[1] ??
            selectedReflection.ayah_no.split('-')[0] ??
            '0',
          10,
        ),
      },
    },
  ];
}
