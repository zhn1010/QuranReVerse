import { NextResponse } from 'next/server';
import { checkAntidoteRateLimit } from '@/lib/antidotes/rate-limit';
import { createLlmDebugLogger, inferUserFeeling } from '@/lib/antidotes/service';

const logLlmDebug = createLlmDebugLogger();

export async function POST(request: Request) {
  const rateLimitCheck = await checkAntidoteRateLimit(request);

  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.reason }, { status: 429 });
  }

  let body: {
    eventContent?: string;
  };

  try {
    body = (await request.json()) as {
      eventContent?: string;
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

  if (!eventContent) {
    return NextResponse.json(
      { error: 'Please describe what happened in a sentence or two.' },
      { status: 400 },
    );
  }

  try {
    const inferredFeeling = await inferUserFeeling(eventContent, {
      debugLogger: logLlmDebug,
    });

    return NextResponse.json({
      inferred_feeling: inferredFeeling,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not detect the feeling right now.';

    console.error('[antidotes/feeling] inference failed', {
      message,
    });

    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  }
}
