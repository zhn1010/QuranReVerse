'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { MagicStarsIcon } from '@/components/icons';

const EXTENSION_PING_MESSAGE_TYPE = 'SAKINAH_EXTENSION_PING';
const EXTENSION_PING_RESULT_MESSAGE_TYPE = 'SAKINAH_EXTENSION_PING_RESULT';
const EXTENSION_DETECTION_TIMEOUT_MS = 650;

type BrowserFamily = 'chrome' | 'firefox';

type ExtensionPingResult = {
  installed: boolean;
  requestId: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getSupportedDesktopBrowser(): BrowserFamily | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const userAgent = navigator.userAgent;
  const isMobileBrowser =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);

  if (isMobileBrowser || !window.matchMedia('(min-width: 768px)').matches) {
    return null;
  }

  if (/Firefox\//.test(userAgent)) {
    return 'firefox';
  }

  const isChromeFamily = /Chrome\//.test(userAgent) || /Chromium\//.test(userAgent);
  const isExcludedBrowser = /Edg\//.test(userAgent) || /OPR\//.test(userAgent);

  if (isChromeFamily && !isExcludedBrowser) {
    return 'chrome';
  }

  return null;
}

function parseExtensionPingResult(data: unknown): ExtensionPingResult | null {
  if (
    !isObject(data) ||
    data.type !== EXTENSION_PING_RESULT_MESSAGE_TYPE ||
    !isObject(data.payload)
  ) {
    return null;
  }

  const payload = data.payload;

  if (typeof payload.requestId !== 'string' || typeof payload.installed !== 'boolean') {
    return null;
  }

  return {
    installed: payload.installed,
    requestId: payload.requestId,
  };
}

export function ChatShellExtensionCta() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const browser = getSupportedDesktopBrowser();

    if (!browser) {
      return;
    }

    const requestId =
      window.crypto?.randomUUID?.() ?? `${browser}-${Date.now()}-${Math.random().toString(16)}`;

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      settled = true;
      setShouldShow(true);
    }, EXTENSION_DETECTION_TIMEOUT_MS);

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      const payload = parseExtensionPingResult(event.data);

      if (!payload || payload.requestId !== requestId) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      setShouldShow(!payload.installed);
    };

    window.addEventListener('message', handleWindowMessage);
    window.postMessage(
      {
        payload: { requestId },
        type: EXTENSION_PING_MESSAGE_TYPE,
      },
      window.location.origin,
    );

    return () => {
      if (!settled) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('message', handleWindowMessage);
    };
  }, []);

  if (!shouldShow) {
    return null;
  }

  return (
    <Link
      className="hidden items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-card) px-3.5 py-2 text-sm font-medium text-(--ink-soft) transition hover:border-(--border-accent-hover) hover:bg-white hover:text-(--ink-strong) md:inline-flex"
      href="/extension"
    >
      <MagicStarsIcon className="h-4 w-4" />
      Browser add-on
    </Link>
  );
}
