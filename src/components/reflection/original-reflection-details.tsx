'use client';

import {
  detectTextDirection,
  getDirectionStyles,
  type TextDirection,
} from '@/lib/reflection-ui';

export function OriginalReflectionDetails({
  body,
  fallbackDirection,
}: {
  body: string;
  fallbackDirection: TextDirection;
}) {
  const direction = detectTextDirection(body, fallbackDirection);

  return (
    <details className="mt-4 rounded-2xl border border-(--line) bg-(--surface-card-soft) p-3 text-sm text-(--ink-soft)">
      <summary className="cursor-pointer font-medium text-(--ink-strong)">
        Show original reflection text
      </summary>
      <p
        className={`mt-3 whitespace-pre-line leading-7 ${getDirectionStyles(direction)}`}
        dir={direction}
      >
        {body}
      </p>
    </details>
  );
}
