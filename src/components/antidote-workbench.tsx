'use client';

import Image from 'next/image';
import Script from 'next/script';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { OriginalReflectionDetails } from '@/components/reflection/original-reflection-details';
import { QuranEmbedCard } from '@/components/reflection/quran-embed-card';
import { ReflectionBody } from '@/components/reflection/reflection-body';
import { SaveNoteModal } from '@/components/reflection/save-note-modal';
import { useToast } from '@/components/toast';
import type { ApiResponse } from '@/lib/antidote-types';
import { requestAntidoteStream } from '@/lib/antidotes/browser';
import {
  HERO_HIDDEN_STORAGE_KEY,
  PENDING_SESSION_STORAGE_KEY,
} from '@/lib/app-constants';
import {
  buildQfLoginHref,
  buildQfNoteDraftPayload,
  fetchQfBookmarkStates,
  saveQfNote,
  streamQfNoteDraft,
  toggleQfBookmark,
} from '@/lib/qf-browser';
import type { QfSessionSummary } from '@/lib/qf-user';
import {
  detectTextDirection,
  getDirectionFromLanguageCode,
  getDirectionStyles,
  getSelectedReflectionEmbeds,
  getTranslationIdForLanguageCode,
  type TextDirection,
} from '@/lib/reflection-ui';
import { revalidateSidebarNotes } from '@/lib/sidebar-notes-store';
import { revalidateSidebarBookmarks } from '@/lib/sidebar-bookmarks-store';

type BookmarkState = {
  error: string | null;
  savedKeys: Record<string, boolean>;
  savingAction: 'add' | 'remove' | null;
  savingKey: string | null;
  success: string | null;
};

type NoteState = {
  body: string;
  error: string | null;
  isGenerating: boolean;
  isSaving: boolean;
  open: boolean;
  success: string | null;
};

const starterEvent =
  'I spent an hour scrolling success clips and luxury posts. By the end, I felt like my worth depended on being seen, praised, and always ahead.';
const starterFeeling = 'I feel unsettled, heavy, and disconnected from gratitude.';
type PendingSession = {
  eventContent: string;
  result: ApiResponse;
  scrollY?: number;
  userFeeling: string;
};

const LOADING_STEPS = [
  { key: 'language_detection', label: 'Detecting your input language' },
  { key: 'ayah_selection', label: 'Selecting grounding ayahs' },
  { key: 'reflection_fetch', label: 'Collecting relevant reflections' },
  { key: 'reflection_curation', label: 'Curating the strongest match' },
  { key: 'reflection_translation', label: 'Aligning reflection language' },
  { key: 'guide_generation', label: 'Preparing your guided reading' },
] as const;

type PipelineStepKey = (typeof LOADING_STEPS)[number]['key'];
type PipelineStepStatus = 'completed' | 'in_progress' | 'pending';

function createInitialLoadingStepStatus(): Record<PipelineStepKey, PipelineStepStatus> {
  return {
    ayah_selection: 'pending',
    guide_generation: 'pending',
    language_detection: 'pending',
    reflection_curation: 'pending',
    reflection_fetch: 'pending',
    reflection_translation: 'pending',
  };
}

export default function AntidoteWorkbench({ initialAuth }: { initialAuth: QfSessionSummary }) {
  const [eventContent, setEventContent] = useState(starterEvent);
  const [userFeeling, setUserFeeling] = useState(starterFeeling);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [loadingStepStatus, setLoadingStepStatus] = useState<
    Record<PipelineStepKey, PipelineStepStatus>
  >(() => createInitialLoadingStepStatus());
  const [authState] = useState(initialAuth);
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>({
    error: null,
    savedKeys: {},
    savingAction: null,
    savingKey: null,
    success: null,
  });
  const [noteState, setNoteState] = useState<NoteState>({
    body: '',
    error: null,
    isGenerating: false,
    isSaving: false,
    open: false,
    success: null,
  });
  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_SESSION_STORAGE_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_SESSION_STORAGE_KEY);
      const session = JSON.parse(raw) as PendingSession;
      setEventContent(session.eventContent);
      setUserFeeling(session.userFeeling);
      setResult(session.result);
      if (typeof session.scrollY === 'number') {
        pendingScrollRef.current = session.scrollY;
      }
    } catch {
      // ignore malformed data
    }
  }, []);

  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && result) {
      window.scrollTo(0, pendingScrollRef.current);
      pendingScrollRef.current = null;
    }
  }, [result]);

  useEffect(() => {
    try {
      if (localStorage.getItem(HERO_HIDDEN_STORAGE_KEY) === 'true') {
        setIsHeroVisible(false);
      }
    } catch {
      // ignore localStorage failures
    }
  }, []);

  function saveSessionBeforeNav() {
    try {
      if (result) {
        sessionStorage.setItem(
          PENDING_SESSION_STORAGE_KEY,
          JSON.stringify({ eventContent, result, scrollY: window.scrollY, userFeeling }),
        );
      }
    } catch {
      // storage may be unavailable
    }
  }

  const selectedEmbeds = useMemo(
    () => (result?.selected_reflection ? getSelectedReflectionEmbeds(result.selected_reflection) : []),
    [result],
  );

  const translationId = useMemo(
    () => getTranslationIdForLanguageCode(result?.detected_language_code),
    [result?.detected_language_code],
  );
  const outputFallbackDirection = useMemo<TextDirection>(
    () => getDirectionFromLanguageCode(result?.detected_language_code),
    [result?.detected_language_code],
  );
  const eventDirection = useMemo<TextDirection>(
    () => detectTextDirection(eventContent, 'ltr'),
    [eventContent],
  );
  const feelingDirection = useMemo<TextDirection>(
    () => detectTextDirection(userFeeling, 'ltr'),
    [userFeeling],
  );
  const noteBodyDirection = useMemo<TextDirection>(
    () => detectTextDirection(noteState.body, outputFallbackDirection),
    [noteState.body, outputFallbackDirection],
  );
  const noteFeedbackDirection = useMemo<TextDirection>(
    () => detectTextDirection(noteState.error, noteBodyDirection),
    [noteState.error, noteBodyDirection],
  );

  useEffect(() => {
    if (!authState.isAuthenticated) {
      return;
    }

    if (!result) {
      return;
    }

    let isCancelled = false;

    async function hydrateBookmarks() {
      try {
        const updates = await fetchQfBookmarkStates(selectedEmbeds);

        if (isCancelled) {
          return;
        }

        setBookmarkState((prev) => ({
          ...prev,
          savedKeys: {
            ...prev.savedKeys,
            ...updates,
          },
        }));
      } catch (hydrateError) {
        if (isCancelled) {
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('[qf-bookmark]', 'hydrate failed', hydrateError);
        }
      }
    }

    hydrateBookmarks();

    return () => {
      isCancelled = true;
    };
  }, [authState.isAuthenticated, result, selectedEmbeds]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setLoadingStepStatus(createInitialLoadingStepStatus());
    setResult(null);

    try {
      const finalResult = await requestAntidoteStream(
        {
          eventContent,
          userFeeling,
        },
        {
          onStep: (pipelineEvent) => {
            setLoadingStepStatus((prev) => ({
              ...prev,
              [pipelineEvent.step]: pipelineEvent.status,
            }));
          },
        },
      );

      setLoadingStepStatus(() => ({
        ayah_selection: 'completed',
        guide_generation: 'completed',
        language_detection: 'completed',
        reflection_curation: 'completed',
        reflection_fetch: 'completed',
        reflection_translation: 'completed',
      }));
      setResult(finalResult);
    } catch (submissionError) {
      setResult(null);
      setError(
        submissionError instanceof Error ? submissionError.message : 'Unexpected request error.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNoteDraftGenerate() {
    setNoteState((prev) => ({ ...prev, body: '', error: null, isGenerating: true }));

    try {
      await streamQfNoteDraft(
        buildQfNoteDraftPayload({
          eventContent,
          result: {
            diagnosis: result?.diagnosis ?? null,
            reflection_guide: result?.reflection_guide ?? null,
            selected_reflection: result?.selected_reflection ?? null,
          } as Pick<ApiResponse, 'diagnosis' | 'reflection_guide' | 'selected_reflection'>,
          userFeeling,
        }),
        {
          onChunk: (text) => {
            setNoteState((prev) => ({ ...prev, body: text }));
          },
        },
      );

      setNoteState((prev) => ({ ...prev, isGenerating: false }));
    } catch (draftError) {
      setNoteState((prev) => ({
        ...prev,
        error: draftError instanceof Error ? draftError.message : 'Could not generate draft.',
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

    setNoteState((prev) => ({ ...prev, error: null, isSaving: true, success: null }));

    try {
      await saveQfNote({
        body: noteState.body.trim(),
        selectedReflection: result?.selected_reflection ?? null,
      });

      setNoteState({
        body: '',
        error: null,
        isGenerating: false,
        isSaving: false,
        open: false,
        success: null,
      });
      void revalidateSidebarNotes();
      toast.success('Note saved to your Quran Foundation account.');
    } catch (noteError) {
      const message = noteError instanceof Error ? noteError.message : 'Could not save the note.';
      setNoteState((prev) => ({
        ...prev,
        error: message,
        isSaving: false,
      }));
      toast.error(message);
    }
  }

  async function handleBookmarkToggle(surahNo: number, ayahNo: string, key: string) {
    const isBookmarked = Boolean(bookmarkState.savedKeys[key]);
    setBookmarkState({
      error: null,
      savedKeys: bookmarkState.savedKeys,
      savingAction: isBookmarked ? 'remove' : 'add',
      savingKey: key,
      success: null,
    });

    try {
      const payload = await toggleQfBookmark({
        ayahNo,
        isBookmarked,
        surahNo,
      });

      void revalidateSidebarBookmarks();

      setBookmarkState((prev) => {
        const nextSavedKeys = {
          ...prev.savedKeys,
          [key]: !isBookmarked,
        };

        if (isBookmarked) {
          const removedCount = payload.removedCount ?? 1;
          toast.success(
            `${removedCount === 1 ? '1 ayah removed' : `${removedCount} ayahs removed`} from ${payload.collectionName ?? authState.collectionName}.`,
          );
          return {
            error: null,
            savedKeys: nextSavedKeys,
            savingAction: null,
            savingKey: null,
            success: null,
          };
        }

        const savedCount = payload.savedCount ?? 1;
        toast.success(
          `${savedCount === 1 ? '1 ayah saved' : `${savedCount} ayahs saved`} to ${payload.collectionName ?? authState.collectionName}.`,
        );
        return {
          error: null,
          savedKeys: nextSavedKeys,
          savingAction: null,
          savingKey: null,
          success: null,
        };
      });
    } catch (bookmarkError) {
      const message =
        bookmarkError instanceof Error ? bookmarkError.message : 'Could not save the ayah.';
      toast.error(message);
      setBookmarkState({
        error: null,
        savedKeys: bookmarkState.savedKeys,
        savingAction: null,
        savingKey: null,
        success: null,
      });
    }
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <Script defer src="https://quran.com/widget/embed-widget.js" strategy="afterInteractive" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="grid gap-8">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="rounded-[1.9rem] border border-[rgba(82,82,91,0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(244,244,245,0.86))] p-5 shadow-[0_16px_40px_rgba(24,24,27,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-3">
                  <span className="inline-flex w-fit items-center rounded-full border border-[rgba(82,82,91,0.12)] bg-white/70 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-(--accent-strong)">
                    Quran Foundation Sync
                  </span>
                  <div>
                    <p className="text-base font-semibold text-(--ink-strong)">
                      {authState.isAuthenticated
                        ? `Connected to Quran Foundation${authState.displayName ? ` as ${authState.displayName}` : ''}`
                        : `Connect Quran Foundation to save ayahs to your Sakinah collection`}
                    </p>
                    <p className="mt-1 max-w-2xl text-sm leading-7 text-(--ink-soft)">
                      {authState.isAuthenticated
                        ? `Saved ayahs will be stored in your ${authState.collectionName} collection.`
                        : 'Connect once to save each guided verse into a dedicated collection for your reflection journey.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-2xl border border-[rgba(82,82,91,0.1)] bg-white/70 px-4 py-3 text-sm text-(--ink-soft)">
                    <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-(--ink-soft)">
                      Status
                    </span>
                    <span className="mt-1 block font-semibold text-(--ink-strong)">
                      {authState.isAuthenticated ? 'Ready to save ayahs' : 'Not connected yet'}
                    </span>
                  </div>
                  {authState.isAuthenticated ? (
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-full border border-(--line) bg-white/72 px-5 py-2 text-sm font-medium text-(--ink-strong) transition hover:bg-white"
                      href="/api/qf/auth/logout"
                    >
                      Disconnect
                    </a>
                  ) : (
                    <a
                      className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--ink-strong) px-5 py-2 text-sm font-medium text-white transition hover:bg-(--accent)"
                      href={buildQfLoginHref('/')}
                      onClick={saveSessionBeforeNav}
                    >
                      Connect Account
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.92)] p-6 shadow-[0_18px_44px_rgba(24,24,27,0.06)] sm:p-8">
              <div className="space-y-5">
                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.18em] text-(--accent-strong)">
                    What happened today that affected your heart?
                  </span>
                  <textarea
                    className={`min-h-64 rounded-[1.6rem] border border-(--line) bg-white/80 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)] ${getDirectionStyles(eventDirection)}`}
                    dir={eventDirection}
                    onChange={(inputEvent) => setEventContent(inputEvent.target.value)}
                    placeholder="Describe the moment, post, conversation, or situation that pulled you off-center."
                    value={eventContent}
                  />
                </label>

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.18em] text-(--accent-strong)">
                    What is moving inside you right now?
                  </span>
                  <textarea
                    className={`min-h-32 rounded-[1.6rem] border border-(--line) bg-white/80 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)] ${getDirectionStyles(feelingDirection)}`}
                    dir={feelingDirection}
                    onChange={(inputEvent) => setUserFeeling(inputEvent.target.value)}
                    placeholder="Name the emotional and spiritual impact as honestly as you can."
                    value={userFeeling}
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-(--accent-strong) px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Listening and reflecting...
                      </>
                    ) : (
                      'Find Quranic grounding'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-4xl border border-[rgba(140,32,32,0.22)] bg-[rgba(140,32,32,0.08)] p-5 text-sm leading-7 text-[rgb(110,28,28)]">
                {error}
              </div>
            ) : null}
          </form>
        </section>

        <section className="flex flex-col gap-5">
          {isSubmitting ? (
            <LoadingReadingState stepStatus={loadingStepStatus} />
          ) : result ? (
            <div className="grid gap-4">
              {result.selected_reflection?.reflection ? (
                <section className="overflow-hidden rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.94)] shadow-[0_20px_64px_rgba(24,24,27,0.08)]">
                  <div className="grid gap-8 px-6 py-8 sm:px-8">
                    <article className="flex flex-col gap-8">
                      {result.reflection_guide ? (
                        <p
                          className={`text-lg leading-9 text-(--ink-strong) ${getDirectionStyles(
                            detectTextDirection(
                              result.reflection_guide.intro_text,
                              outputFallbackDirection,
                            ),
                          )}`}
                          dir={detectTextDirection(
                            result.reflection_guide.intro_text,
                            outputFallbackDirection,
                          )}
                        >
                          {result.reflection_guide.intro_text}
                        </p>
                      ) : null}

                      <div className="border-t border-(--line) pt-2">
                        {result.selected_reflection.reflection_is_translated ? (
                          <p className="text-xs uppercase tracking-[0.14em] text-(--ink-soft)">
                            Reflection translated from{' '}
                            {result.selected_reflection.reflection_source_language_code?.toUpperCase() ??
                              'source language'}
                          </p>
                        ) : null}
                        <div className="mt-5">
                          <ReflectionBody
                            body={result.selected_reflection.reflection.body}
                            fallbackDirection={outputFallbackDirection}
                            metaLayout="stacked"
                            postId={result.selected_reflection.reflection.id}
                          />
                        </div>
                        {result.selected_reflection.reflection_is_translated &&
                        result.selected_reflection.reflection_original_body ? (
                          <OriginalReflectionDetails
                            body={result.selected_reflection.reflection_original_body}
                            fallbackDirection={outputFallbackDirection}
                          />
                        ) : null}
                      </div>
                      {selectedEmbeds.map((embed) => (
                        <QuranEmbedCard
                          ayahNo={embed.label.split(':')[1] ?? ''}
                          containerClassName="overflow-hidden rounded-[1.6rem] border border-(--line) bg-white shadow-[0_12px_32px_rgba(24,24,27,0.06)]"
                          header={
                            <div className="border-b border-(--line) px-4 py-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-strong)">
                                  {embed.label}
                                </p>
                                {authState.isAuthenticated ? (
                                  <button
                                    className="inline-flex items-center justify-center rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.72)] disabled:cursor-not-allowed disabled:opacity-60"
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
                                    {bookmarkState.savingKey === embed.label
                                      ? bookmarkState.savingAction === 'remove'
                                        ? 'Removing...'
                                        : 'Bookmarking...'
                                      : bookmarkState.savedKeys[embed.label]
                                        ? 'Bookmarked'
                                        : `Bookmark ${embed.label} to '${authState.collectionName}' collection`}
                                  </button>
                                ) : (
                                  <a
                                    className="inline-flex items-center justify-center rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.72)]"
                                    href={buildQfLoginHref('/')}
                                    onClick={saveSessionBeforeNav}
                                  >
                                    Connect to Bookmark
                                  </a>
                                )}
                              </div>
                            </div>
                          }
                          key={embed.label}
                          label={embed.label}
                          surahNo={embed.reference.chapterId}
                          translationId={translationId}
                        />
                      ))}
                      {result.reflection_guide ? (
                        <div className="border-t border-(--line) pt-6">
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
                      <div className="flex">
                        {authState.isAuthenticated ? (
                          <button
                            className="inline-flex items-center justify-center rounded-full border border-(--line) bg-[rgba(244,244,245,0.72)] px-5 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-white"
                            onClick={() =>
                              setNoteState({
                                body: '',
                                error: null,
                                isGenerating: false,
                                isSaving: false,
                                open: true,
                                success: null,
                              })
                            }
                            type="button"
                          >
                            Save as Note
                          </button>
                        ) : (
                          <a
                            className="inline-flex items-center justify-center rounded-full border border-(--line) bg-[rgba(244,244,245,0.72)] px-5 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-white"
                            href={buildQfLoginHref('/')}
                            onClick={saveSessionBeforeNav}
                          >
                            Connect to Save as Note
                          </a>
                        )}
                      </div>
                    </article>
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <div className="rounded-4xl border border-dashed border-(--line) bg-[rgba(255,255,255,0.56)] p-8 text-base leading-8 text-(--ink-soft)">
              Your Sakinah reading will appear here after submission, with a selected reflection and
              the Quran passages that anchor it.
            </div>
          )}
        </section>
      </div>
      {isHeroVisible ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(18,18,20,0.36)] p-4 sm:p-6">
          <div className="hero-panel relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-4xl px-6 py-8 shadow-[0_24px_80px_rgba(24,24,27,0.2)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <button
              aria-label="Close intro"
              className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(82,82,91,0.14)] bg-white/80 text-xl leading-none text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong)"
              onClick={() => {
                setIsHeroVisible(false);
                try {
                  localStorage.setItem(HERO_HIDDEN_STORAGE_KEY, 'true');
                } catch {
                  // ignore localStorage failures
                }
              }}
              type="button"
            >
              ×
            </button>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-center">
              <div className="relative z-10 flex flex-col gap-6">
                <div className="space-y-4">
                  <div className="inline-flex w-fit items-center">
                    <div className="relative h-17 w-17 overflow-hidden rounded-full">
                      <Image
                        alt="Sakinah.now logo"
                        className="object-contain p-1.5"
                        fill
                        sizes="(max-width: 640px) 40px, 48px"
                        src="/LogoSakinah.now.png"
                      />
                    </div>
                    <div className="relative h-10 w-[170px] sm:h-10 sm:w-[230px] lg:w-[280px]">
                      <Image
                        alt="Sakinah.now"
                        className="object-contain object-left"
                        fill
                        sizes="(max-width: 640px) 170px, (max-width: 1024px) 230px, 280px"
                        src="/LogoTypeSakinah.now.png"
                      />
                    </div>
                  </div>
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-(--ink-strong) sm:text-5xl lg:text-6xl">
                    Return to inner calm through Quranic reflection
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                    Share what shook your heart, name what you are feeling, and receive a grounded
                    reading path that helps you move from noise to sakinah.
                  </p>
                </div>
              </div>
              <div className="relative z-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[1.8rem] border border-[rgba(82,82,91,0.12)] bg-[rgba(255,255,255,0.82)] p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
                    Step 1
                  </p>
                  <p className="mt-3 text-lg font-semibold text-(--ink-strong)">
                    Describe the moment
                  </p>
                  <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                    Write honestly about the post, conversation, or event that disrupted your peace.
                  </p>
                </div>
                <div className="rounded-[1.8rem] border border-[rgba(82,82,91,0.12)] bg-[rgba(255,255,255,0.82)] p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
                    Step 2
                  </p>
                  <p className="mt-3 text-lg font-semibold text-(--ink-strong)">
                    Name what you feel
                  </p>
                  <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                    Capture the emotional and spiritual weight so the reading can meet you there.
                  </p>
                </div>
                <div className="rounded-[1.8rem] border border-[rgba(82,82,91,0.12)] bg-[rgba(255,255,255,0.82)] p-5 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
                    Step 3
                  </p>
                  <p className="mt-3 text-lg font-semibold">Sit with a guided verse</p>
                  <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                    Read a selected reflection and return to a steadier, Allah-centered view.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <SaveNoteModal
        body={noteState.body}
        bodyDirection={noteBodyDirection}
        description={
          <>
            This note will be saved to your Quran Foundation account
            {selectedEmbeds.length > 0
              ? ` and linked to ${selectedEmbeds.map((e) => e.label).join(', ')}`
              : ''}
            .
          </>
        }
        disableGenerate={!result}
        error={noteState.error}
        feedbackDirection={noteFeedbackDirection}
        generateLabel="Generate Draft"
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
        placeholder="Write your personal reflection or note here (min 6 characters)..."
        saveLabel="Save Note"
        title="Save a Note"
      />
    </main>
  );
}

function LoadingReadingState({
  stepStatus,
}: {
  stepStatus: Record<PipelineStepKey, PipelineStepStatus>;
}) {
  const currentStep = LOADING_STEPS.find((step) => stepStatus[step.key] === 'in_progress');

  return (
    <section className="overflow-hidden rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.94)] shadow-[0_20px_64px_rgba(24,24,27,0.08)]">
      <div className="border-b border-(--line) bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.9))] px-6 py-6 sm:px-8">
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
          Preparing Your Reading
        </p>
        <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
          {currentStep
            ? `Working on: ${currentStep.label.toLowerCase()}.`
            : 'Finalizing your result.'}
        </p>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8">
        <div className="rounded-3xl p-4">
          <div className="space-y-3">
            {LOADING_STEPS.map((step, index) => {
              const status = stepStatus[step.key];
              return (
                <div className="flex items-center gap-3" key={step.key}>
                  {status === 'completed' ? (
                    <div className="relative h-4 w-4 overflow-hidden">
                      <Image
                        alt=""
                        aria-hidden
                        className="object-contain"
                        fill
                        sizes="16px"
                        src="/LogoSakinah.now.png"
                      />
                    </div>
                  ) : status === 'in_progress' ? (
                    <div className="relative h-4 w-4">
                      <span className="subtle-pulse absolute inset-0 rounded-full bg-[rgba(82,82,91,0.24)]" />
                      <div className="relative h-4 w-4 overflow-hidden">
                        <Image
                          alt=""
                          aria-hidden
                          className="object-contain"
                          fill
                          sizes="16px"
                          src="/LogoSakinah.now.png"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-[rgba(161,161,170,0.45)]" />
                  )}
                  <p
                    className={`text-sm ${
                      status === 'completed' || status === 'in_progress'
                        ? 'text-(--ink-strong)'
                        : 'text-(--ink-soft)'
                    } ${status === 'in_progress' ? 'shimmer-text' : ''}`}
                  >
                    {index + 1}. {step.label}
                    {status === 'in_progress' ? '...' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="shimmer-bar h-5 w-4/5 rounded-full" />
          <div className="shimmer-bar h-4 w-full rounded-full" />
          <div className="shimmer-bar h-4 w-11/12 rounded-full" />
          <div className="shimmer-bar h-4 w-4/6 rounded-full" />
        </div>

        <div className="rounded-[1.4rem] border border-(--line) bg-white p-4">
          <div className="shimmer-bar h-4 w-28 rounded-full" />
          <div className="mt-4 space-y-3">
            <div className="shimmer-bar h-3.5 w-full rounded-full" />
            <div className="shimmer-bar h-3.5 w-10/12 rounded-full" />
            <div className="shimmer-bar h-3.5 w-8/12 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
