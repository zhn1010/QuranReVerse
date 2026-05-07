export async function readTextStream(
  stream: ReadableStream<Uint8Array>,
  {
    onChunk,
  }: {
    onChunk?: (chunk: string, aggregatedText: string) => void;
  } = {},
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    text += chunk;
    onChunk?.(chunk, text);
  }

  text += decoder.decode();

  return text;
}

export async function readNdjsonStream<T>(
  stream: ReadableStream<Uint8Array>,
  {
    onEvent,
  }: {
    onEvent: (event: T) => void;
  },
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      onEvent(JSON.parse(line) as T);
    }
  }

  buffer += decoder.decode();

  if (!buffer.trim()) {
    return;
  }

  onEvent(JSON.parse(buffer.trim()) as T);
}
