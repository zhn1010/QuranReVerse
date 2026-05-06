import { NextResponse } from 'next/server';
import { feelingInferenceStreamSystemPrompt } from '@/lib/antidotes/prompts';
import { checkAntidoteRateLimit } from '@/lib/antidotes/rate-limit';
import { createTextStreamFromOpenAIResponse, postOpenAIResponse } from '@/lib/openai-client';

function buildFeelingInferenceInput(eventContent: string) {
  return `User message: "${eventContent}"`;
}

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
    const upstreamResponse = await postOpenAIResponse({
      input: [
        {
          content: [
            {
              text: buildFeelingInferenceInput(eventContent),
              type: 'input_text',
            },
          ],
          role: 'user',
        },
      ],
      instructions: feelingInferenceStreamSystemPrompt,
      max_output_tokens: 140,
      stream: true,
    });

    if (!upstreamResponse.ok) {
      const details = await upstreamResponse.text();

      console.error('[antidotes/feeling/stream] OpenAI request failed', {
        details,
        status: upstreamResponse.status,
      });

      return NextResponse.json({ error: details || 'Could not detect the feeling.' }, { status: 502 });
    }

    const stream = createTextStreamFromOpenAIResponse(upstreamResponse, (streamError) => {
      console.error('[antidotes/feeling/stream] stream error', streamError);
    });

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not detect the feeling right now.';

    console.error('[antidotes/feeling/stream] unexpected error', {
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
