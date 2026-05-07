import { callStructuredOpenAI } from '@/lib/openai-client';
import { normalizeAyahNo, normalizeLanguageCode } from '@/lib/antidotes/language';
import {
  antidoteSystemPrompt,
  feelingInferenceInputGuardPrompt,
  feelingInferenceSystemPrompt,
  inputValidationSystemPrompt,
  languageDetectionSystemPrompt,
} from '@/lib/antidotes/prompts';
import {
  antidoteResponseSchema,
  feelingInferenceInputGuardResponseSchema,
  feelingInferenceResponseSchema,
  inputValidationResponseSchema,
  languageDetectionResponseSchema,
} from '@/lib/antidotes/schemas';
import type {
  AntidoteResponse,
  EnrichedAntidote,
  FeelingInferenceInputGuardResponse,
  FeelingInferenceResponse,
  InputValidationResponse,
  LanguageDetectionResponse,
  OpenAIAntidote,
} from '@/lib/antidotes/types';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';
import {
  looksLikeTruncatedJsonError,
  noopDebugLogger,
  type OpenAIServiceDeps,
  type ReflectionServiceDeps,
} from '@/lib/antidotes/service-shared';

function formatUserInputContext(eventText: string, feelingText: string) {
  const sections = [`Event/Content: "${eventText}"`];

  if (feelingText.trim().length > 0) {
    sections.push(`User Feeling: "${feelingText}"`);
  }

  return sections.join('\n\n');
}

export async function validateUserInput(
  eventText: string,
  feelingText: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  return structuredOpenAICaller<InputValidationResponse>(
    {
      inputText: formatUserInputContext(eventText, feelingText),
      instructions: inputValidationSystemPrompt,
      maxOutputTokens: 90,
      schema: inputValidationResponseSchema,
      schemaName: 'reflection_input_validation',
    },
    {
      debugLogger,
    },
  );
}

export async function validateFeelingInferenceInput(
  eventText: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  return structuredOpenAICaller<FeelingInferenceInputGuardResponse>(
    {
      inputText: `Event/Content: "${eventText}"`,
      instructions: feelingInferenceInputGuardPrompt,
      maxOutputTokens: 70,
      schema: feelingInferenceInputGuardResponseSchema,
      schemaName: 'feeling_inference_input_guard',
    },
    {
      debugLogger,
    },
  );
}

export async function inferUserFeeling(
  eventText: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
    warnLogger = console,
  }: OpenAIServiceDeps = {},
) {
  const requestParams = {
    inputText: `User message: "${eventText}"`,
    instructions: feelingInferenceSystemPrompt,
    schema: feelingInferenceResponseSchema,
    schemaName: 'feeling_inference',
  } as const;

  try {
    const response = await structuredOpenAICaller<FeelingInferenceResponse>(
      {
        ...requestParams,
        maxOutputTokens: 140,
      },
      {
        debugLogger,
      },
    );

    const inferredFeeling = response.inferred_feeling.trim();

    return inferredFeeling.length > 0 ? inferredFeeling : 'seeking clarity';
  } catch (error) {
    if (looksLikeTruncatedJsonError(error)) {
      warnLogger.warn('[feeling-inference] retrying after likely truncated JSON', {
        message: error instanceof Error ? error.message : String(error),
      });

      try {
        const retryResponse = await structuredOpenAICaller<FeelingInferenceResponse>(
          {
            ...requestParams,
            maxOutputTokens: 220,
          },
          {
            debugLogger,
          },
        );

        const retryFeeling = retryResponse.inferred_feeling.trim();

        return retryFeeling.length > 0 ? retryFeeling : 'seeking clarity';
      } catch (retryError) {
        warnLogger.warn('[feeling-inference] falling back after retry failure', {
          message: retryError instanceof Error ? retryError.message : String(retryError),
        });

        return 'seeking clarity';
      }
    }

    warnLogger.warn('[feeling-inference] falling back after inference failure', {
      message: error instanceof Error ? error.message : String(error),
    });

    return 'seeking clarity';
  }
}

export async function callAntidoteModel(
  eventText: string,
  feelingText: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  return structuredOpenAICaller<AntidoteResponse>(
    {
      inputText: `User Input:\n\n${formatUserInputContext(
        eventText,
        feelingText,
      )}\n\nTask:\nProvide only the most relevant Quranic grounding passages. Each suggestion must include the Surah name, Surah number, Ayah number, and a short spiritual reframing rationale.`,
      instructions: antidoteSystemPrompt,
      maxOutputTokens: 350,
      schema: antidoteResponseSchema,
      schemaName: 'quranic_antidotes',
    },
    {
      debugLogger,
    },
  );
}

export async function detectInputLanguage(
  eventText: string,
  feelingText: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  const response = await structuredOpenAICaller<LanguageDetectionResponse>(
    {
      inputText: formatUserInputContext(eventText, feelingText),
      instructions: languageDetectionSystemPrompt,
      maxOutputTokens: 40,
      schema: languageDetectionResponseSchema,
      schemaName: 'input_language_detection',
    },
    {
      debugLogger,
    },
  );

  return normalizeLanguageCode(response.language_code);
}

export async function enrichAntidotes(
  antidotes: OpenAIAntidote[],
  {
    relatedReflectionsFetcher = getRelatedReflectionsForAyah,
    warnLogger = console,
  }: ReflectionServiceDeps = {},
) {
  return Promise.all(
    antidotes.map(async (antidote): Promise<EnrichedAntidote> => {
      const normalizedAyahNo = normalizeAyahNo(antidote.surah_no, antidote.ayah_no);
      let relatedReflections: RelatedReflection[] = [];

      try {
        relatedReflections = await relatedReflectionsFetcher(antidote.surah_no, normalizedAyahNo);
      } catch (error) {
        warnLogger.warn('[quran-reflect] failed to fetch related reflections', {
          ayahNo: normalizedAyahNo,
          message: error instanceof Error ? error.message : 'Unknown error',
          surahNo: antidote.surah_no,
        });
      }

      return {
        ...antidote,
        ayah_no: normalizedAyahNo,
        related_reflections: relatedReflections,
      };
    }),
  );
}
