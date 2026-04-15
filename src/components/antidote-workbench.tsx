'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useState } from 'react';
import type { QfSessionSummary } from '@/lib/qf-user';

type ReflectionReference = {
  chapterId: number;
  from: number;
  id: string;
  to: number;
};

type RelatedReflection = {
  authorName: string;
  body: string;
  commentsCount: number;
  createdAt: string | null;
  id: number;
  languageName: string | null;
  likesCount: number;
  postTypeName: string | null;
  references: ReflectionReference[];
};

type SelectedReflection = {
  ayah_no: string;
  reflection: RelatedReflection | null;
  selected_reflection_id: number;
  selection_reason: string;
  surah_name: string;
  surah_no: number;
};

type ReflectionGuide = {
  conclusion_text: string;
  intro_text: string;
};

type Antidote = {
  ayah_no: string;
  related_reflections: RelatedReflection[];
  reasoning: string;
  surah_name: string;
  surah_no: number;
};

type Diagnosis = {
  god_centric_reframe: string;
  materialistic_narrative: string;
  spiritual_drift: string;
};

type ApiResponse = {
  antidotes: Antidote[];
  diagnosis: Diagnosis;
  error?: string;
  reflection_guide: ReflectionGuide | null;
  selected_reflection: SelectedReflection | null;
};

type BookmarkState = {
  error: string | null;
  savedKey: string | null;
  savingKey: string | null;
  success: string | null;
};

const starterEvent =
  'I spent an hour scrolling success clips and luxury posts. By the end, I felt like my worth depended on being seen, praised, and always ahead.';
const starterFeeling =
  'I feel unsettled, heavy, and disconnected from gratitude. I want to return to a calmer, Allah-centered state.';
const QURAN_COM_TRANSLATION_ID = '135';

function buildQuranEmbedUrl(surahNo: number, ayahNo: string) {
  const verseRef = `${surahNo}:${ayahNo}`;
  const params = new URLSearchParams({
    answers: 'false',
    lessons: 'false',
    mergeVerses: 'true',
    mushaf: 'kfgqpc_v2',
    reflections: 'false',
    tafsir: 'false',
    translations: QURAN_COM_TRANSLATION_ID,
    verses: verseRef,
  });

  return `https://quran.com/embed/v1?${params.toString()}`;
}

function formatReferenceAyah(reference: ReflectionReference) {
  if (reference.from < 1 || reference.to < 1) {
    return null;
  }

  return reference.from === reference.to
    ? `${reference.chapterId}:${reference.from}`
    : `${reference.chapterId}:${reference.from}-${reference.to}`;
}

function getSelectedReflectionEmbeds(selectedReflection: SelectedReflection) {
  const references =
    selectedReflection.reflection?.references
      .map((reference) => ({
        label: formatReferenceAyah(reference),
        reference,
      }))
      .filter((item): item is { label: string; reference: ReflectionReference } => !!item.label)
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.label === item.label) === index,
      ) ?? [];

  if (references.length > 0) {
    return references;
  }

  return [
    {
      label: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
      reference: {
        chapterId: selectedReflection.surah_no,
        from: Number.parseInt(selectedReflection.ayah_no.split('-')[0] ?? '0', 10),
        id: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
        to: Number.parseInt(
          selectedReflection.ayah_no.split('-')[1] ??
            selectedReflection.ayah_no.split('-')[0] ??
            '0',
          10,
        ),
      },
    },
  ];
}

export default function AntidoteWorkbench({
  initialAuth,
}: {
  initialAuth: QfSessionSummary;
}) {
  const [eventContent, setEventContent] = useState(starterEvent);
  const [userFeeling, setUserFeeling] = useState(starterFeeling);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authState] = useState(initialAuth);
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>({
    error: null,
    savedKey: null,
    savingKey: null,
    success: null,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/antidotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventContent,
          userFeeling,
        }),
      });

      const payload = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'Request failed.');
      }

      setResult(payload);
    } catch (submissionError) {
      setResult(null);
      setError(
        submissionError instanceof Error ? submissionError.message : 'Unexpected request error.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBookmark(surahNo: number, ayahNo: string, key: string) {
    setBookmarkState({
      error: null,
      savedKey: null,
      savingKey: key,
      success: null,
    });

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
        method: 'POST',
      });
      const payload = (await response.json()) as {
        collectionName?: string;
        error?: string;
        savedCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not save the ayah.');
      }

      const savedCount = payload.savedCount ?? 1;

      setBookmarkState({
        error: null,
        savedKey: key,
        savingKey: null,
        success: `${savedCount === 1 ? '1 ayah saved' : `${savedCount} ayahs saved`} to ${payload.collectionName ?? authState.collectionName}.`,
      });
    } catch (bookmarkError) {
      setBookmarkState({
        error: bookmarkError instanceof Error ? bookmarkError.message : 'Could not save the ayah.',
        savedKey: null,
        savingKey: null,
        success: null,
      });
    }
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <Script defer src="https://quran.com/widget/embed-widget.js" strategy="afterInteractive" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="grid gap-8]">
          <div className="rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.76)] p-6 shadow-[0_12px_30px_rgba(24,24,27,0.05)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--accent-strong)">
              Sakinah.now
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-(--ink-strong) sm:text-4xl">
              Return to inner calm through Quranic reflection
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-(--ink-soft)">
              Share what shook your heart, name what you are feeling, and receive a grounded reading
              path that helps you move from noise to sakinah.
            </p>
          </div>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-3 rounded-3xl border border-(--line) bg-[rgba(255,255,255,0.72)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-(--ink-strong)">
                  {authState.isAuthenticated
                    ? `Connected to Quran Foundation${authState.displayName ? ` as ${authState.displayName}` : ''}`
                    : `Connect Quran Foundation to save ayahs to your Sakinah collection`}
                </p>
                <p className="mt-1 text-sm leading-7 text-(--ink-soft)">
                  {authState.isAuthenticated
                    ? `Saved ayahs will be stored in your ${authState.collectionName} collection.`
                    : 'Connect once to save each guided verse into a dedicated collection for your reflection journey.'}
                </p>
              </div>
              {authState.isAuthenticated ? (
                <a
                  className="inline-flex items-center justify-center rounded-full border border-(--line) px-5 py-2 text-sm font-medium text-(--ink-strong) transition hover:bg-white"
                  href="/api/qf/auth/logout"
                >
                  Disconnect
                </a>
              ) : (
                <a
                  className="inline-flex items-center justify-center rounded-full bg-(--ink-strong) px-5 py-2 text-sm font-medium text-white transition hover:bg-(--accent)"
                  href="/api/qf/auth/login?next=/"
                >
                  Connect Account
                </a>
              )}
            </div>
            <div className="rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.92)] p-6 shadow-[0_18px_44px_rgba(24,24,27,0.06)] sm:p-8">
              <div className="space-y-5">
                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.18em] text-(--accent-strong)">
                    What happened today that affected your heart?
                  </span>
                  <textarea
                    className="min-h-64 rounded-[1.6rem] border border-(--line) bg-white/80 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)]"
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
                    className="min-h-32 rounded-[1.6rem] border border-(--line) bg-white/80 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(82,82,91,0.4)] focus:ring-4 focus:ring-[rgba(113,113,122,0.14)]"
                    onChange={(inputEvent) => setUserFeeling(inputEvent.target.value)}
                    placeholder="Name the emotional and spiritual impact as honestly as you can."
                    value={userFeeling}
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-(--accent-strong) px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-(--accent) disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Listening and reflecting...' : 'Find Quranic grounding'}
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
          {result ? (
            <div className="grid gap-4">
              {result.selected_reflection?.reflection ? (
                <section className="overflow-hidden rounded-4xl border border-(--line) bg-[rgba(255,255,255,0.94)] shadow-[0_20px_64px_rgba(24,24,27,0.08)]">
                  <div className="grid gap-8 px-6 py-8 sm:px-8">
                    <article className="flex flex-col gap-8">
                      {result.reflection_guide ? (
                        <p className="text-lg leading-9 text-(--ink-strong)">
                          {result.reflection_guide.intro_text}
                        </p>
                      ) : null}

                      <div className="rounded-[1.7rem] border border-[rgba(82,82,91,0.14)] bg-[linear-gradient(180deg,rgba(244,244,245,0.82),rgba(255,255,255,0.96))] px-5 py-6 sm:px-6">
                        <div className="flex flex-col gap-3 border-b border-[rgba(82,82,91,0.12)] pb-4 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-(--ink-strong)">
                              {result.selected_reflection.reflection.authorName}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-(--ink-soft)">
                              {result.selected_reflection.reflection.postTypeName ?? 'Reflection'}
                              {result.selected_reflection.reflection.languageName
                                ? ` • ${result.selected_reflection.reflection.languageName}`
                                : ''}
                            </p>
                          </div>
                          <p className="text-xs uppercase tracking-[0.16em] text-(--ink-soft)">
                            {result.selected_reflection.reflection.createdAt
                              ? new Date(
                                  result.selected_reflection.reflection.createdAt,
                                ).toLocaleDateString()
                              : 'Unknown date'}
                          </p>
                        </div>

                        <div className="mt-5">
                          <ReflectionBody body={result.selected_reflection.reflection.body} />
                        </div>

                        <div className="mt-5 flex gap-4 text-xs uppercase tracking-[0.14em] text-(--ink-soft)">
                          <span>{result.selected_reflection.reflection.likesCount} likes</span>
                          <span>
                            {result.selected_reflection.reflection.commentsCount} comments
                          </span>
                        </div>
                      </div>
                      {bookmarkState.success || bookmarkState.error ? (
                        <div className="rounded-[1.4rem] border border-(--line) bg-[rgba(255,255,255,0.72)] px-4 py-3 text-sm leading-7">
                          {bookmarkState.success ? (
                            <p className="text-[rgb(24,94,58)]">{bookmarkState.success}</p>
                          ) : null}
                          {bookmarkState.error ? (
                            <p className="text-[rgb(146,64,14)]">{bookmarkState.error}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {getSelectedReflectionEmbeds(result.selected_reflection).map((embed) => (
                        <div
                          key={embed.label}
                          className="overflow-hidden rounded-[1.6rem] border border-(--line) bg-white shadow-[0_12px_32px_rgba(24,24,27,0.06)]"
                        >
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
                                    handleBookmark(
                                      embed.reference.chapterId,
                                      embed.label.split(':')[1] ?? '',
                                      embed.label,
                                    )
                                  }
                                  type="button"
                                >
                                  {bookmarkState.savingKey === embed.label
                                    ? 'Saving...'
                                    : bookmarkState.savedKey === embed.label
                                      ? 'Saved'
                                      : `Save to ${authState.collectionName}`}
                                </button>
                              ) : (
                                <a
                                  className="inline-flex items-center justify-center rounded-full border border-(--line) px-3 py-1.5 text-xs font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.72)]"
                                  href="/api/qf/auth/login?next=/"
                                >
                                  Connect to Save
                                </a>
                              )}
                            </div>
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
                            )}
                            title={`Quran passage ${embed.label}`}
                            width="100%"
                          />
                        </div>
                      ))}
                      {result.reflection_guide ? (
                        <div className="border-t border-(--line) pt-6">
                          <p className="text-base leading-8 text-(--ink-strong)">
                            {result.reflection_guide.conclusion_text}
                          </p>
                        </div>
                      ) : null}
                    </article>

                    {/* <aside className="flex flex-col gap-4">
                      <div className="rounded-[1.6rem] border border-(--line) bg-[rgba(244,244,245,0.72)] px-5 py-4">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-(--accent-strong)">
                          Quran Passages In This Reading
                        </p>
                        <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                          These are the ayahs referenced in the reflection itself, shown here so you
                          can sit with the source text directly.
                        </p>
                      </div>

                      
                    </aside> */}
                  </div>
                </section>
              ) : null}

              {/* {result.antidotes.map((antidote) => (
                <article
                  key={`${antidote.surah_no}:${antidote.ayah_no}`}
                  className="chapter-card flex flex-col gap-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-(--accent-strong)">
                        {antidote.surah_name} {antidote.surah_no}:{antidote.ayah_no}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-(--ink-strong)">
                        Spiritual Reframing
                      </h3>
                    </div>
                    <span className="rounded-full border border-(--line) px-3 py-1 text-xs font-medium text-(--ink-soft)">
                      Quran.com embed
                    </span>
                  </div>

                  <p className="text-base leading-8 text-(--ink-strong)">{antidote.reasoning}</p>

                  <iframe
                    allow="clipboard-write"
                    className="block w-full bg-white"
                    data-quran-embed="true"
                    frameBorder="0"
                    loading="lazy"
                    src={buildQuranEmbedUrl(antidote.surah_no, antidote.ayah_no)}
                    title={`${antidote.surah_name} ${antidote.surah_no}:${antidote.ayah_no}`}
                    width="100%"
                  />

                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                        Related Reflections
                      </p>
                      <p className="mt-1 text-sm leading-7 text-(--ink-soft)">
                        Latest three verified English reflection posts for this ayah from Quran
                        Reflect.
                      </p>
                    </div>

                    {antidote.related_reflections.length > 0 ? (
                      <div className="grid gap-3">
                        {antidote.related_reflections.map((reflection) => (
                          <div
                            key={reflection.id}
                            className={`rounded-[1.4rem] border p-4 ${
                              result.selected_reflection?.selected_reflection_id === reflection.id
                                ? 'border-[rgba(82,82,91,0.28)] bg-white'
                                : 'border-(--line) bg-[rgba(237,237,237,0.72)]'
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-(--ink-strong)">
                                  {reflection.authorName}
                                </p>
                                <p className="text-xs uppercase tracking-[0.16em] text-(--ink-soft)">
                                  {reflection.postTypeName ?? 'Reflection'}
                                  {reflection.languageName ? ` • ${reflection.languageName}` : ''}
                                </p>
                              </div>
                              <p className="text-xs text-(--ink-soft)">
                                {reflection.createdAt
                                  ? new Date(reflection.createdAt).toLocaleDateString()
                                  : 'Unknown date'}
                              </p>
                            </div>

                            {result.selected_reflection?.selected_reflection_id === reflection.id ? (
                              <div className="mt-3 rounded-2xl border border-[rgba(82,82,91,0.16)] bg-[rgba(255,255,255,0.88)] px-4 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--accent-strong)">
                                  Curator Pick
                                </p>
                                <p className="mt-2 text-sm leading-7 text-(--ink-strong)">
                                  {result.selected_reflection.selection_reason}
                                </p>
                              </div>
                            ) : null}

                            <ReflectionBody body={reflection.body} />

                            <div className="mt-3 flex gap-4 text-xs uppercase tracking-[0.14em] text-(--ink-soft)">
                              <span>{reflection.likesCount} likes</span>
                              <span>{reflection.commentsCount} comments</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-7 text-(--ink-soft)">
                        No related reflection posts were found for this ayah.
                      </p>
                    )}
                  </div>
                </article>
              ))} */}
            </div>
          ) : (
            <div className="rounded-4xl border border-dashed border-(--line) bg-[rgba(255,255,255,0.56)] p-8 text-base leading-8 text-(--ink-soft)">
              Your Sakinah reading will appear here after submission, with a selected reflection and
              the Quran passages that anchor it.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ReflectionBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const normalizedBody = body.trim();
  const shouldCollapse = normalizedBody.length > 420;

  return (
    <div className="mt-3">
      <p
        className={`whitespace-pre-line text-sm leading-7 text-(--ink-strong) ${
          !expanded && shouldCollapse ? 'line-clamp-6' : ''
        }`}
      >
        {normalizedBody}
      </p>

      {shouldCollapse ? (
        <button
          className="mt-3 text-sm font-medium text-(--accent-strong) underline decoration-[rgba(82,82,91,0.3)] underline-offset-4"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? 'Show less' : 'Continue reading'}
        </button>
      ) : null}
    </div>
  );
}
