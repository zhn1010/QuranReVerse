import { callStructuredOpenAI } from '@/lib/openai-client';
import {
  getLanguageCodeFromReflectionLanguageName,
  normalizeAyahNo,
  normalizeLanguageCode,
} from '@/lib/antidotes/language';
import {
  antidoteSystemPrompt,
  chatTitleSystemPrompt,
  curatorSystemPrompt,
  languageDetectionSystemPrompt,
  reflectionTranslationSystemPrompt,
  spiritualGuideSystemPrompt,
} from '@/lib/antidotes/prompts';
import { createSelectedReflection, serializeReflectionCandidates } from '@/lib/antidotes/reflections';
import {
  antidoteResponseSchema,
  chatTitleResponseSchema,
  curatorResponseSchema,
  languageDetectionResponseSchema,
  reflectionTranslationResponseSchema,
  spiritualGuideResponseSchema,
} from '@/lib/antidotes/schemas';
import type {
  AntidoteResponse,
  ChatTitleResponse,
  CuratedReflectionCandidate,
  CuratedReflectionResponse,
  Diagnosis,
  EnrichedAntidote,
  LanguageDetectionResponse,
  OpenAIAntidote,
  ReflectionGuide,
  ReflectionTranslationResponse,
  SelectedReflection,
  SpiritualGuideResponse,
} from '@/lib/antidotes/types';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';

export type AntidoteDebugLogger = (message: string, details: Record<string, unknown>) => void;

type StructuredOpenAICaller = typeof callStructuredOpenAI;

type RelatedReflectionsFetcher = typeof getRelatedReflectionsForAyah;

type WarnLogger = Pick<Console, 'warn'>;

type OpenAIServiceDeps = {
  debugLogger?: AntidoteDebugLogger;
  structuredOpenAICaller?: StructuredOpenAICaller;
  warnLogger?: WarnLogger;
};

type ReflectionServiceDeps = {
  relatedReflectionsFetcher?: RelatedReflectionsFetcher;
  warnLogger?: WarnLogger;
};

const FALLBACK_CHAT_TITLE = 'Reflection';

function noopDebugLogger() {
  // no-op
}

export function isLlmDebugEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.LLM_DEBUG === 'true';
}

export function createLlmDebugLogger({
  env = process.env,
  logger = console,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'log'>;
} = {}): AntidoteDebugLogger {
  return (message, details) => {
    if (!isLlmDebugEnabled(env)) {
      return;
    }

    logger.log('[llm-debug]', message, details);
  };
}

export function looksLikeTruncatedJsonError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('Unterminated string in JSON') ||
    message.includes('Unexpected end of JSON input')
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
      inputText: `User Input:\n\nEvent/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"\n\nTask:\nProvide only the most relevant Quranic grounding passages. Each suggestion must include the Surah name, Surah number, Ayah number, and a short spiritual reframing rationale.`,
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
      inputText: `Event/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"`,
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

export async function curateReflection(
  diagnosis: Diagnosis,
  candidates: CuratedReflectionCandidate[],
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
): Promise<SelectedReflection | null> {
  if (candidates.length === 0) {
    return null;
  }

  const serializedCandidates = serializeReflectionCandidates(candidates);
  const selection = await structuredOpenAICaller<CuratedReflectionResponse>(
    {
      inputText: `Part 1: The Spiritual Diagnosis

Spiritual Drift: ${diagnosis.spiritual_drift}

Materialistic Narrative: ${diagnosis.materialistic_narrative}

God-Centric Reframe: ${diagnosis.god_centric_reframe}

Part 2: Candidate Reflections
Below is a list of reflections fetched from the community. Each has an ID and the reflection text:
${serializedCandidates}

Task:
Analyze the candidate reflections against the diagnosis. Select the one reflection that best grounds the user and addresses their current drift.`,
      instructions: curatorSystemPrompt,
      maxOutputTokens: 180,
      schema: curatorResponseSchema,
      schemaName: 'curated_reflection_selection',
    },
    {
      debugLogger,
    },
  );

  return createSelectedReflection(selection, candidates);
}

export async function translateSelectedReflectionIfNeeded(
  selectedReflection: SelectedReflection | null,
  targetLanguageCode: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  if (!selectedReflection?.reflection) {
    debugLogger('reflection translation skipped: no selected reflection body', {
      hasSelectedReflection: Boolean(selectedReflection),
      targetLanguageCode,
    });
    return selectedReflection;
  }

  const sourceLanguageCode =
    selectedReflection.reflection_source_language_code ??
    getLanguageCodeFromReflectionLanguageName(selectedReflection.reflection.languageName);

  if (!sourceLanguageCode) {
    debugLogger('reflection translation skipped: unknown source language', {
      reflectionId: selectedReflection.reflection.id,
      reflectionLanguageName: selectedReflection.reflection.languageName,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: null,
    };
  }

  if (sourceLanguageCode === targetLanguageCode) {
    debugLogger('reflection translation skipped: source equals target', {
      reflectionId: selectedReflection.reflection.id,
      sourceLanguageCode,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: sourceLanguageCode,
    };
  }

  debugLogger('reflection translation started', {
    reflectionBodyLength: selectedReflection.reflection.body.length,
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
  });

  const translation = await structuredOpenAICaller<ReflectionTranslationResponse>(
    {
      inputText: `Target language code: ${targetLanguageCode}

Source language code: ${sourceLanguageCode}

Reflection text:
${selectedReflection.reflection.body}`,
      instructions: reflectionTranslationSystemPrompt,
      maxOutputTokens: 1200,
      schema: reflectionTranslationResponseSchema,
      schemaName: 'selected_reflection_translation',
    },
    {
      debugLogger,
    },
  );

  const translatedText = translation.translated_text.trim();
  const usedOriginalFallback = translatedText.length === 0;

  debugLogger('reflection translation completed', {
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
    translatedTextLength: translatedText.length,
    usedOriginalFallback,
  });

  return {
    ...selectedReflection,
    reflection_is_translated: true,
    reflection_source_language_code: sourceLanguageCode,
    reflection: {
      ...selectedReflection.reflection,
      body: translatedText || selectedReflection.reflection.body,
    },
  };
}

export async function buildReflectionGuide(
  {
    detectedLanguageCode,
    diagnosis,
    eventContent,
    selectedReflection,
    userFeeling,
  }: {
    detectedLanguageCode: string;
    diagnosis: Diagnosis;
    eventContent: string;
    selectedReflection: SelectedReflection | null;
    userFeeling: string;
  },
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
    warnLogger = console,
  }: OpenAIServiceDeps = {},
): Promise<ReflectionGuide | null> {
  if (!selectedReflection?.reflection) {
    return null;
  }

  const requestParams = {
    inputText: `Context for Synthesis:

The Event: ${eventContent}

User Feeling: ${userFeeling}

Diagnosis:
- Drift: ${diagnosis.spiritual_drift}
- Materialistic View: ${diagnosis.materialistic_narrative}
- God-centric Reframe: ${diagnosis.god_centric_reframe}

Output language: ${detectedLanguageCode}

The Chosen Reflection (for context only): ${selectedReflection.reflection.body}

Task:
Generate two pieces of text to wrap around the selected reflection.

intro_text: Validate the user's feeling about the event. Gently point out how the materialistic view is affecting their heart. Then naturally bridge into the chosen reflection by mentioning its core theme, the insight it carries—so the reader feels the reflection is a continuation of your words, not a separate block.

conclusion_text: Pick up where the reflection leaves off by echoing a specific phrase, keyword, or central metaphor from it to ensure a seamless transition. Using that insight as a bridge, reframe the user's original event—not through a list of actions, but by describing how this Quranic perspective transforms the 'heavy' weight of their situation into something 'purposeful' or 'light.' Close with a quiet, contemplative thought on how Allah’s Presence and Wisdom are uniquely manifesting in their specific situation right now.

Constraint: Do not reproduce the reflection text itself—only reference its themes. The intro should flow into the reflection and the conclusion should flow out of it, as one integrated reading experience. Only return the JSON.`,
    instructions: spiritualGuideSystemPrompt,
    schema: spiritualGuideResponseSchema,
    schemaName: 'spiritual_guide_wrapper',
  } as const;

  try {
    return await structuredOpenAICaller<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 900,
      },
      {
        debugLogger,
      },
    );
  } catch (error) {
    if (!looksLikeTruncatedJsonError(error)) {
      throw error;
    }

    warnLogger.warn('[spiritual-guide] retrying after likely truncated JSON', {
      detectedLanguageCode,
      message: error instanceof Error ? error.message : String(error),
    });

    return structuredOpenAICaller<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 1400,
      },
      {
        debugLogger,
      },
    );
  }
}

export async function generateChatTitle(
  {
    detectedLanguageCode,
    eventContent,
    userFeeling,
  }: {
    detectedLanguageCode: string;
    eventContent: string;
    userFeeling: string;
  },
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  const response = await structuredOpenAICaller<ChatTitleResponse>(
    {
      inputText: `Output language: ${detectedLanguageCode}

Event/Content: ${eventContent}

User Feeling: ${userFeeling}`,
      instructions: chatTitleSystemPrompt,
      maxOutputTokens: 40,
      schema: chatTitleResponseSchema,
      schemaName: 'chat_title',
    },
    {
      debugLogger,
    },
  );

  return response.title.trim() || FALLBACK_CHAT_TITLE;
}
