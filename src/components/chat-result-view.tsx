'use client';

import Script from 'next/script';
import { useEffect, useMemo } from 'react';
import { QuranEmbedCard } from '@/components/reflection/quran-embed-card';
import { ReflectionBody } from '@/components/reflection/reflection-body';
import { SaveNoteModal } from '@/components/reflection/save-note-modal';
import { useToast } from '@/components/toast';
import type { ApiResponse } from '@/lib/antidote-types';
import { useQfBookmarks } from '@/hooks/use-qf-bookmarks';
import { useQfNoteComposer } from '@/hooks/use-qf-note-composer';
import type { QfSessionSummary } from '@/lib/qf-user';
import {
  detectTextDirection,
  getDirectionFromLanguageCode,
  getDirectionStyles,
  getSelectedReflectionEmbeds,
  getTranslationIdForLanguageCode,
  type TextDirection,
} from '@/lib/reflection-ui';

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
  const { noteSaved, noteState, setNoteState, handleNoteDraftGenerate, handleNoteSave } =
    useQfNoteComposer({
      eventContent,
      result,
      toast,
      userFeeling,
    });

  if (!result.selected_reflection?.reflection) {
    return (
      <div className="rounded-[2rem] border border-dashed border-(--line) bg-[var(--surface-card-soft)] p-8 text-sm leading-7 text-(--ink-soft)">
        No reflection could be selected for this request.
      </div>
    );
  }

  return (
    <>
      <Script defer src="https://quran.com/widget/embed-widget.js" strategy="afterInteractive" />

      {/* AI response bubble */}
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border-strong)] bg-[var(--surface-subtle-soft)] px-5 py-5 sm:max-w-[75%] sm:px-6">
        <div className="space-y-6">
          {result.reflection_guide ? (
            <p
              className={`text-base leading-8 text-(--ink-strong) ${getDirectionStyles(
                detectTextDirection(result.reflection_guide.intro_text, outputFallbackDirection),
              )}`}
              dir={detectTextDirection(result.reflection_guide.intro_text, outputFallbackDirection)}
            >
              {result.reflection_guide.intro_text}
            </p>
          ) : null}

          <div className="border-t border-[var(--border-subtle)] pt-4">
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

          {selectedEmbeds.length > 1 ? (
            <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card-soft)] p-3 text-sm text-(--ink-soft)">
              <summary className="cursor-pointer font-medium text-(--ink-strong)">
                Show referenced ayahs ({selectedEmbeds.length})
              </summary>
              <div className="mt-3 space-y-4">
                {selectedEmbeds.map((embed) => (
                  <QuranEmbedCard
                    ayahNo={embed.label.split(':')[1] ?? ''}
                    containerClassName="rounded-xl border border-[var(--border-subtle)] bg-white"
                    frameClassName="rounded-xl bg-white"
                    key={embed.label}
                    label={embed.label}
                    overlayAction={
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[70px] items-center justify-end pr-[9.5rem]">
                        {auth.isAuthenticated ? (
                          <button
                            aria-label={
                              bookmarkState.savedKeys[embed.label]
                                ? 'Remove bookmark'
                                : 'Bookmark ayah'
                            }
                            className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] cursor-pointer items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card-strong)] text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={bookmarkState.savingKey === embed.label}
                            onClick={() =>
                              handleBookmarkToggle(
                                embed.reference.chapterId,
                                embed.label.split(':')[1] ?? '',
                                embed.label,
                              )
                            }
                            type="button"
                          >
                            {bookmarkState.savingKey === embed.label ? (
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(63,63,70,0.25)] border-t-[var(--accent)]" />
                            ) : (
                              <svg
                                className="h-4 w-4"
                                fill={bookmarkState.savedKeys[embed.label] ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.8"
                                viewBox="0 0 24 24"
                              >
                                <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <a
                            aria-label="Connect to bookmark"
                            className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card-strong)] text-(--ink-soft) transition hover:bg-white"
                            href={loginHref}
                            onClick={handleConnectClick}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.8"
                              viewBox="0 0 24 24"
                            >
                              <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    }
                    overlayClassName="pointer-events-none absolute inset-x-0 top-0 z-10"
                    surahNo={embed.reference.chapterId}
                    translationId={translationId}
                  />
                ))}
              </div>
            </details>
          ) : selectedEmbeds.length === 1 ? (
            <QuranEmbedCard
              ayahNo={selectedEmbeds[0].label.split(':')[1] ?? ''}
              containerClassName="rounded-xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card-sm)]"
              frameClassName="rounded-xl bg-white"
              label={selectedEmbeds[0].label}
              overlayAction={
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[70px] items-center justify-end pr-[9.5rem]">
                  {auth.isAuthenticated ? (
                    <button
                      aria-label={
                        bookmarkState.savedKeys[selectedEmbeds[0].label]
                          ? 'Remove bookmark'
                          : 'Bookmark ayah'
                      }
                      className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] cursor-pointer items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card-strong)] text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={bookmarkState.savingKey === selectedEmbeds[0].label}
                      onClick={() =>
                        handleBookmarkToggle(
                          selectedEmbeds[0].reference.chapterId,
                          selectedEmbeds[0].label.split(':')[1] ?? '',
                          selectedEmbeds[0].label,
                        )
                      }
                      type="button"
                    >
                      {bookmarkState.savingKey === selectedEmbeds[0].label ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(63,63,70,0.25)] border-t-[var(--accent)]" />
                      ) : (
                        <svg
                          className="h-4 w-4"
                          fill={
                            bookmarkState.savedKeys[selectedEmbeds[0].label]
                              ? 'currentColor'
                              : 'none'
                          }
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <a
                      aria-label="Connect to bookmark"
                      className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] items-center justify-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface-card-strong)] text-(--ink-soft) transition hover:bg-white"
                      href={loginHref}
                      onClick={handleConnectClick}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
                      </svg>
                    </a>
                  )}
                </div>
              }
              overlayClassName="pointer-events-none absolute inset-x-0 top-0 z-10"
              surahNo={selectedEmbeds[0].reference.chapterId}
              translationId={translationId}
            />
          ) : null}

          {result.reflection_guide ? (
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <p
                className={`text-base leading-8 text-(--ink-strong) ${getDirectionStyles(
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

      {/* Action buttons — outside the bubble */}
      <div className="flex gap-3 pl-2">
        {auth.isAuthenticated ? (
          <button
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
            onClick={() =>
              setNoteState({
                body: '',
                error: null,
                isGenerating: false,
                isSaving: false,
                open: true,
              })
            }
            type="button"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Save as note to Quran.com
          </button>
        ) : (
          <a
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
            href={loginHref}
            onClick={handleConnectClick}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Connect to save as a note
          </a>
        )}
      </div>

      {/* Note saved success message */}
      {noteSaved ? (
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--surface-subtle-soft)] px-5 py-4 sm:max-w-[75%]">
          <p className="text-sm leading-7 text-(--ink-strong)">
            Your note has been saved to your Quran Foundation account.
          </p>
        </div>
      ) : null}

      <SaveNoteModal
        body={noteState.body}
        description="This note will be saved to your Quran Foundation account."
        error={noteState.error}
        isGenerating={noteState.isGenerating}
        isOpen={noteState.open}
        isSaving={noteState.isSaving}
        onBodyChange={(body) =>
          setNoteState((prev) => ({
            ...prev,
            body,
            error: null,
          }))
        }
        onClose={() => setNoteState((prev) => ({ ...prev, open: false }))}
        onGenerateDraft={handleNoteDraftGenerate}
        onSave={handleNoteSave}
        placeholder="Write your personal note here..."
        title="Save a note"
      />
    </>
  );
}
