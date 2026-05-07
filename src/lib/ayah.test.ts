import { describe, expect, it } from 'vitest';
import {
  buildNoteRangesFromSelectedReflection,
  getSelectedReflectionEmbeds,
  parseAyahSelection,
} from '@/lib/ayah';

describe('parseAyahSelection', () => {
  it('parses a single ayah number', () => {
    expect(parseAyahSelection('7')).toEqual({ from: 7, to: 7 });
  });

  it('parses an ayah range', () => {
    expect(parseAyahSelection('2-5')).toEqual({ from: 2, to: 5 });
  });

  it('rejects invalid ranges and malformed values', () => {
    expect(parseAyahSelection('0')).toBeNull();
    expect(parseAyahSelection('5-2')).toBeNull();
    expect(parseAyahSelection('2:5')).toBeNull();
    expect(parseAyahSelection('')).toBeNull();
  });
});

describe('getSelectedReflectionEmbeds', () => {
  it('deduplicates explicit reflection references', () => {
    expect(
      getSelectedReflectionEmbeds({
        ayah_no: '15',
        reflection: {
          references: [
            { chapterId: 2, from: 255, id: 'a', to: 255 },
            { chapterId: 2, from: 255, id: 'b', to: 255 },
            { chapterId: 2, from: 256, id: 'c', to: 257 },
          ],
        },
        surah_no: 2,
      }),
    ).toEqual([
      {
        label: '2:255',
        reference: { chapterId: 2, from: 255, id: 'a', to: 255 },
      },
      {
        label: '2:256-257',
        reference: { chapterId: 2, from: 256, id: 'c', to: 257 },
      },
    ]);
  });

  it('falls back to the selected ayah when no explicit references exist', () => {
    expect(
      getSelectedReflectionEmbeds({
        ayah_no: '10-12',
        reflection: { references: [] },
        surah_no: 18,
      }),
    ).toEqual([
      {
        label: '18:10-12',
        reference: { chapterId: 18, from: 10, id: '18:10-12', to: 12 },
      },
    ]);
  });

  it('returns an empty list when the fallback ayah selection is invalid', () => {
    expect(
      getSelectedReflectionEmbeds({
        ayah_no: 'invalid',
        reflection: null,
        surah_no: 18,
      }),
    ).toEqual([]);
  });
});

describe('buildNoteRangesFromSelectedReflection', () => {
  it('builds note ranges from explicit references', () => {
    expect(
      buildNoteRangesFromSelectedReflection({
        ayah_no: '1',
        reflection: {
          references: [
            { chapterId: 36, from: 1, id: 'x', to: 3 },
            { chapterId: 36, from: 1, id: 'y', to: 3 },
            { chapterId: 36, from: 4, id: 'z', to: 4 },
          ],
        },
        surah_no: 36,
      }),
    ).toEqual(['36:1-36:3', '36:4-36:4']);
  });

  it('falls back to the selected ayah range when references are missing', () => {
    expect(
      buildNoteRangesFromSelectedReflection({
        ayah_no: '7-9',
        reflection: null,
        surah_no: 55,
      }),
    ).toEqual(['55:7-55:9']);
  });

  it('returns an empty list for null or invalid input', () => {
    expect(buildNoteRangesFromSelectedReflection(null)).toEqual([]);
    expect(
      buildNoteRangesFromSelectedReflection({
        ayah_no: 'bad',
        reflection: null,
        surah_no: 1,
      }),
    ).toEqual([]);
  });
});
