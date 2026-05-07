'use client';

import type { ReactNode } from 'react';
import { ReflectionBody } from '@/components/reflection/reflection-body';
import type { ApiResponse } from '@/lib/shared/antidotes/api-types';
import { detectTextDirection, getDirectionStyles, type TextDirection } from '@/lib/shared/reflection/ui';

export function ReflectionResultBubble({
  children,
  outputFallbackDirection,
  result,
}: {
  children: ReactNode;
  outputFallbackDirection: TextDirection;
  result: ApiResponse;
}) {
  if (!result.selected_reflection?.reflection) {
    return null;
  }

  return (
    <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-(--border-strong) bg-(--surface-subtle-soft) px-5 py-5 sm:max-w-[75%] sm:px-6">
      <div className="space-y-6">
        {result.reflection_guide ? (
          <p
            className={`text-sm leading-8 text-(--ink-strong) ${getDirectionStyles(
              detectTextDirection(result.reflection_guide.intro_text, outputFallbackDirection),
            )}`}
            dir={detectTextDirection(result.reflection_guide.intro_text, outputFallbackDirection)}
          >
            {result.reflection_guide.intro_text}
          </p>
        ) : null}

        <div className="border-t border-(--border-subtle) pt-4">
          <ReflectionBody
            authorName={result.selected_reflection.reflection.authorName}
            body={result.selected_reflection.reflection.body}
            createdAt={result.selected_reflection.reflection.createdAt}
            fallbackDirection={outputFallbackDirection}
            postId={result.selected_reflection.reflection.id}
            translatedFromLanguageCode={
              result.selected_reflection.reflection_is_translated
                ? result.selected_reflection.reflection_source_language_code
                : null
            }
          />
        </div>

        {children}

        {result.reflection_guide ? (
          <div className="border-t border-(--border-subtle) pt-4">
            <p
              className={`text-sm leading-8 text-(--ink-strong) ${getDirectionStyles(
                detectTextDirection(
                  result.reflection_guide.conclusion_text,
                  outputFallbackDirection,
                ),
              )}`}
              dir={detectTextDirection(
                result.reflection_guide.conclusion_text,
                outputFallbackDirection,
              )}
            >
              {result.reflection_guide.conclusion_text}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
