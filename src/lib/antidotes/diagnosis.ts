import { callStructuredOpenAI } from '@/lib/openai-client';
import {
  normalizeAyahNo,
  normalizeLanguageCode,
} from '@/lib/antidotes/language';
import {
  antidoteSystemPrompt,
  inputValidationSystemPrompt,
  languageDetectionSystemPrompt,
} from '@/lib/antidotes/prompts';
import {
  antidoteResponseSchema,
  inputValidationResponseSchema,
  languageDetectionResponseSchema,
} from '@/lib/antidotes/schemas';
import type {
  AntidoteResponse,
  EnrichedAntidote,
  InputValidationResponse,
  LanguageDetectionResponse,
  OpenAIAntidote,
} from '@/lib/antidotes/types';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';
import {
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
