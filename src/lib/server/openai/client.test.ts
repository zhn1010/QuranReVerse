import { describe, expect, it, vi } from 'vitest';
import {
  callStructuredOpenAI,
  createTextStreamFromOpenAIResponse,
  extractResponseText,
  parseStructuredOpenAIJson,
} from '@/lib/server/openai/client';

function createJsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

async function readStreamText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();

  return output;
}

describe('extractResponseText', () => {
  it('prefers direct output_text when present', () => {
    expect(
      extractResponseText({
        output_text: '{"ok":true}',
      }),
    ).toBe('{"ok":true}');
  });

  it('falls back to nested output content blocks', () => {
    expect(
      extractResponseText({
        output: [
          {
            content: [{ type: 'output_text', text: '{"title":"calm"}' }, { type: 'ignored' }],
          },
        ],
      }),
    ).toBe('{"title":"calm"}');
  });

  it('returns null when no text is available', () => {
    expect(extractResponseText({ output: [] })).toBeNull();
  });
});

describe('parseStructuredOpenAIJson', () => {
  it('parses valid structured JSON', () => {
    expect(
      parseStructuredOpenAIJson<{ answer: string }>(
        {
          output_text: '{"answer":"steady"}',
        },
        { schemaName: 'sample' },
      ),
    ).toEqual({ answer: 'steady' });
  });

  it('throws refusal messages as errors', () => {
    expect(() =>
      parseStructuredOpenAIJson(
        {
          refusal: 'Not allowed.',
        },
        { schemaName: 'sample' },
      ),
    ).toThrow('Not allowed.');
  });

  it('throws when structured JSON text is missing', () => {
    expect(() =>
      parseStructuredOpenAIJson(
        {
          output: [],
        },
        { schemaName: 'sample' },
      ),
    ).toThrow('OpenAI did not return structured JSON text.');
  });
});

describe('callStructuredOpenAI', () => {
  it('uses the shared request wrapper and returns parsed JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'test-model';

    const fetchImpl = vi.fn<typeof fetch>(async () =>
      createJsonResponse({
        output_text: '{"message":"ok"}',
      }),
    );

    await expect(
      callStructuredOpenAI<{ message: string }>(
        {
          inputText: 'hello',
          instructions: 'respond',
          maxOutputTokens: 10,
          schema: { type: 'object' },
          schemaName: 'sample',
        },
        { fetchImpl },
      ),
    ).resolves.toEqual({ message: 'ok' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [firstCall] = fetchImpl.mock.calls;

    expect(firstCall?.[0]).toBe('https://api.openai.com/v1/responses');
  });
});

describe('createTextStreamFromOpenAIResponse', () => {
  it('emits only output_text deltas from the sse stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"type":"response.output_text.delta","delta":"As-salaam "}\n',
              'data: {"type":"response.refusal.delta","delta":"ignore"}\n',
              'data: {"type":"response.output_text.delta","delta":"alaykum"}\n',
              'data: [DONE]\n',
            ].join(''),
          ),
        );
        controller.close();
      },
    });

    await expect(readStreamText(createTextStreamFromOpenAIResponse(stream))).resolves.toBe(
      'As-salaam alaykum',
    );
  });

  it('ignores malformed sse lines and closes cleanly', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            [
              'data: {"type":"response.output_text.delta","delta":"first "}\n',
              'data: not-json\n',
              'data: {"type":"response.output_text.delta","delta":"second"}\n',
            ].join(''),
          ),
        );
        controller.close();
      },
    });

    await expect(readStreamText(createTextStreamFromOpenAIResponse(stream))).resolves.toBe(
      'first second',
    );
  });
});
