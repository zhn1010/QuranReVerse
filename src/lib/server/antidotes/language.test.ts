import { describe, expect, it } from 'vitest';
import {
  getLanguageCodeFromReflectionLanguageName,
  normalizeAyahNo,
  normalizeLanguageCode,
} from '@/lib/server/antidotes/language';

describe('normalizeAyahNo', () => {
  it('removes a matching surah prefix from the ayah reference', () => {
    expect(normalizeAyahNo(2, '2:255')).toBe('255');
    expect(normalizeAyahNo(18, '18:9-10')).toBe('9-10');
  });

  it('preserves trimmed values when they do not match the current surah prefix format', () => {
    expect(normalizeAyahNo(2, ' 255 ')).toBe('255');
    expect(normalizeAyahNo(2, '3:7')).toBe('3:7');
  });
});

describe('normalizeLanguageCode', () => {
  it('normalizes supported language codes and strips locale suffixes', () => {
    expect(normalizeLanguageCode('TR')).toBe('tr');
    expect(normalizeLanguageCode('ur-PK')).toBe('ur');
  });

  it('falls back to english for unknown or empty values', () => {
    expect(normalizeLanguageCode('')).toBe('en');
    expect(normalizeLanguageCode('unknown')).toBe('en');
  });
});

describe('getLanguageCodeFromReflectionLanguageName', () => {
  it('maps supported reflection language names to language codes', () => {
    expect(getLanguageCodeFromReflectionLanguageName('Turkish')).toBe('tr');
    expect(getLanguageCodeFromReflectionLanguageName(' english ')).toBe('en');
  });

  it('returns null for unknown or missing language names', () => {
    expect(getLanguageCodeFromReflectionLanguageName('Klingon')).toBeNull();
    expect(getLanguageCodeFromReflectionLanguageName(null)).toBeNull();
  });
});
