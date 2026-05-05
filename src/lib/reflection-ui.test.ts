import { describe, expect, it } from 'vitest';
import {
  detectTextDirection,
  getDirectionFromLanguageCode,
  getTranslationIdForLanguageCode,
} from '@/lib/reflection-ui';

describe('getTranslationIdForLanguageCode', () => {
  it('uses the configured translation for supported language codes', () => {
    expect(getTranslationIdForLanguageCode('en')).toBe(85);
    expect(getTranslationIdForLanguageCode('TR')).toBe(210);
  });

  it('falls back to the default translation for unknown codes', () => {
    expect(getTranslationIdForLanguageCode('unknown')).toBe(20);
    expect(getTranslationIdForLanguageCode(null)).toBe(20);
  });
});

describe('getDirectionFromLanguageCode', () => {
  it('marks supported rtl languages correctly', () => {
    expect(getDirectionFromLanguageCode('ar')).toBe('rtl');
    expect(getDirectionFromLanguageCode('ur')).toBe('rtl');
  });

  it('defaults unsupported or empty language codes to ltr', () => {
    expect(getDirectionFromLanguageCode('en')).toBe('ltr');
    expect(getDirectionFromLanguageCode(undefined)).toBe('ltr');
  });
});

describe('detectTextDirection', () => {
  it('uses the fallback for empty text and latin-only text', () => {
    expect(detectTextDirection('', 'rtl')).toBe('rtl');
    expect(detectTextDirection('plain english text')).toBe('ltr');
  });

  it('detects rtl text when arabic script dominates', () => {
    expect(detectTextDirection('مرحبا')).toBe('rtl');
    expect(detectTextDirection('hello مرحبا')).toBe('rtl');
  });

  it('keeps ltr when arabic script is present but does not dominate', () => {
    expect(detectTextDirection('hello world مرح')).toBe('ltr');
  });
});
