import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createPipelineStep, toJsonLine } from '@/lib/antidotes/events';
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
import {
  buildReflectionCandidates,
  createSelectedReflection,
  serializeReflectionCandidates,
} from '@/lib/antidotes/reflections';
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
  PipelineEvent,
  PipelineResultEvent,
  ReflectionGuide,
  ReflectionTranslationResponse,
  SelectedReflection,
  SpiritualGuideResponse,
} from '@/lib/antidotes/types';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';
import { getSession } from '@/lib/session';
import { callStructuredOpenAI } from '@/lib/openai-client';

// Initialize Redis client for rate limiting (uses same KV env vars)
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function readDailyLimitFromEnv(key: string, fallback: number) {
  const raw = process.env[key]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

const ANONYMOUS_DAILY_LIMIT = readDailyLimitFromEnv('ANONYMOUS_DAILY_LIMIT', 4);
const AUTHENTICATED_DAILY_LIMIT = readDailyLimitFromEnv('AUTHENTICATED_DAILY_LIMIT', 10);

async function checkRateLimit(
  request: Request,
): Promise<{ allowed: true } | { allowed: false; reason: string; limit: number }> {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.data?.quranFoundationId);
  const userId = session?.data?.quranFoundationId;

  // Get today's date string for the key
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (isAuthenticated && userId) {
    if (AUTHENTICATED_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    const key = `rate_limit:user:${userId}:${today}`;
    const current = await redis.incr(key);

    // Set expiry on first request of the day
    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24); // 24 hours
    }

    if (current > AUTHENTICATED_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: AUTHENTICATED_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${AUTHENTICATED_DAILY_LIMIT} reflections. Please try again tomorrow.`,
      };
    }
  } else {
    if (ANONYMOUS_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    // Anonymous user - use browser fingerprint for more reliable tracking
    const fingerprint =
      request.headers.get('x-browser-fingerprint') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const key = `rate_limit:fingerprint:${fingerprint}:${today}`;
    const current = await redis.incr(key);

    // Set expiry on first request of the day
    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24); // 24 hours
    }

    if (current > ANONYMOUS_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: ANONYMOUS_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${ANONYMOUS_DAILY_LIMIT} reflections. Sign in with Quran Foundation for ${AUTHENTICATED_DAILY_LIMIT} reflections per day.`,
      };
    }
  }

  return { allowed: true };
}
function isLlmDebugEnabled() {
  return process.env.LLM_DEBUG === 'true';
}

function logLlmDebug(message: string, details: Record<string, unknown>) {
  if (!isLlmDebugEnabled()) {
    return;
  }

  console.log('[llm-debug]', message, details);
}

async function callAntidoteModel(eventText: string, feelingText: string) {
  return callStructuredOpenAI<AntidoteResponse>(
    {
      inputText: `User Input:\n\nEvent/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"\n\nTask:\nProvide only the most relevant Quranic grounding passages. Each suggestion must include the Surah name, Surah number, Ayah number, and a short spiritual reframing rationale.`,
      instructions: antidoteSystemPrompt,
      maxOutputTokens: 350,
      schema: antidoteResponseSchema,
      schemaName: 'quranic_antidotes',
    },
    {
      debugLogger: logLlmDebug,
    },
  );
}

async function detectInputLanguage(eventText: string, feelingText: string) {
  const response = await callStructuredOpenAI<LanguageDetectionResponse>(
    {
      inputText: `Event/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"`,
      instructions: languageDetectionSystemPrompt,
      maxOutputTokens: 40,
      schema: languageDetectionResponseSchema,
      schemaName: 'input_language_detection',
    },
    {
      debugLogger: logLlmDebug,
    },
  );

  return normalizeLanguageCode(response.language_code);
}

async function enrichAntidotes(antidotes: OpenAIAntidote[]) {
  return Promise.all(
    antidotes.map(async (antidote): Promise<EnrichedAntidote> => {
      const normalizedAyahNo = normalizeAyahNo(antidote.surah_no, antidote.ayah_no);
      let relatedReflections: RelatedReflection[] = [];

      try {
        relatedReflections = await getRelatedReflectionsForAyah(
          antidote.surah_no,
          normalizedAyahNo,
        );
      } catch (error) {
        console.warn('[quran-reflect] failed to fetch related reflections', {
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

async function curateReflection(
  diagnosis: Diagnosis,
  candidates: CuratedReflectionCandidate[],
): Promise<SelectedReflection | null> {
  if (candidates.length === 0) {
    return null;
  }

  const serializedCandidates = serializeReflectionCandidates(candidates);

  const selection = await callStructuredOpenAI<CuratedReflectionResponse>(
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
      debugLogger: logLlmDebug,
    },
  );

  return createSelectedReflection(selection, candidates);
}

async function translateSelectedReflectionIfNeeded(
  selectedReflection: SelectedReflection | null,
  targetLanguageCode: string,
) {
  if (!selectedReflection?.reflection) {
    logLlmDebug('reflection translation skipped: no selected reflection body', {
      hasSelectedReflection: Boolean(selectedReflection),
      targetLanguageCode,
    });
    return selectedReflection;
  }

  const sourceLanguageCode =
    selectedReflection.reflection_source_language_code ??
    getLanguageCodeFromReflectionLanguageName(selectedReflection.reflection.languageName);

  if (!sourceLanguageCode) {
    logLlmDebug('reflection translation skipped: unknown source language', {
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
    logLlmDebug('reflection translation skipped: source equals target', {
      reflectionId: selectedReflection.reflection.id,
      sourceLanguageCode,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: sourceLanguageCode,
    };
  }

  logLlmDebug('reflection translation started', {
    reflectionBodyLength: selectedReflection.reflection.body.length,
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
  });

  const translation = await callStructuredOpenAI<ReflectionTranslationResponse>(
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
      debugLogger: logLlmDebug,
    },
  );

  const translatedText = translation.translated_text.trim();
  const usedOriginalFallback = translatedText.length === 0;

  logLlmDebug('reflection translation completed', {
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

async function buildReflectionGuide({
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
}): Promise<ReflectionGuide | null> {
  if (!selectedReflection?.reflection) {
    return null;
  }

  const inputText = `Context for Synthesis:

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

Constraint: Do not reproduce the reflection text itself—only reference its themes. The intro should flow into the reflection and the conclusion should flow out of it, as one integrated reading experience. Only return the JSON.`;
  const requestParams = {
    inputText,
    instructions: spiritualGuideSystemPrompt,
    schema: spiritualGuideResponseSchema,
    schemaName: 'spiritual_guide_wrapper',
  } as const;

  try {
    return await callStructuredOpenAI<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 900,
      },
      {
        debugLogger: logLlmDebug,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeTruncatedJson =
      message.includes('Unterminated string in JSON') ||
      message.includes('Unexpected end of JSON input');

    if (!looksLikeTruncatedJson) {
      throw error;
    }

    console.warn('[spiritual-guide] retrying after likely truncated JSON', {
      detectedLanguageCode,
      message,
    });

    return callStructuredOpenAI<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 1400,
      },
      {
        debugLogger: logLlmDebug,
      },
    );
  }
}

async function generateChatTitle({
  detectedLanguageCode,
  eventContent,
  userFeeling,
}: {
  detectedLanguageCode: string;
  eventContent: string;
  userFeeling: string;
}) {
  const response = await callStructuredOpenAI<ChatTitleResponse>(
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
      debugLogger: logLlmDebug,
    },
  );

  return response.title.trim() || 'Reflection';
}

export async function POST(request: Request) {
  // Check rate limit first
  const rateLimitCheck = await checkRateLimit(request);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.reason }, { status: 429 });
  }

  let body: {
    eventContent?: string;
    userFeeling?: string;
  };

  try {
    body = (await request.json()) as {
      eventContent?: string;
      userFeeling?: string;
    };
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid JSON body.',
      },
      { status: 400 },
    );
  }

  const eventContent = body.eventContent?.trim();
  const userFeeling = body.userFeeling?.trim();

  if (!eventContent || !userFeeling) {
    return NextResponse.json(
      { error: 'Both eventContent and userFeeling are required.' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(toJsonLine(event)));
      };

      try {
        send(createPipelineStep('language_detection', 'in_progress'));
        const detectedLanguageCode = await detectInputLanguage(eventContent, userFeeling);
        send(createPipelineStep('language_detection', 'completed'));

        send(createPipelineStep('ayah_selection', 'in_progress'));
        const response = await callAntidoteModel(eventContent, userFeeling);
        send(createPipelineStep('ayah_selection', 'completed'));

        send(createPipelineStep('reflection_fetch', 'in_progress'));
        const enrichedAntidotes = await enrichAntidotes(response.antidotes);
        send(createPipelineStep('reflection_fetch', 'completed'));

        send(createPipelineStep('reflection_curation', 'in_progress'));
        const selectedReflection = await curateReflection(
          response.diagnosis,
          buildReflectionCandidates(enrichedAntidotes),
        );
        send(createPipelineStep('reflection_curation', 'completed'));

        send(createPipelineStep('reflection_translation', 'in_progress'));
        let localizedSelectedReflection = selectedReflection;
        try {
          localizedSelectedReflection = await translateSelectedReflectionIfNeeded(
            selectedReflection,
            detectedLanguageCode,
          );
        } catch (error) {
          console.warn('[reflection-translation] failed to translate selected reflection', {
            detectedLanguageCode,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        send(createPipelineStep('reflection_translation', 'completed'));

        send(createPipelineStep('guide_generation', 'in_progress'));
        const [reflectionGuide, chatTitle] = await Promise.all([
          buildReflectionGuide({
            detectedLanguageCode,
            diagnosis: response.diagnosis,
            eventContent,
            selectedReflection: localizedSelectedReflection,
            userFeeling,
          }),
          generateChatTitle({
            detectedLanguageCode,
            eventContent,
            userFeeling,
          }),
        ]);
        send(createPipelineStep('guide_generation', 'completed'));

        const resultEvent: PipelineResultEvent = {
          data: {
            antidotes: enrichedAntidotes,
            chat_title: chatTitle,
            detected_language_code: detectedLanguageCode,
            diagnosis: response.diagnosis,
            reflection_guide: reflectionGuide,
            selected_reflection: localizedSelectedReflection,
          },
          type: 'result',
        };

        send(resultEvent);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        send({
          error: message,
          type: 'error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
