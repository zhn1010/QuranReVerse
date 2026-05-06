const browserApi = globalThis.browser ?? globalThis.chrome;

const APP_ORIGIN = '__SAKINAH_APP_ORIGIN__';
const EXTENSION_HANDOFF_RESULT_MESSAGE_TYPE = 'SAKINAH_EXTENSION_HANDOFF_RESULT';
const EXTENSION_REFLECT_MESSAGE_TYPE = 'SAKINAH_EXTENSION_REFLECT';
const QUERY_REQUEST_KEY = 'request';
const QUERY_SOURCE_KEY = 'source';
const QUERY_SOURCE_VALUE = 'extension';
const REQUEST_TTL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'sakinah_extension_state';
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 350;

function isFresh(createdAt, now) {
  return now - createdAt < REQUEST_TTL_MS;
}

async function loadState() {
  const raw = await browserApi.storage.local.get(STORAGE_KEY);
  const state = raw[STORAGE_KEY];
  const nextState = {
    draft: null,
    requests: {},
  };

  if (state?.draft && isFresh(state.draft.createdAt, Date.now()) && state.draft.eventContent) {
    nextState.draft = state.draft;
  }

  if (state?.requests && typeof state.requests === 'object') {
    for (const [requestId, request] of Object.entries(state.requests)) {
      if (
        request &&
        typeof request === 'object' &&
        typeof request.createdAt === 'number' &&
        typeof request.eventContent === 'string' &&
        typeof request.userFeeling === 'string' &&
        isFresh(request.createdAt, Date.now())
      ) {
        nextState.requests[requestId] = request;
      }
    }
  }

  await browserApi.storage.local.set({
    [STORAGE_KEY]: nextState,
  });

  return nextState;
}

async function deleteRequest(requestId) {
  const state = await loadState();
  delete state.requests[requestId];
  await browserApi.storage.local.set({
    [STORAGE_KEY]: state,
  });
}

function postReflectPayload(request) {
  window.postMessage(
    {
      payload: {
        eventContent: request.eventContent,
        requestId: request.requestId,
        source: 'extension',
        userFeeling: request.userFeeling,
      },
      type: EXTENSION_REFLECT_MESSAGE_TYPE,
    },
    window.location.origin,
  );
}

async function handoffRequest() {
  if (window.location.origin !== APP_ORIGIN) {
    return;
  }

  const url = new URL(window.location.href);

  if (
    url.searchParams.get(QUERY_SOURCE_KEY) !== QUERY_SOURCE_VALUE ||
    !url.searchParams.has(QUERY_REQUEST_KEY)
  ) {
    return;
  }

  const requestId = url.searchParams.get(QUERY_REQUEST_KEY);

  if (!requestId) {
    return;
  }

  const state = await loadState();
  const request = state.requests[requestId];

  if (!request) {
    return;
  }

  let attempts = 0;
  let acknowledged = false;

  const acknowledge = async (event) => {
    if (event.source !== window || acknowledged) {
      return;
    }

    const data = event.data;

    if (!data || typeof data !== 'object' || data.type !== EXTENSION_HANDOFF_RESULT_MESSAGE_TYPE) {
      return;
    }

    const payload = data.payload;

    if (
      !payload ||
      typeof payload !== 'object' ||
      payload.requestId !== requestId ||
      (payload.status !== 'accepted' && payload.status !== 'ignored')
    ) {
      return;
    }

    acknowledged = true;
    window.removeEventListener('message', acknowledge);
    await deleteRequest(requestId);
  };

  window.addEventListener('message', acknowledge);

  const sendUntilAck = () => {
    if (acknowledged || attempts >= MAX_ATTEMPTS) {
      if (!acknowledged) {
        window.removeEventListener('message', acknowledge);
      }
      return;
    }

    attempts += 1;
    postReflectPayload(request);
    window.setTimeout(sendUntilAck, RETRY_DELAY_MS);
  };

  sendUntilAck();
}

void handoffRequest();
