import { REQUEST_TTL_MS, STORAGE_KEY } from './constants.mjs';

export function createDraftRecord(eventContent, now = Date.now()) {
  return {
    createdAt: now,
    eventContent: eventContent.trim(),
  };
}

export function createConfirmedRequest(
  { eventContent, userFeeling },
  {
    createId = () => crypto.randomUUID(),
    now = Date.now(),
  } = {},
) {
  return {
    createdAt: now,
    eventContent: eventContent.trim(),
    requestId: createId(),
    userFeeling: userFeeling.trim(),
  };
}

function isFresh(createdAt, now) {
  return now - createdAt < REQUEST_TTL_MS;
}

export function pruneExtensionState(state, now = Date.now()) {
  const nextState = {
    draft: null,
    requests: {},
  };

  if (state?.draft && isFresh(state.draft.createdAt, now) && state.draft.eventContent) {
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
        isFresh(request.createdAt, now)
      ) {
        nextState.requests[requestId] = request;
      }
    }
  }

  return nextState;
}

export function getRequestFromState(state, requestId, now = Date.now()) {
  const prunedState = pruneExtensionState(state, now);
  return prunedState.requests[requestId] ?? null;
}

export async function loadExtensionState(browserApi, now = Date.now()) {
  const raw = await browserApi.storage.local.get(STORAGE_KEY);
  return pruneExtensionState(raw[STORAGE_KEY], now);
}

export async function saveExtensionState(browserApi, state) {
  await browserApi.storage.local.set({
    [STORAGE_KEY]: state,
  });
}

export async function cleanupStoredState(browserApi, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  await saveExtensionState(browserApi, state);
  return state;
}

export async function saveDraft(browserApi, eventContent, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  const nextState = {
    ...state,
    draft: createDraftRecord(eventContent, now),
  };

  await saveExtensionState(browserApi, nextState);

  return nextState.draft;
}

export async function clearDraft(browserApi, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  const nextState = {
    ...state,
    draft: null,
  };

  await saveExtensionState(browserApi, nextState);
}

export async function getDraft(browserApi, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  return state.draft;
}

export async function confirmRequest(
  browserApi,
  { eventContent, userFeeling },
  options = {},
) {
  const state = await loadExtensionState(browserApi, options.now);
  const request = createConfirmedRequest(
    {
      eventContent,
      userFeeling,
    },
    options,
  );
  const nextState = {
    draft: null,
    requests: {
      ...state.requests,
      [request.requestId]: request,
    },
  };

  await saveExtensionState(browserApi, nextState);

  return request;
}

export async function getRequest(browserApi, requestId, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  return state.requests[requestId] ?? null;
}

export async function deleteRequest(browserApi, requestId, now = Date.now()) {
  const state = await loadExtensionState(browserApi, now);
  const nextRequests = { ...state.requests };
  delete nextRequests[requestId];

  await saveExtensionState(browserApi, {
    ...state,
    requests: nextRequests,
  });
}
