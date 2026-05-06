import { describe, expect, it, vi } from 'vitest';
import {
  buildReflectionGuide,
  callAntidoteModel,
  createLlmDebugLogger,
  curateReflection,
  detectInputLanguage,
  enrichAntidotes,
  generateChatTitle,
  looksLikeTruncatedJsonError,
  translateSelectedReflectionIfNeeded,
  validateUserInput,
} from '@/lib/antidotes/service';
import type { CuratedReflectionCandidate, Diagnosis, SelectedReflection } from '@/lib/antidotes/types';

const sampleDiagnosis: Diagnosis = {
  god_centric_reframe: 'Allah is enough.',
  materialistic_narrative: 'I only have security if I control the outcome.',
  spiritual_drift: 'Fear of loss',
};

const sampleCandidate: CuratedReflectionCandidate = {
  authorName: 'Amina',
  ayah_no: '255',
  body: 'A grounded reflection.',
  commentsCount: 2,
  createdAt: '2025-01-01T00:00:00.000Z',
  id: 9,
  languageName: 'English',
  likesCount: 5,
  postTypeName: 'reflection',
  references: [{ chapterId: 2, from: 255, id: '2:255', to: 255 }],
  surah_name: 'Al-Baqarah',
  surah_no: 2,
};

const sampleSelectedReflection: SelectedReflection = {
  ayah_no: '255',
  reflection: {
    authorName: 'Amina',
    body: 'A grounded reflection.',
    commentsCount: 2,
    createdAt: '2025-01-01T00:00:00.000Z',
    id: 9,
    languageName: 'English',
    likesCount: 5,
    postTypeName: 'reflection',
    references: [{ chapterId: 2, from: 255, id: '2:255', to: 255 }],
  },
  reflection_is_translated: false,
  reflection_original_body: 'A grounded reflection.',
  reflection_source_language_code: 'en',
  selected_reflection_id: 9,
  selection_reason: 'Best fit.',
  surah_name: 'Al-Baqarah',
  surah_no: 2,
};

function createStructuredOpenAIMock() {
  return vi.fn(async (...args: [unknown, unknown?]) => {
    void args;
    return {};
  });
}

function createStructuredOpenAIResultMock<T>(result: T) {
  return vi.fn(async (...args: [unknown, unknown?]) => {
    void args;
    return result;
  });
}

function toStructuredOpenAICaller(mock: ReturnType<typeof createStructuredOpenAIMock>) {
  return mock as unknown as typeof import('@/lib/openai-client').callStructuredOpenAI;
}

describe('createLlmDebugLogger', () => {
  it('logs only when LLM_DEBUG is enabled', () => {
    const logger = { log: vi.fn() };

    createLlmDebugLogger({
      env: { LLM_DEBUG: 'false', NODE_ENV: 'test' } as NodeJS.ProcessEnv,
      logger,
    })('hidden', { ok: false });
    createLlmDebugLogger({
      env: { LLM_DEBUG: 'true', NODE_ENV: 'test' } as NodeJS.ProcessEnv,
      logger,
    })('shown', { ok: true });

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith('[llm-debug]', 'shown', { ok: true });
  });
});

describe('looksLikeTruncatedJsonError', () => {
  it('recognizes truncated JSON parsing failures', () => {
    expect(looksLikeTruncatedJsonError(new Error('Unexpected end of JSON input'))).toBe(true);
    expect(looksLikeTruncatedJsonError(new Error('Unterminated string in JSON'))).toBe(true);
    expect(looksLikeTruncatedJsonError(new Error('Different failure'))).toBe(false);
  });
});

describe('callAntidoteModel', () => {
  it('delegates to the structured OpenAI caller with the antidote schema contract', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      antidotes: [],
      diagnosis: sampleDiagnosis,
    });

    await callAntidoteModel('event', 'feeling', {
      structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
    });

    expect(structuredOpenAICallerMock).toHaveBeenCalledTimes(1);
    expect(structuredOpenAICallerMock.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 350,
      schemaName: 'quranic_antidotes',
    });
  });
});

describe('detectInputLanguage', () => {
  it('normalizes the detected language code before returning it', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      language_code: 'TR-tr',
    });

    await expect(
      detectInputLanguage('event', 'feeling', {
        structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
      }),
    ).resolves.toBe('tr');
  });
});

describe('validateUserInput', () => {
  it('delegates to the structured OpenAI caller with a compact validation schema', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      decision: 'valid',
      reason_code: 'meaningful',
      reply_message: '',
    });

    await validateUserInput('event', '', {
      structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
    });

    expect(structuredOpenAICallerMock).toHaveBeenCalledTimes(1);
    expect(structuredOpenAICallerMock.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 90,
      schemaName: 'reflection_input_validation',
    });
  });
});

describe('enrichAntidotes', () => {
  it('normalizes ayah numbers and attaches fetched reflections', async () => {
    const relatedReflectionsFetcher = vi.fn(async () => [sampleCandidate]);

    await expect(
      enrichAntidotes(
        [
          {
            ayah_no: '2:255',
            reasoning: 'Grounding.',
            surah_name: 'Al-Baqarah',
            surah_no: 2,
          },
        ],
        { relatedReflectionsFetcher },
      ),
    ).resolves.toEqual([
      {
        ayah_no: '255',
        reasoning: 'Grounding.',
        related_reflections: [sampleCandidate],
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ]);
  });

  it('falls back to an empty reflection list when fetch fails', async () => {
    const relatedReflectionsFetcher = vi.fn(async () => {
      throw new Error('boom');
    });
    const warnLogger = { warn: vi.fn() };

    await expect(
      enrichAntidotes(
        [
          {
            ayah_no: '255',
            reasoning: 'Grounding.',
            surah_name: 'Al-Baqarah',
            surah_no: 2,
          },
        ],
        { relatedReflectionsFetcher, warnLogger },
      ),
    ).resolves.toEqual([
      {
        ayah_no: '255',
        reasoning: 'Grounding.',
        related_reflections: [],
        surah_name: 'Al-Baqarah',
        surah_no: 2,
      },
    ]);
    expect(warnLogger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('curateReflection', () => {
  it('returns null when there are no candidates', async () => {
    expect(await curateReflection(sampleDiagnosis, [])).toBeNull();
  });

  it('maps the selected candidate into the shared selected reflection shape', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      selected_reflection_id: 9,
      selection_reason: 'Best fit.',
    });

    await expect(
      curateReflection(sampleDiagnosis, [sampleCandidate], {
        structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
      }),
    ).resolves.toEqual(sampleSelectedReflection);
  });
});

describe('translateSelectedReflectionIfNeeded', () => {
  it('skips when no reflection is available', async () => {
    expect(await translateSelectedReflectionIfNeeded(null, 'tr')).toBeNull();
  });

  it('skips translation when the source language matches the target', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIMock();

    await expect(
      translateSelectedReflectionIfNeeded(sampleSelectedReflection, 'en', {
        structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
      }),
    ).resolves.toEqual(sampleSelectedReflection);

    expect(structuredOpenAICallerMock).not.toHaveBeenCalled();
  });

  it('records the source language as unknown when the reflection language cannot be inferred', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIMock();

    await expect(
      translateSelectedReflectionIfNeeded(
        {
          ...sampleSelectedReflection,
          reflection: {
            ...sampleSelectedReflection.reflection!,
            languageName: 'Klingon',
          },
          reflection_source_language_code: null,
        },
        'tr',
        {
          structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
        },
      ),
    ).resolves.toEqual({
      ...sampleSelectedReflection,
      reflection: {
        ...sampleSelectedReflection.reflection!,
        languageName: 'Klingon',
      },
      reflection_source_language_code: null,
    });

    expect(structuredOpenAICallerMock).not.toHaveBeenCalled();
  });

  it('translates when the source and target languages differ', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      translated_text: 'Yansima.',
    });

    await expect(
      translateSelectedReflectionIfNeeded(sampleSelectedReflection, 'tr', {
        structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
      }),
    ).resolves.toEqual({
      ...sampleSelectedReflection,
      reflection: {
        ...sampleSelectedReflection.reflection!,
        body: 'Yansima.',
      },
      reflection_is_translated: true,
      reflection_source_language_code: 'en',
    });
  });

  it('falls back to the original reflection body when the translation is blank', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      translated_text: '   ',
    });

    await expect(
      translateSelectedReflectionIfNeeded(sampleSelectedReflection, 'tr', {
        structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
      }),
    ).resolves.toEqual({
      ...sampleSelectedReflection,
      reflection: sampleSelectedReflection.reflection,
      reflection_is_translated: true,
      reflection_source_language_code: 'en',
    });
  });
});

describe('buildReflectionGuide', () => {
  it('returns null when no selected reflection exists', async () => {
    expect(
      await buildReflectionGuide({
        detectedLanguageCode: 'en',
        diagnosis: sampleDiagnosis,
        eventContent: 'event',
        selectedReflection: null,
        userFeeling: 'feeling',
      }),
    ).toBeNull();
  });

  it('retries with a larger token budget when the first response looks truncated', async () => {
    const structuredOpenAICallerMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unexpected end of JSON input'))
      .mockResolvedValueOnce({
        conclusion_text: 'Steady.',
        intro_text: 'Breathe.',
      });
    const warnLogger = { warn: vi.fn() };

    await expect(
      buildReflectionGuide(
        {
          detectedLanguageCode: 'en',
          diagnosis: sampleDiagnosis,
          eventContent: 'event',
          selectedReflection: sampleSelectedReflection,
          userFeeling: 'feeling',
        },
        {
          structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
          warnLogger,
        },
      ),
    ).resolves.toEqual({
      conclusion_text: 'Steady.',
      intro_text: 'Breathe.',
    });

    expect(structuredOpenAICallerMock).toHaveBeenCalledTimes(2);
    expect(structuredOpenAICallerMock.mock.calls[0]?.[0]).toMatchObject({ maxOutputTokens: 900 });
    expect(structuredOpenAICallerMock.mock.calls[1]?.[0]).toMatchObject({ maxOutputTokens: 1400 });
    expect(warnLogger.warn).toHaveBeenCalledTimes(1);
  });
});

describe('generateChatTitle', () => {
  it('falls back to the default title when the model returns blank text', async () => {
    const structuredOpenAICallerMock = createStructuredOpenAIResultMock({
      title: '   ',
    });

    await expect(
      generateChatTitle(
        {
          detectedLanguageCode: 'en',
          eventContent: 'event',
          userFeeling: 'feeling',
        },
        {
          structuredOpenAICaller: toStructuredOpenAICaller(structuredOpenAICallerMock),
        },
      ),
    ).resolves.toBe('Reflection');
  });
});
