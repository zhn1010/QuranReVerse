const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_REASONING = {
  effort: 'minimal',
} as const;

type OpenAIDebugLogger = (message: string, details: Record<string, unknown>) => void;

type StructuredOpenAIParams = {
  inputText: string;
  instructions: string;
  maxOutputTokens: number;
  schema: Record<string, unknown>;
  schemaName: string;
};

type StreamableBodySource = ReadableStream<Uint8Array>;

function noopOpenAIDebugLogger() {
  // no-op
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL ?? 'gpt-5';
}

export function getOpenAIApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  return apiKey;
}

export function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const maybeText = (block as { text?: unknown }).text;

      if (typeof maybeText === 'string' && maybeText.trim().length > 0) {
        return maybeText;
      }
    }
  }

  return null;
}

export function parseStructuredOpenAIJson<T>(
  payload: Record<string, unknown>,
  {
    debugLogger = noopOpenAIDebugLogger,
    schemaName,
  }: {
    debugLogger?: OpenAIDebugLogger;
    schemaName: string;
  },
) {
  debugLogger('received openai payload', {
    hasOutputText: typeof payload.output_text === 'string',
    schemaName,
    status: payload.status,
  });

  const refusal = payload.refusal;

  if (typeof refusal === 'string' && refusal.trim().length > 0) {
    throw new Error(refusal);
  }

  const text = extractResponseText(payload);

  if (!text) {
    debugLogger('missing structured json text', {
      schemaName,
    });
    throw new Error('OpenAI did not return structured JSON text.');
  }

  debugLogger('raw structured text extracted', {
    preview: text.slice(0, 500),
    schemaName,
    textEndsWithBrace: text.trim().endsWith('}'),
    textLength: text.length,
    textStartsWithBrace: text.trim().startsWith('{'),
  });

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    debugLogger('failed to parse structured json', {
      parseError: error instanceof Error ? error.message : String(error),
      preview: text.slice(0, 1000),
      schemaName,
      textLength: text.length,
    });
    throw error;
  }
}

export async function postOpenAIResponse(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
) {
  return fetchImpl(OPENAI_RESPONSES_API_URL, {
    body: JSON.stringify({
      model: getOpenAIModel(),
      reasoning: OPENAI_REASONING,
      ...body,
    }),
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
}

export async function callStructuredOpenAI<T>(
  { inputText, instructions, maxOutputTokens, schema, schemaName }: StructuredOpenAIParams,
  {
    debugLogger = noopOpenAIDebugLogger,
    fetchImpl = fetch,
  }: {
    debugLogger?: OpenAIDebugLogger;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<T> {
  const response = await postOpenAIResponse(
    {
      input: [
        {
          content: [
            {
              text: inputText,
              type: 'input_text',
            },
          ],
          role: 'user',
        },
      ],
      instructions,
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          name: schemaName,
          schema,
          strict: true,
          type: 'json_schema',
        },
        verbosity: 'low',
      },
    },
    fetchImpl,
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${details}`);
  }

  return parseStructuredOpenAIJson<T>((await response.json()) as Record<string, unknown>, {
    debugLogger,
    schemaName,
  });
}

export function createTextStreamFromOpenAIResponse(
  source: Response | StreamableBodySource,
  onStreamError?: (error: unknown) => void,
) {
  const body = source instanceof Response ? source.body : source;

  if (!body) {
    throw new Error('OpenAI did not return a readable stream.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || !trimmed.startsWith('data:')) {
              continue;
            }

            const jsonStr = trimmed.slice(5).trim();

            if (jsonStr === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(jsonStr) as Record<string, unknown>;

              if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
                controller.enqueue(encoder.encode(event.delta));
              }
            } catch {
              // Skip malformed SSE lines to preserve current note-draft behavior.
            }
          }
        }
      } catch (error) {
        onStreamError?.(error);
      } finally {
        controller.close();
      }
    },
  });
}
