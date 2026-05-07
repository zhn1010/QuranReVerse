const DEFAULT_LANGUAGE_CODE = 'en';

const SUPPORTED_LANGUAGE_CODES = new Set([
  'aa',
  'am',
  'ar',
  'as',
  'az',
  'bg',
  'bm',
  'bn',
  'bs',
  'ce',
  'cs',
  'de',
  'dv',
  'en',
  'es',
  'fa',
  'fi',
  'fr',
  'gu',
  'ha',
  'he',
  'hi',
  'hr',
  'id',
  'it',
  'ja',
  'kk',
  'km',
  'kn',
  'ko',
  'ku',
  'ky',
  'lg',
  'ln',
  'lt',
  'mk',
  'ml',
  'mr',
  'ms',
  'ne',
  'nl',
  'no',
  'om',
  'pa',
  'pl',
  'ps',
  'pt',
  'rn',
  'ro',
  'ru',
  'rw',
  'sd',
  'si',
  'so',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'tl',
  'tr',
  'tt',
  'ug',
  'uk',
  'ur',
  'uz',
  'vi',
  'yo',
  'zh',
]);

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  arabic: 'ar',
  azeri: 'az',
  bengali: 'bn',
  bosnian: 'bs',
  chechen: 'ce',
  chinese: 'zh',
  croatian: 'hr',
  czech: 'cs',
  divehi: 'dv',
  dutch: 'nl',
  english: 'en',
  finnish: 'fi',
  french: 'fr',
  german: 'de',
  hebrew: 'he',
  hindi: 'hi',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  kurdish: 'ku',
  malay: 'ms',
  malayalam: 'ml',
  nepali: 'ne',
  norwegian: 'no',
  pashto: 'ps',
  persian: 'fa',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  sinhala: 'si',
  somali: 'so',
  spanish: 'es',
  swahili: 'sw',
  swedish: 'sv',
  tagalog: 'tl',
  tajik: 'tg',
  tamil: 'ta',
  telugu: 'te',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  urdu: 'ur',
  uzbek: 'uz',
  vietnamese: 'vi',
};

export function normalizeAyahNo(surahNo: number, ayahNo: string) {
  const normalized = ayahNo.trim();
  const exactMatch = new RegExp(`^${surahNo}:(\\d+(?:-\\d+)?)$`, 'u').exec(normalized);

  if (exactMatch) {
    return exactMatch[1];
  }

  return normalized;
}

export function normalizeLanguageCode(rawCode: string) {
  const normalized = rawCode.trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_LANGUAGE_CODE;
  }

  const base = normalized.split('-')[0] ?? normalized;

  if (SUPPORTED_LANGUAGE_CODES.has(base)) {
    return base;
  }

  return DEFAULT_LANGUAGE_CODE;
}

export function getLanguageCodeFromReflectionLanguageName(languageName: string | null) {
  if (!languageName) {
    return null;
  }

  const key = languageName.trim().toLowerCase();

  return LANGUAGE_NAME_TO_CODE[key] ?? null;
}
