import type { ApiResponse } from '@/lib/shared/antidotes/api-types';
import type { InputValidationResponse } from '@/lib/shared/antidotes/types';
import type { PipelineErrorEvent, PipelineResultEvent, PipelineStepEvent } from '@/lib/shared/antidotes/types';
import { readNdjsonStream, readTextStream } from '@/lib/shared/stream/stream-utils';

export type PipelineStreamEvent = PipelineErrorEvent | PipelineResultEvent | PipelineStepEvent;

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({ error: 'Request failed.' }))) as {
    error?: string;
  };

  return payload.error || 'Request failed.';
}

export async function validateAntidoteInput(
  {
    eventContent,
    userFeeling,
  }: {
    eventContent: string;
    userFeeling: string;
  },
  {
    fetchImpl = fetch,
    signal,
  }: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
) {
  const response = await fetchImpl('/api/antidotes/validate', {
    body: JSON.stringify({
      eventContent,
      userFeeling,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as InputValidationResponse;
}

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
    throw new Error(await readErrorMessage(response));
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

export async function streamInferredFeeling(
  {
    eventContent,
  }: {
    eventContent: string;
  },
  {
    fetchImpl = fetch,
    onChunk,
    signal,
  }: {
    fetchImpl?: typeof fetch;
    onChunk?: (text: string) => void;
    signal?: AbortSignal;
  } = {},
) {
  const response = await fetchImpl('/api/antidotes/feeling/stream', {
    body: JSON.stringify({
      eventContent,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error('No stream received from server.');
  }

  return readTextStream(response.body, {
    onChunk: (_chunk, aggregatedText) => {
      onChunk?.(aggregatedText);
    },
  });
}
