import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { createPipelineStep, toJsonLine } from '@/lib/antidotes/events';
import { buildReflectionCandidates } from '@/lib/antidotes/reflections';
import {
  buildReflectionGuide,
  callAntidoteModel,
  createLlmDebugLogger,
  curateReflection,
  detectInputLanguage,
  enrichAntidotes,
  generateChatTitle,
  inferUserFeeling,
  translateSelectedReflectionIfNeeded,
} from '@/lib/antidotes/service';
import type {
  PipelineEvent,
  PipelineResultEvent,
} from '@/lib/antidotes/types';
import { getSession } from '@/lib/session';

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

const logLlmDebug = createLlmDebugLogger();

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
  const userFeeling = body.userFeeling?.trim() ?? '';

  if (!eventContent) {
    return NextResponse.json(
      { error: 'Please describe what happened in a sentence or two.' },
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
        const effectiveUserFeeling =
          userFeeling ||
          (await inferUserFeeling(eventContent, {
            debugLogger: logLlmDebug,
          }));

        send(createPipelineStep('language_detection', 'in_progress'));
        const detectedLanguageCode = await detectInputLanguage(eventContent, effectiveUserFeeling, {
          debugLogger: logLlmDebug,
        });
        send(createPipelineStep('language_detection', 'completed'));

        send(createPipelineStep('ayah_selection', 'in_progress'));
        const response = await callAntidoteModel(eventContent, effectiveUserFeeling, {
          debugLogger: logLlmDebug,
        });
        send(createPipelineStep('ayah_selection', 'completed'));

        send(createPipelineStep('reflection_fetch', 'in_progress'));
        const enrichedAntidotes = await enrichAntidotes(response.antidotes);
        send(createPipelineStep('reflection_fetch', 'completed'));

        send(createPipelineStep('reflection_curation', 'in_progress'));
        const selectedReflection = await curateReflection(
          response.diagnosis,
          buildReflectionCandidates(enrichedAntidotes),
          {
            debugLogger: logLlmDebug,
          },
        );
        send(createPipelineStep('reflection_curation', 'completed'));

        send(createPipelineStep('reflection_translation', 'in_progress'));
        let localizedSelectedReflection = selectedReflection;
        try {
          localizedSelectedReflection = await translateSelectedReflectionIfNeeded(
            selectedReflection,
            detectedLanguageCode,
            {
              debugLogger: logLlmDebug,
            },
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
          buildReflectionGuide(
            {
              detectedLanguageCode,
              diagnosis: response.diagnosis,
              eventContent,
              selectedReflection: localizedSelectedReflection,
              userFeeling: effectiveUserFeeling,
            },
            {
              debugLogger: logLlmDebug,
            },
          ),
          generateChatTitle(
            {
              detectedLanguageCode,
              eventContent,
              userFeeling: effectiveUserFeeling,
            },
            {
              debugLogger: logLlmDebug,
            },
          ),
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
