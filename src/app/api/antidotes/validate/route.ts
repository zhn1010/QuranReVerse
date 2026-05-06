import { NextResponse } from 'next/server';
import { createLlmDebugLogger, validateUserInput } from '@/lib/antidotes/service';

const logLlmDebug = createLlmDebugLogger();

export async function POST(request: Request) {
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

  try {
    const validation = await validateUserInput(eventContent, userFeeling, {
      debugLogger: logLlmDebug,
    });

    if (validation.decision !== 'valid') {
      return NextResponse.json(
        {
          decision: validation.decision,
          error: validation.reply_message,
          reason_code: validation.reason_code,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(validation);
  } catch {
    return NextResponse.json(
      { error: 'Could not check your input right now. Please try again.' },
      { status: 503 },
    );
  }
}
