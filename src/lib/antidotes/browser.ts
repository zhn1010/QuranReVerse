import type { ApiResponse } from '@/lib/antidote-types';
import type { PipelineErrorEvent, PipelineResultEvent, PipelineStepEvent } from '@/lib/antidotes/types';
import { readNdjsonStream } from '@/lib/stream-utils';

export type PipelineStreamEvent = PipelineErrorEvent | PipelineResultEvent | PipelineStepEvent;

export async function requestAntidoteStream(
  {
    eventContent,
    fingerprint,
    userFeeling,
  }: {
    eventContent: string;
    fingerprint?: string | null;
    userFeeling: string;
  },
  {
    fetchImpl = fetch,
    onStep,
    signal,
  }: {
    fetchImpl?: typeof fetch;
    onStep?: (event: PipelineStepEvent) => void;
    signal?: AbortSignal;
  } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fingerprint) {
    headers['X-Browser-Fingerprint'] = fingerprint;
  }

  const response = await fetchImpl('/api/antidotes', {
    body: JSON.stringify({
      eventContent,
      userFeeling,
    }),
    headers,
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: 'Request failed.' }))) as {
      error?: string;
    };

    throw new Error(payload.error || 'Request failed.');
  }

  if (!response.body) {
    throw new Error('No stream received from server.');
  }

  let finalResult: ApiResponse | null = null;

  await readNdjsonStream<PipelineStreamEvent>(response.body, {
    onEvent: (event) => {
      if (event.type === 'step') {
        onStep?.(event);
        return;
      }

      if (event.type === 'result') {
        finalResult = event.data;
        return;
      }

      if (event.type === 'error') {
        throw new Error(event.error || 'Request failed.');
      }
    },
  });

  if (!finalResult) {
    throw new Error('No result returned from server.');
  }

  return finalResult;
}
