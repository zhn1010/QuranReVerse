import { describe, expect, it, vi } from 'vitest';
import { requestAntidoteStream } from '@/lib/antidotes/browser';

function createJsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function createNdjsonResponse(chunks: string[], init?: ResponseInit) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
    },
    status: 200,
    ...init,
  });
}

describe('requestAntidoteStream', () => {
  it('streams step events and returns the final result', async () => {
    const onStep = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      createNdjsonResponse([
        '{"type":"step","step":"language_detection","status":"in_progress","label":"Detecting your input language"}\n',
        '{"type":"result","data":{"antidotes":[],"chat_title":"Steady","detected_language_code":"en","diagnosis":{"god_centric_reframe":"Allah is enough.","materialistic_narrative":"I need control.","spiritual_drift":"Fear"},"reflection_guide":null,"selected_reflection":null}}',
      ]),
    );

    await expect(
      requestAntidoteStream(
        {
          eventContent: 'event',
          fingerprint: 'fp-1',
          userFeeling: 'feeling',
        },
        { fetchImpl, onStep },
      ),
    ).resolves.toMatchObject({
      chat_title: 'Steady',
      detected_language_code: 'en',
    });

    expect(onStep).toHaveBeenCalledWith({
      label: 'Detecting your input language',
      status: 'in_progress',
      step: 'language_detection',
      type: 'step',
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        'Content-Type': 'application/json',
        'X-Browser-Fingerprint': 'fp-1',
      },
      method: 'POST',
    });
  });

  it('throws the server error message for error events', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      createNdjsonResponse(['{"type":"error","error":"Too many requests."}']),
    );

    await expect(
      requestAntidoteStream(
        {
          eventContent: 'event',
          userFeeling: 'feeling',
        },
        { fetchImpl },
      ),
    ).rejects.toThrow('Too many requests.');
  });

  it('throws the json error payload for non-ok responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      createJsonResponse(
        {
          error: 'Blocked.',
        },
        { status: 429, statusText: 'Too Many Requests' },
      ),
    );

    await expect(
      requestAntidoteStream(
        {
          eventContent: 'event',
          userFeeling: 'feeling',
        },
        { fetchImpl },
      ),
    ).rejects.toThrow('Blocked.');
  });
});
