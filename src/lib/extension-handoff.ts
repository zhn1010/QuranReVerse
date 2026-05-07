export const EXTENSION_REFLECT_MESSAGE_TYPE = 'SAKINAH_EXTENSION_REFLECT';
export const EXTENSION_HANDOFF_RESULT_MESSAGE_TYPE = 'SAKINAH_EXTENSION_HANDOFF_RESULT';

export type ExtensionReflectPayload = {
  eventContent: string;
  requestId: string;
  source: 'extension';
  userFeeling: string;
};

export type ExtensionHandoffResultPayload = {
  requestId: string;
  status: 'accepted' | 'ignored';
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function parseExtensionReflectPayload(data: unknown): ExtensionReflectPayload | null {
  if (!isObject(data) || data.type !== EXTENSION_REFLECT_MESSAGE_TYPE || !isObject(data.payload)) {
    return null;
  }

  const payload = data.payload;

  if (
    typeof payload.requestId !== 'string' ||
    typeof payload.eventContent !== 'string' ||
    typeof payload.userFeeling !== 'string' ||
    payload.source !== 'extension'
  ) {
    return null;
  }

  return {
    eventContent: payload.eventContent,
    requestId: payload.requestId,
    source: 'extension',
    userFeeling: payload.userFeeling,
  };
}

export function createExtensionHandoffResultMessage(
  payload: ExtensionHandoffResultPayload,
) {
  return {
    payload,
    type: EXTENSION_HANDOFF_RESULT_MESSAGE_TYPE,
  } as const;
}

export function stripExtensionRequestParams(url: URL) {
  const hadSource = url.searchParams.get('source') === 'extension';
  const hadRequest = url.searchParams.has('request');

  if (!hadSource && !hadRequest) {
    return false;
  }

  url.searchParams.delete('source');
  url.searchParams.delete('request');

  return true;
}
