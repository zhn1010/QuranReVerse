import { NextResponse } from 'next/server';
import { createPipelineStep, toJsonLine } from '@/lib/shared/antidotes/events';
import { buildReflectionCandidates } from '@/lib/server/antidotes/reflections';
import { checkAntidoteRateLimit } from '@/lib/server/antidotes/rate-limit';
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
} from '@/lib/server/antidotes/service';
import type {
  PipelineEvent,
  PipelineResultEvent,
} from '@/lib/shared/antidotes/types';

const logLlmDebug = createLlmDebugLogger();

export async function POST(request: Request) {
  // Check rate limit first
  const rateLimitCheck = await checkAntidoteRateLimit(request);
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
