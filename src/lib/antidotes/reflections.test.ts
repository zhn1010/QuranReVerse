import { describe, expect, it } from 'vitest';
import {
  buildReflectionCandidates,
  createSelectedReflection,
  serializeReflectionCandidates,
} from '@/lib/antidotes/reflections';
import type { CuratedReflectionCandidate, EnrichedAntidote } from '@/lib/antidotes/types';

const sampleReflection = {
  authorName: 'Amina',
  body: 'A grounded reflection.',
  commentsCount: 2,
  createdAt: '2025-01-01T00:00:00.000Z',
  id: 9,
  languageName: 'English',
  likesCount: 5,
  postTypeName: 'reflection',
  references: [{ chapterId: 2, from: 255, id: '2:255', to: 255 }],
};

describe('buildReflectionCandidates', () => {
  it('flattens related reflections and carries ayah metadata onto each candidate', () => {
    const antidotes: EnrichedAntidote[] = [
      {
        ayah_no: '255',
        reasoning: 'Remember who protects you.',
        related_reflections: [sampleReflection],
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ];

    expect(buildReflectionCandidates(antidotes)).toEqual([
      {
        ...sampleReflection,
        ayah_no: '255',
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ]);
  });
});

describe('serializeReflectionCandidates', () => {
  it('formats candidates exactly as the curator prompt expects', () => {
    const candidates: CuratedReflectionCandidate[] = [
      {
        ...sampleReflection,
        ayah_no: '255',
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ];

    expect(serializeReflectionCandidates(candidates)).toBe(
      '[ID: 9] [Ayah: 2:255] "A grounded reflection."',
    );
  });
});

describe('createSelectedReflection', () => {
  it('maps the selected candidate into the client response shape', () => {
    const candidates: CuratedReflectionCandidate[] = [
      {
        ...sampleReflection,
        ayah_no: '255',
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ];

    expect(
      createSelectedReflection(
        {
          selected_reflection_id: 9,
          selection_reason: 'Best fit.',
        },
        candidates,
      ),
    ).toEqual({
      ayah_no: '255',
      reflection: sampleReflection,
      reflection_is_translated: false,
      reflection_original_body: 'A grounded reflection.',
      reflection_source_language_code: 'en',
      selected_reflection_id: 9,
      selection_reason: 'Best fit.',
      surah_name: 'Al-Baqarah',
      surah_no: 2,
    });
  });

  it('preserves the selection id even when the candidate is missing', () => {
    expect(
      createSelectedReflection(
        {
          selected_reflection_id: 99,
          selection_reason: 'Missing.',
        },
        [],
      ),
    ).toEqual({
      ayah_no: '',
      reflection: null,
      reflection_is_translated: false,
      reflection_original_body: null,
      reflection_source_language_code: null,
      selected_reflection_id: 99,
      selection_reason: 'Missing.',
      surah_name: '',
      surah_no: 0,
    });
  });
});
