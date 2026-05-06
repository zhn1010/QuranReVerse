import { browserApi } from './shared/browser.mjs';
import { cleanupStoredState, confirmRequest } from './shared/request-store.mjs';
import {
  APP_ORIGIN,
  CONTEXT_MENU_ID,
  EXTENSION_CONFIRM_REQUEST_MESSAGE_TYPE,
  EXTENSION_INFER_FEELING_MESSAGE_TYPE,
  EXTENSION_INFER_FEELING_STREAM_EVENT_MESSAGE_TYPE,
  EXTENSION_SHOW_POPOVER_MESSAGE_TYPE,
  QUERY_REQUEST_KEY,
  QUERY_SOURCE_KEY,
  QUERY_SOURCE_VALUE,
} from './shared/constants.mjs';

const activeFeelingInferenceControllers = new Map();

async function registerContextMenu() {
  await browserApi.contextMenus.removeAll();
  browserApi.contextMenus.create({
    contexts: ['selection'],
    id: CONTEXT_MENU_ID,
    title: 'Bring me back to Sakinah now',
  });
}

async function injectSelectionPopover(tabId) {
  if (browserApi.scripting?.executeScript) {
    await browserApi.scripting.executeScript({
      files: ['selection-popover.js'],
      target: { tabId },
    });
    return;
  }

  if (browserApi.tabs?.executeScript) {
    await browserApi.tabs.executeScript(tabId, {
      file: 'selection-popover.js',
    });
  }
}

async function showSelectionPopover(tabId, eventContent) {
  await injectSelectionPopover(tabId);

  await browserApi.tabs.sendMessage(tabId, {
    payload: {
      eventContent,
      logoUrl: browserApi.runtime.getURL('icons/logo.png'),
    },
    type: EXTENSION_SHOW_POPOVER_MESSAGE_TYPE,
  });
}

async function sendFeelingStreamEvent(tabId, payload) {
  await browserApi.tabs.sendMessage(tabId, {
    payload,
    type: EXTENSION_INFER_FEELING_STREAM_EVENT_MESSAGE_TYPE,
  });
}

browserApi.runtime.onInstalled.addListener(() => {
  void cleanupStoredState(browserApi).then(registerContextMenu);
});

if (browserApi.runtime.onStartup) {
  browserApi.runtime.onStartup.addListener(() => {
    void cleanupStoredState(browserApi).then(registerContextMenu);
  });
}

browserApi.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return;
  }

  const selectionText = typeof info.selectionText === 'string' ? info.selectionText.trim() : '';

  if (!selectionText || !tab?.id) {
    return;
  }

  void showSelectionPopover(tab.id, selectionText);
});

browserApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  if (message.type === EXTENSION_CONFIRM_REQUEST_MESSAGE_TYPE) {
    void (async () => {
      try {
        const request = await confirmRequest(browserApi, {
          eventContent:
            typeof message.payload?.eventContent === 'string' ? message.payload.eventContent : '',
          userFeeling:
            typeof message.payload?.userFeeling === 'string' ? message.payload.userFeeling : '',
        });

        const url = new URL(APP_ORIGIN);
        url.searchParams.set(QUERY_SOURCE_KEY, QUERY_SOURCE_VALUE);
        url.searchParams.set(QUERY_REQUEST_KEY, request.requestId);

        await browserApi.tabs.create({
          url: url.toString(),
        });

        sendResponse({
          ok: true,
        });
      } catch (error) {
        sendResponse({
          error: error instanceof Error ? error.message : 'Could not open the reflection.',
          ok: false,
        });
      }
    })();

    return true;
  }

  if (message.type === EXTENSION_INFER_FEELING_MESSAGE_TYPE) {
    void (async () => {
      let abortController;

      try {
        const tabId = sender?.tab?.id;
        const eventContent =
          typeof message.payload?.eventContent === 'string' ? message.payload.eventContent.trim() : '';
        const requestId =
          typeof message.payload?.requestId === 'string' ? message.payload.requestId.trim() : '';

        if (!eventContent || !requestId || typeof tabId !== 'number') {
          sendResponse({
            error: !eventContent ? 'Please select some text first.' : 'Could not start feeling detection.',
            ok: false,
          });
          return;
        }

        const existingController = activeFeelingInferenceControllers.get(tabId);

        if (existingController) {
          existingController.abort();
        }

        abortController = new AbortController();
        activeFeelingInferenceControllers.set(tabId, abortController);

        sendResponse({
          ok: true,
        });

        const response = await fetch(`${APP_ORIGIN}/api/antidotes/feeling/stream`, {
          signal: abortController.signal,
          body: JSON.stringify({
            eventContent,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        });

        if (!response.ok) {
          const payload = (await response
            .json()
            .catch(() => ({ error: 'Could not detect the feeling right now.' })));

          await sendFeelingStreamEvent(tabId, {
            error:
              typeof payload.error === 'string'
                ? payload.error
                : 'Could not detect the feeling right now.',
            requestId,
            status: 'error',
          });
          return;
        }

        if (!response.body) {
          await sendFeelingStreamEvent(tabId, {
            error: 'No stream received from the server.',
            requestId,
            status: 'error',
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aggregatedText = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          aggregatedText += decoder.decode(value, { stream: true });

          await sendFeelingStreamEvent(tabId, {
            requestId,
            status: 'chunk',
            text: aggregatedText,
          });
        }

        aggregatedText += decoder.decode();

        await sendFeelingStreamEvent(tabId, {
          requestId,
          status: 'done',
          text: aggregatedText,
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }

        const requestId =
          typeof message.payload?.requestId === 'string' ? message.payload.requestId.trim() : '';
        const tabId = sender?.tab?.id;

        if (typeof tabId === 'number' && requestId) {
          await sendFeelingStreamEvent(tabId, {
            error: error instanceof Error ? error.message : 'Could not detect the feeling.',
            requestId,
            status: 'error',
          });
          return;
        }

        sendResponse({
          error: error instanceof Error ? error.message : 'Could not detect the feeling.',
          ok: false,
        });
      } finally {
        const tabId = sender?.tab?.id;

        if (
          typeof tabId === 'number' &&
          activeFeelingInferenceControllers.get(tabId) === abortController
        ) {
          activeFeelingInferenceControllers.delete(tabId);
        }
      }
    })();

    return true;
  }

  return false;
});

void cleanupStoredState(browserApi).then(registerContextMenu);
