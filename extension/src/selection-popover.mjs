const browserApi = globalThis.browser ?? globalThis.chrome;

const EXTENSION_CONFIRM_REQUEST_MESSAGE_TYPE = 'SAKINAH_EXTENSION_CONFIRM_REQUEST';
const EXTENSION_INFER_FEELING_MESSAGE_TYPE = 'SAKINAH_EXTENSION_INFER_FEELING';
const EXTENSION_INFER_FEELING_STREAM_EVENT_MESSAGE_TYPE =
  'SAKINAH_EXTENSION_INFER_FEELING_STREAM_EVENT';
const EXTENSION_SHOW_POPOVER_MESSAGE_TYPE = 'SAKINAH_EXTENSION_SHOW_POPOVER';
const ROOT_ID = 'sakinah-extension-popover-root';
const RTL_SCRIPT_CHAR_REGEX = /[\u0590-\u08FF]/gu;
const LATIN_SCRIPT_CHAR_REGEX = /[A-Za-z]/g;

function detectTextDirection(text, fallbackDirection = 'ltr') {
  if (!text || text.trim().length === 0) {
    return fallbackDirection;
  }

  const rtlMatches = text.match(RTL_SCRIPT_CHAR_REGEX);
  const latinMatches = text.match(LATIN_SCRIPT_CHAR_REGEX);
  const rtlCount = rtlMatches?.length ?? 0;
  const latinCount = latinMatches?.length ?? 0;

  if (rtlCount === 0) {
    return fallbackDirection;
  }

  if (latinCount === 0) {
    return 'rtl';
  }

  return rtlCount / (rtlCount + latinCount) >= 0.3 ? 'rtl' : 'ltr';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getAnchorPosition() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return {
      left: window.innerWidth - 360,
      top: window.innerHeight - 260,
    };
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();

  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return {
      left: window.innerWidth - 360,
      top: window.innerHeight - 260,
    };
  }

  const cardWidth = 320;
  const estimatedHeight = 220;
  const left = clamp(
    rect.left + window.scrollX,
    16,
    window.scrollX + window.innerWidth - cardWidth - 16,
  );
  const top = clamp(
    rect.bottom + window.scrollY + 12,
    window.scrollY + 16,
    window.scrollY + window.innerHeight - estimatedHeight - 16,
  );

  return { left, top };
}

function getSelectionHighlightRects() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return [];
  }

  return Array.from(selection.getRangeAt(0).getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      height: rect.height,
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
    }));
}

function ensurePopoverShell() {
  const existing = document.getElementById(ROOT_ID);

  if (existing?.shadowRoot) {
    return existing;
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.documentElement.appendChild(root);

  const shadowRoot = root.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .layer {
        position: absolute;
        z-index: 2147483647;
      }

      .highlight-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 2147483646;
      }

      .highlight-rect {
        position: absolute;
        border-radius: 8px;
        background: rgba(173, 137, 88, 0.18);
        box-shadow:
          0 0 0 1px rgba(173, 137, 88, 0.22),
          0 8px 24px rgba(173, 137, 88, 0.08);
      }

      .card {
        width: 320px;
        border: 1px solid rgba(32, 26, 20, 0.08);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 18px 40px rgba(24, 18, 12, 0.14);
        backdrop-filter: blur(14px);
        color: #201a14;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .body {
        padding: 18px;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .logo {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        object-fit: cover;
        flex-shrink: 0;
      }

      .title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
      }

      .close {
        border: none;
        background: transparent;
        color: #7b6e61;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
        width: 28px;
        height: 28px;
        border-radius: 999px;
      }

      .close:hover {
        background: rgba(32, 26, 20, 0.06);
        color: #201a14;
      }

      .textarea {
        width: 100%;
        min-height: 144px;
        box-sizing: border-box;
        resize: none;
        border: 1px solid rgba(32, 26, 20, 0.1);
        border-radius: 16px;
        padding: 13px 14px 52px;
        background: #fcfbf8;
        color: inherit;
        font: inherit;
        font-size: 14px;
        line-height: 1.6;
      }

      .textarea[dir="rtl"] {
        text-align: right;
      }

      .textarea[dir="ltr"] {
        text-align: left;
      }

      .textarea:focus {
        outline: none;
        border-color: rgba(32, 26, 20, 0.22);
        background: #fff;
      }

      .textarea-wrap {
        position: relative;
      }

      .detect-button {
        position: absolute;
        left: 12px;
        bottom: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(32, 26, 20, 0.08);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.92);
        color: #65594d;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        padding: 8px 10px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(24, 18, 12, 0.08);
      }

      .detect-button:hover {
        color: #201a14;
        background: #fff;
      }

      .detect-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .detect-button[hidden] {
        display: none;
      }

      .detect-icon {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .error {
        margin: 10px 0 0;
        color: #9b3f2f;
        font-size: 12px;
        line-height: 1.5;
      }

      .actions {
        margin-top: 14px;
      }

      .button {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        background: #201a14;
        color: #fff;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
      }

      .button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    </style>
    <div class="highlight-layer" hidden></div>
    <div class="layer" hidden>
      <div class="card" role="dialog" aria-modal="false" aria-label="Reflect with Sakinah.now">
        <div class="body">
          <div class="header">
            <div class="brand">
              <img class="logo" alt="" />
              <p class="title">How did this text land on your heart?</p>
            </div>
            <button class="close" type="button" aria-label="Close">×</button>
          </div>
          <div class="textarea-wrap">
            <textarea class="textarea" placeholder="Name the feeling..."></textarea>
            <button class="detect-button" type="button">
              <svg class="detect-icon" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3.5 13.4 7.6 17.5 9l-4.1 1.4L12 14.5l-1.4-4.1L6.5 9l4.1-1.4L12 3.5Z" />
                <path d="m18.5 14 .67 1.83L21 16.5l-1.83.67L18.5 19l-.67-1.83L16 16.5l1.83-.67L18.5 14Z" />
                <path d="m5.5 14 .67 1.83L8 16.5l-1.83.67L5.5 19l-.67-1.83L3 16.5l1.83-.67L5.5 14Z" />
              </svg>
              <span class="detect-label">Detect Nafs-driven reading</span>
            </button>
          </div>
          <p class="error" hidden></p>
          <div class="actions">
            <button class="button" type="button">Begin Quranic reflection</button>
          </div>
        </div>
      </div>
    </div>
  `;

  return root;
}

function installPopoverController() {
  const root = ensurePopoverShell();

  if (root.dataset.ready === 'true') {
    return root;
  }

  const shadowRoot = root.shadowRoot;
  const highlightLayer = shadowRoot.querySelector('.highlight-layer');
  const layer = shadowRoot.querySelector('.layer');
  const logo = shadowRoot.querySelector('.logo');
  const textarea = shadowRoot.querySelector('.textarea');
  const detectButton = shadowRoot.querySelector('.detect-button');
  const detectLabel = shadowRoot.querySelector('.detect-label');
  const button = shadowRoot.querySelector('.button');
  const error = shadowRoot.querySelector('.error');
  const close = shadowRoot.querySelector('.close');

  const state = {
    activeRequestId: null,
    eventContent: '',
    isDetecting: false,
    isSubmitting: false,
  };

  function syncTextareaDirection() {
    textarea.dir = detectTextDirection(textarea.value, 'ltr');
  }

  function syncDetectButtonVisibility() {
    detectButton.hidden = textarea.value.trim().length > 0;
  }

  function syncButtonState() {
    button.disabled = state.isSubmitting || state.isDetecting;
    detectButton.disabled = state.isSubmitting || state.isDetecting;
    detectLabel.textContent = state.isDetecting ? 'Detecting...' : 'Detect Nafs-driven reading';
  }

  function hide() {
    state.activeRequestId = null;
    state.isDetecting = false;
    state.isSubmitting = false;
    syncButtonState();
    highlightLayer.hidden = true;
    highlightLayer.replaceChildren();
    layer.hidden = true;
    error.hidden = true;
    error.textContent = '';
  }

  function renderSelectionHighlights() {
    const rects = getSelectionHighlightRects();

    highlightLayer.replaceChildren();

    if (rects.length === 0) {
      highlightLayer.hidden = true;
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const rect of rects) {
      const node = document.createElement('div');
      node.className = 'highlight-rect';
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.width = `${rect.width}px`;
      node.style.height = `${rect.height}px`;
      fragment.appendChild(node);
    }

    highlightLayer.appendChild(fragment);
    highlightLayer.hidden = false;
  }

  async function submit() {
    if (state.isSubmitting) {
      return;
    }

    state.isSubmitting = true;
    syncButtonState();
    error.hidden = true;
    error.textContent = '';

    const response = await browserApi.runtime.sendMessage({
      payload: {
        eventContent: state.eventContent,
        userFeeling: textarea.value,
      },
      type: EXTENSION_CONFIRM_REQUEST_MESSAGE_TYPE,
    });

    state.isSubmitting = false;
    syncButtonState();

    if (!response?.ok) {
      error.textContent = response?.error ?? 'Could not open the reflection.';
      error.hidden = false;
      return;
    }

    hide();
  }

  async function inferFeeling() {
    if (state.isSubmitting || state.isDetecting) {
      return;
    }

    state.activeRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    state.isDetecting = true;
    textarea.value = '';
    syncTextareaDirection();
    syncDetectButtonVisibility();
    syncButtonState();
    error.hidden = true;
    error.textContent = '';

    const response = await browserApi.runtime.sendMessage({
      payload: {
        eventContent: state.eventContent,
        requestId: state.activeRequestId,
      },
      type: EXTENSION_INFER_FEELING_MESSAGE_TYPE,
    });

    if (!response?.ok) {
      state.activeRequestId = null;
      state.isDetecting = false;
      syncButtonState();
      error.textContent = response?.error ?? 'Could not detect the feeling.';
      error.hidden = false;
    } else {
      textarea.focus();
    }
  }

  function show({ eventContent, logoUrl }) {
    state.activeRequestId = null;
    state.eventContent = eventContent;
    state.isDetecting = false;
    state.isSubmitting = false;
    textarea.value = '';
    syncTextareaDirection();
    syncDetectButtonVisibility();
    syncButtonState();
    logo.src = logoUrl;
    error.hidden = true;
    error.textContent = '';
    renderSelectionHighlights();

    const position = getAnchorPosition();
    layer.style.left = `${position.left}px`;
    layer.style.top = `${position.top}px`;
    layer.hidden = false;

    window.setTimeout(() => {
      textarea.focus();
    }, 0);
  }

  close.addEventListener('click', hide);
  textarea.addEventListener('input', () => {
    syncTextareaDirection();
    syncDetectButtonVisibility();
  });
  detectButton.addEventListener('click', () => {
    void inferFeeling();
  });
  button.addEventListener('click', () => {
    void submit();
  });

  document.addEventListener(
    'mousedown',
    (event) => {
      if (layer.hidden) {
        return;
      }

      const path = event.composedPath();

      if (!path.includes(root) && !path.includes(layer)) {
        hide();
      }
    },
    true,
  );

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hide();
    }
  });

  browserApi.runtime.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === EXTENSION_SHOW_POPOVER_MESSAGE_TYPE) {
      const payload = message.payload;

      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof payload.eventContent !== 'string' ||
        typeof payload.logoUrl !== 'string'
      ) {
        return;
      }

      show({
        eventContent: payload.eventContent,
        logoUrl: payload.logoUrl,
      });
      return;
    }

    if (message.type !== EXTENSION_INFER_FEELING_STREAM_EVENT_MESSAGE_TYPE) {
      return;
    }

    const payload = message.payload;

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.requestId !== 'string' ||
      payload.requestId !== state.activeRequestId
    ) {
      return;
    }

    if (payload.status === 'chunk' || payload.status === 'done') {
      textarea.value = typeof payload.text === 'string' ? payload.text : '';
      syncTextareaDirection();
      syncDetectButtonVisibility();
    }

    if (payload.status === 'error') {
      state.activeRequestId = null;
      state.isDetecting = false;
      syncButtonState();
      error.textContent =
        typeof payload.error === 'string' ? payload.error : 'Could not detect the feeling.';
      error.hidden = false;
      return;
    }

    if (payload.status === 'done') {
      state.activeRequestId = null;
      state.isDetecting = false;
      syncButtonState();
      textarea.focus();
    }
  });

  root.dataset.ready = 'true';

  return root;
}

installPopoverController();
