'use client';

import Script from 'next/script';
import { useEffect, useMemo } from 'react';
import { useToast } from '@/components/toast';
import type { ApiResponse } from '@/lib/shared/antidotes/api-types';
import { useQfBookmarks } from '@/hooks/use-qf-bookmarks';
import { useQfNoteComposer } from '@/hooks/use-qf-note-composer';
import type { QfSessionSummary } from '@/lib/shared/qf/types';
import {
  getDirectionFromLanguageCode,
  getSelectedReflectionEmbeds,
  getTranslationIdForLanguageCode,
  type TextDirection,
} from '@/lib/shared/reflection/ui';
import { ReflectionEmbedSection } from './reflection-embed-section';
import { ReflectionResultActions } from './reflection-result-actions';
import { ReflectionResultBubble } from './reflection-result-bubble';

export function ChatResultView({
  auth,
  chatPath,
  eventContent,
  result,
  userFeeling,
}: {
  auth: QfSessionSummary;
  chatPath: string;
  eventContent: string;
  result: ApiResponse;
  userFeeling: string;
}) {
  const toast = useToast();

  useEffect(() => {
    if (!auth.isAuthenticated) {
      return;
    }

    const url = new URL(window.location.href);
    const rawScrollTo = url.searchParams.get('scrollTo');

    if (!rawScrollTo) {
      return;
    }

    const scrollTo = Number.parseInt(rawScrollTo, 10);
    if (Number.isFinite(scrollTo)) {
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollTo,
        });
      });
    }

    url.searchParams.delete('scrollTo');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [auth.isAuthenticated]);

  const selectedEmbeds = useMemo(
    () =>
      result.selected_reflection ? getSelectedReflectionEmbeds(result.selected_reflection) : [],
    [result.selected_reflection],
  );
  const translationId = useMemo(
    () => getTranslationIdForLanguageCode(result.detected_language_code),
    [result.detected_language_code],
  );
  const outputFallbackDirection = useMemo<TextDirection>(
    () => getDirectionFromLanguageCode(result.detected_language_code),
    [result.detected_language_code],
  );
  const { bookmarkState, handleBookmarkToggle, handleConnectClick, loginHref } = useQfBookmarks({
    auth,
    chatPath,
    selectedEmbeds,
    toast,
  });
  const { noteState, setNoteState, handleNoteDraftGenerate, handleNoteSave } = useQfNoteComposer({
    eventContent,
    result,
    toast,
    userFeeling,
  });

  if (!result.selected_reflection?.reflection) {
    return (
      <div className="rounded-4xl border border-dashed border-(--line) bg-(--surface-card-soft) p-8 text-sm leading-7 text-(--ink-soft)">
        No reflection could be selected for this request.
      </div>
    );
  }

  return (
    <>
      <Script defer src="https://quran.com/widget/embed-widget.js" strategy="afterInteractive" />

      <ReflectionResultBubble outputFallbackDirection={outputFallbackDirection} result={result}>
        <ReflectionEmbedSection
          auth={auth}
          bookmarkState={bookmarkState}
          handleBookmarkToggle={handleBookmarkToggle}
          handleConnectClick={handleConnectClick}
          loginHref={loginHref}
          selectedEmbeds={selectedEmbeds}
          translationId={translationId}
        />
      </ReflectionResultBubble>

      <ReflectionResultActions
        handleConnectClick={handleConnectClick}
        handleNoteDraftGenerate={handleNoteDraftGenerate}
        handleNoteSave={handleNoteSave}
        isAuthenticated={auth.isAuthenticated}
        loginHref={loginHref}
        noteState={noteState}
        setNoteState={setNoteState}
      />
    </>
  );
}
