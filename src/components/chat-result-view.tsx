'use client';

import Script from 'next/script';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/toast';
import type { ApiResponse } from '@/lib/antidote-types';
import type { QfSessionSummary } from '@/lib/qf-user';
import {
  buildQuranEmbedUrl,
  detectTextDirection,
  getDirectionFromLanguageCode,
  getDirectionStyles,
  getSelectedReflectionEmbeds,
  getTranslationIdForLanguageCode,
  type TextDirection,
} from '@/lib/reflection-ui';

const APP_CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://sakinah.now';

type BookmarkState = {
  savedKeys: Record<string, boolean>;
  savingAction: 'add' | 'remove' | null;
  savingKey: string | null;
};

type NoteState = {
  body: string;
  error: string | null;
  isGenerating: boolean;
  isSaving: boolean;
  open: boolean;
};

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
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>({
    savedKeys: {},
    savingAction: null,
    savingKey: null,
  });
  const [noteState, setNoteState] = useState<NoteState>({
    body: '',
    error: null,
    isGenerating: false,
    isSaving: false,
    open: false,
  });
  const [noteSaved, setNoteSaved] = useState(false);

  const loginHref = `${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(chatPath)}`;

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

  useEffect(() => {
    if (!auth.isAuthenticated || selectedEmbeds.length === 0) {
      return;
    }

    let isCancelled = false;

    async function hydrateBookmarks() {
      try {
        const updates: Record<string, boolean> = {};

        await Promise.all(
          selectedEmbeds.map(async (embed) => {
            const response = await fetch(
              `/api/qf/bookmark?surahNo=${encodeURIComponent(
                embed.reference.chapterId,
              )}&ayahNo=${encodeURIComponent(embed.label.split(':')[1] ?? '')}`,
              {
                credentials: 'include',
              },
            );
            const payload = (await response.json()) as {
              bookmarkIdsByVerseNumber?: Record<number, string>;
              error?: string;
            };

            if (!response.ok) {
              throw new Error(payload.error || 'Could not load bookmark state.');
            }

            updates[embed.label] =
              Boolean(payload.bookmarkIdsByVerseNumber) &&
              Object.keys(payload.bookmarkIdsByVerseNumber ?? {}).length > 0;
          }),
        );

        if (!isCancelled) {
          setBookmarkState((prev) => ({
            ...prev,
            savedKeys: {
              ...prev.savedKeys,
              ...updates,
            },
          }));
        }
      } catch {
        // ignore bookmark hydration failures in the UI shell
      }
    }

    hydrateBookmarks();

    return () => {
      isCancelled = true;
    };
  }, [auth.isAuthenticated, selectedEmbeds]);

  function handleConnectClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const nextUrl = new URL(chatPath, window.location.origin);
    nextUrl.searchParams.set('scrollTo', String(Math.round(window.scrollY)));

    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    window.location.assign(
      `${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(next)}`,
    );
  }

  async function handleBookmarkToggle(surahNo: number, ayahNo: string, key: string) {
    const isBookmarked = Boolean(bookmarkState.savedKeys[key]);
    setBookmarkState((prev) => ({
      ...prev,
      savingAction: isBookmarked ? 'remove' : 'add',
      savingKey: key,
    }));

    try {
      const response = await fetch('/api/qf/bookmark', {
        body: JSON.stringify({
          ayahNo,
          surahNo,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: isBookmarked ? 'DELETE' : 'POST',
      });
      const payload = (await response.json()) as {
        collectionName?: string;
        error?: string;
        removedCount?: number;
        savedCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not update the ayah bookmark.');
      }

      setBookmarkState((prev) => ({
        ...prev,
        savedKeys: {
          ...prev.savedKeys,
          [key]: !isBookmarked,
        },
        savingAction: null,
        savingKey: null,
      }));

      if (isBookmarked) {
        toast.success(
          `${payload.removedCount ?? 1} ayah removed from ${payload.collectionName ?? auth.collectionName}.`,
        );
      } else {
        toast.success(
          `${payload.savedCount ?? 1} ayah saved to ${payload.collectionName ?? auth.collectionName}.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the ayah.');
      setBookmarkState((prev) => ({
        ...prev,
        savingAction: null,
        savingKey: null,
      }));
    }
  }

  function buildNoteRangesFromReflection() {
    if (!result.selected_reflection?.reflection) {
      return [];
    }

    const references = result.selected_reflection.reflection.references;

    if (references.length > 0) {
      return references
        .filter((ref) => ref.from >= 1 && ref.to >= 1)
        .map((ref) => `${ref.chapterId}:${ref.from}-${ref.chapterId}:${ref.to}`)
        .filter((range, index, items) => items.indexOf(range) === index);
    }

    const surahNo = result.selected_reflection.surah_no;
    const ayahNo = result.selected_reflection.ayah_no;
    const parts = ayahNo.split('-');
    const from = Number.parseInt(parts[0] ?? '0', 10);
    const to = Number.parseInt(parts[1] ?? parts[0] ?? '0', 10);

    if (from >= 1 && to >= 1) {
      return [`${surahNo}:${from}-${surahNo}:${to}`];
    }

    return [];
  }

  async function handleNoteDraftGenerate() {
    setNoteState((prev) => ({ ...prev, body: '', error: null, isGenerating: true }));

    try {
      const response = await fetch('/api/qf/note/draft', {
        body: JSON.stringify({
          diagnosis: result.diagnosis,
          eventContent,
          reflectionBody: result.selected_reflection?.reflection?.body ?? null,
          reflectionGuide: result.reflection_guide,
          selectedReflection: result.selected_reflection
            ? {
                authorName: result.selected_reflection.reflection?.authorName ?? null,
                ayahNo: result.selected_reflection.ayah_no,
                selectionReason: result.selected_reflection.selection_reason,
                surahName: result.selected_reflection.surah_name,
                surahNo: result.selected_reflection.surah_no,
              }
            : null,
          userFeeling,
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok || !response.body) {
        const payload = (await response
          .json()
          .catch(() => ({ error: 'Could not generate draft.' }))) as {
          error?: string;
        };
        throw new Error(payload.error || 'Could not generate draft.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let nextBody = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        nextBody += decoder.decode(value, { stream: true });
        setNoteState((prev) => ({ ...prev, body: nextBody }));
      }

      setNoteState((prev) => ({ ...prev, isGenerating: false }));
    } catch (error) {
      setNoteState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Could not generate draft.',
        isGenerating: false,
      }));
    }
  }

  async function handleNoteSave() {
    if (!noteState.body.trim() || noteState.body.trim().length < 6) {
      setNoteState((prev) => ({
        ...prev,
        error: 'Note must be at least 6 characters long.',
      }));
      return;
    }

    setNoteState((prev) => ({ ...prev, error: null, isSaving: true }));

    try {
      const attachedEntities = result.selected_reflection?.reflection
        ? [
            {
              entityId: String(result.selected_reflection.reflection.id),
              entityType: 'reflection' as const,
            },
          ]
        : [];

      const response = await fetch('/api/qf/note', {
        body: JSON.stringify({
          attachedEntities,
          body: noteState.body.trim(),
          ranges: buildNoteRangesFromReflection(),
        }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not save the note.');
      }

      setNoteState({
        body: '',
        error: null,
        isGenerating: false,
        isSaving: false,
        open: false,
      });
      setNoteSaved(true);
      toast.success('Note saved to your Quran Foundation account.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the note.';
      setNoteState((prev) => ({
        ...prev,
        error: message,
        isSaving: false,
      }));
      toast.error(message);
    }
  }

  if (!result.selected_reflection?.reflection) {
    return (
      <div className="rounded-[2rem] border border-dashed border-(--line) bg-white/70 p-8 text-sm leading-7 text-(--ink-soft)">
        No reflection could be selected for this request.
      </div>
    );
  }

  return (
    <>
      <Script defer src="https://quran.com/widget/embed-widget.js" strategy="afterInteractive" />

      {/* AI response bubble */}
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-[rgba(63,63,70,0.15)] bg-[rgba(244,244,245,0.7)] px-5 py-5 sm:max-w-[75%] sm:px-6">
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

          <div className="border-t border-[rgba(63,63,70,0.08)] pt-4">
            <div>
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
          </div>

          {selectedEmbeds.length > 1 ? (
            <details className="rounded-xl border border-[rgba(63,63,70,0.08)] bg-white/70 p-3 text-sm text-(--ink-soft)">
              <summary className="cursor-pointer font-medium text-(--ink-strong)">
                Show referenced ayahs ({selectedEmbeds.length})
              </summary>
              <div className="mt-3 space-y-4">
                {selectedEmbeds.map((embed) => (
                  <div
                    className="relative overflow-hidden rounded-xl border border-[rgba(63,63,70,0.08)] bg-white]"
                    key={embed.label}
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[70px] items-center justify-end pr-[9.5rem]">
                      {auth.isAuthenticated ? (
                        <button
                          aria-label={
                            bookmarkState.savedKeys[embed.label]
                              ? 'Remove bookmark'
                              : 'Bookmark ayah'
                          }
                          className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] cursor-pointer items-center justify-center rounded-xl border border-[rgba(63,63,70,0.1)] bg-white/92 text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(63,63,70,0.25)] border-t-[rgba(63,63,70,0.7)]" />
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
                          className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] items-center justify-center rounded-xl border border-[rgba(63,63,70,0.1)] bg-white/92 text-(--ink-soft) transition hover:bg-white"
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
                    <iframe
                      allow="clipboard-write"
                      className="block w-full bg-white"
                      data-quran-embed="true"
                      frameBorder="0"
                      loading="lazy"
                      src={buildQuranEmbedUrl(
                        embed.reference.chapterId,
                        embed.label.split(':')[1] ?? '',
                        translationId,
                      )}
                      title={`Quran passage ${embed.label}`}
                      width="100%"
                    />
                  </div>
                ))}
              </div>
            </details>
          ) : selectedEmbeds.length === 1 ? (
            <div className="relative overflow-hidden rounded-xl border border-[rgba(63,63,70,0.08)] bg-white shadow-[0_2px_8px_rgba(24,24,27,0.04)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-[70px] items-center justify-end pr-[9.5rem]">
                {auth.isAuthenticated ? (
                  <button
                    aria-label={
                      bookmarkState.savedKeys[selectedEmbeds[0].label]
                        ? 'Remove bookmark'
                        : 'Bookmark ayah'
                    }
                    className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] cursor-pointer items-center justify-center rounded-xl border border-[rgba(63,63,70,0.1)] bg-white/92 text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(63,63,70,0.25)] border-t-[rgba(63,63,70,0.7)]" />
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill={
                          bookmarkState.savedKeys[selectedEmbeds[0].label] ? 'currentColor' : 'none'
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
                    className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] items-center justify-center rounded-xl border border-[rgba(63,63,70,0.1)] bg-white/92 text-(--ink-soft) transition hover:bg-white"
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
              <iframe
                allow="clipboard-write"
                className="block w-full bg-white"
                data-quran-embed="true"
                frameBorder="0"
                loading="lazy"
                src={buildQuranEmbedUrl(
                  selectedEmbeds[0].reference.chapterId,
                  selectedEmbeds[0].label.split(':')[1] ?? '',
                  translationId,
                )}
                title={`Quran passage ${selectedEmbeds[0].label}`}
                width="100%"
              />
            </div>
          ) : null}

          {result.reflection_guide ? (
            <div className="border-t border-[rgba(63,63,70,0.08)] pt-4">
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
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(63,63,70,0.1)] bg-white/80 px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
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
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(63,63,70,0.1)] bg-white/80 px-4 py-2 text-xs font-medium text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
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
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[rgba(244,244,245,0.7)] px-5 py-4 sm:max-w-[75%]">
          <p className="text-sm leading-7 text-(--ink-strong)">
            Your note has been saved to your Quran Foundation account.
          </p>
        </div>
      ) : null}

      {noteState.open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.4)] p-4"
          onClick={(overlayEvent) => {
            if (overlayEvent.target === overlayEvent.currentTarget && !noteState.isSaving) {
              setNoteState((prev) => ({ ...prev, open: false }));
            }
          }}
        >
          <div className="flex w-full max-w-2xl flex-col rounded-[1.8rem] border border-(--line) bg-white p-6 shadow-[0_24px_80px_rgba(24,24,27,0.16)] sm:p-8">
            <h2 className="text-lg font-semibold text-(--ink-strong)">Save a note</h2>
            <p className="mt-1 text-sm leading-7 text-(--ink-soft)">
              This note will be saved to your Quran Foundation account.
            </p>
            <div className="relative mt-4">
              <textarea
                className="min-h-64 w-full rounded-[1.4rem] border border-(--line) bg-[rgba(244,244,245,0.5)] px-5 py-4 pb-14 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)] sm:min-h-80"
                disabled={noteState.isSaving || noteState.isGenerating}
                onChange={(inputEvent) =>
                  setNoteState((prev) => ({
                    ...prev,
                    body: inputEvent.target.value,
                    error: null,
                  }))
                }
                placeholder="Write your personal note here..."
                value={noteState.body}
              />
              <div className="absolute bottom-3 left-3">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-white/90 px-3.5 py-1.5 text-xs font-medium text-(--ink-soft) shadow-sm transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={noteState.isSaving || noteState.isGenerating}
                  onClick={handleNoteDraftGenerate}
                  type="button"
                >
                  {noteState.isGenerating ? 'Drafting...' : 'Generate draft'}
                </button>
              </div>
            </div>
            {noteState.error ? (
              <p className="mt-2 text-sm text-[rgb(146,64,14)]">{noteState.error}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-3">
              <button
                className="inline-flex items-center justify-center rounded-full border border-(--line) px-5 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.72)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={noteState.isSaving || noteState.isGenerating}
                onClick={() => setNoteState((prev) => ({ ...prev, open: false }))}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center rounded-full bg-(--accent-strong) px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  noteState.isSaving || noteState.isGenerating || noteState.body.trim().length < 6
                }
                onClick={handleNoteSave}
                type="button"
              >
                {noteState.isSaving ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ReflectionBody({
  authorName,
  body,
  createdAt,
  fallbackDirection,
  postId,
  translatedFromLanguageCode,
}: {
  authorName?: string | null;
  body: string;
  createdAt?: string | null;
  fallbackDirection: TextDirection;
  postId?: number;
  translatedFromLanguageCode?: string | null;
}) {
  const normalizedBody = body.trim();
  const direction = detectTextDirection(normalizedBody, fallbackDirection);
  const metaItems = [
    authorName?.trim() ? `By ${authorName.trim()}` : null,
    formatReflectionDate(createdAt),
    translatedFromLanguageCode
      ? `Translated from ${translatedFromLanguageCode.toUpperCase()}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div>
      <p
        className={`whitespace-pre-line text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
          direction,
        )}`}
        dir={direction}
      >
        {normalizedBody}
      </p>

      {metaItems.length > 0 || postId ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--ink-soft)">
          {metaItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
          {postId ? (
            <a
              className="underline decoration-[rgba(82,82,91,0.25)] underline-offset-4 transition hover:text-(--ink-strong)"
              href={`https://quranreflect.com/posts/${postId}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              Read on QuranReflect.com
            </a>
          ) : null}
        </div>
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
