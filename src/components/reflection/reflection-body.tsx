'use client';

import { useState } from 'react';
import {
  detectTextDirection,
  getDirectionStyles,
  type TextDirection,
} from '@/lib/reflection-ui';

type ReflectionBodyProps = {
  authorName?: string | null;
  body: string;
  collapsible?: boolean;
  createdAt?: string | null;
  fallbackDirection: TextDirection;
  postId?: number;
  translatedFromLanguageCode?: string | null;
  metaLayout?: 'inline' | 'stacked';
};

export function ReflectionBody({
  authorName,
  body,
  collapsible = false,
  createdAt,
  fallbackDirection,
  metaLayout = 'inline',
  postId,
  translatedFromLanguageCode,
}: ReflectionBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const normalizedBody = body.trim();
  const direction = detectTextDirection(normalizedBody, fallbackDirection);
  const shouldCollapse = collapsible && normalizedBody.length > 420;
  const metaItems = [
    authorName?.trim() ? `By ${authorName.trim()}` : null,
    formatReflectionDate(createdAt),
    translatedFromLanguageCode
      ? `Translated from ${translatedFromLanguageCode.toUpperCase()}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className={metaLayout === 'stacked' ? 'mt-3' : undefined}>
      <p
        className={`whitespace-pre-line text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
          direction,
        )} ${!expanded && shouldCollapse ? 'line-clamp-6' : ''}`}
        dir={direction}
      >
        {normalizedBody}
      </p>

      {shouldCollapse ? (
        <button
          className="mt-3 text-sm font-medium text-(--accent-strong) underline decoration-(--underline-strong) underline-offset-4"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Show less' : 'Continue reading'}
        </button>
      ) : null}

      {metaLayout === 'inline' ? (
        metaItems.length > 0 || postId ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--ink-soft)">
            {metaItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
            {postId ? (
              <a
                className="underline decoration-(--underline-soft) underline-offset-4 transition hover:text-(--ink-strong)"
                href={`https://quranreflect.com/posts/${postId}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                Read on QuranReflect.com
              </a>
            ) : null}
          </div>
        ) : null
      ) : postId ? (
        <a
          className="mt-3 inline-block text-xs text-(--ink-soft) underline decoration-(--underline-soft) underline-offset-4 transition hover:text-(--ink-strong)"
          href={`https://quranreflect.com/posts/${postId}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Read on QuranReflect.com
        </a>
      ) : null}
    </div>
  );
}

function formatReflectionDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
