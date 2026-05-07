import { describe, expect, it } from 'vitest';
import { readNdjsonStream, readTextStream } from '@/lib/shared/stream/stream-utils';

function createStream(chunks: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });
}

describe('readTextStream', () => {
  it('aggregates streamed text and reports each intermediate value', async () => {
    const seen: string[] = [];

    await expect(
      readTextStream(createStream(['As-salaam ', 'alaykum']), {
        onChunk: (_chunk, aggregatedText) => {
          seen.push(aggregatedText);
        },
      }),
    ).resolves.toBe('As-salaam alaykum');

    expect(seen).toEqual(['As-salaam ', 'As-salaam alaykum']);
  });
});

describe('readNdjsonStream', () => {
  it('parses ndjson events across chunk boundaries and trailing buffers', async () => {
    const events: Array<{ type: string; value: string }> = [];

    await readNdjsonStream<{ type: string; value: string }>(
      createStream(['{"type":"step","value":"a"}\n{"type":"r', 'esult","value":"b"}']),
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(events).toEqual([
      { type: 'step', value: 'a' },
      { type: 'result', value: 'b' },
    ]);
  });
});
