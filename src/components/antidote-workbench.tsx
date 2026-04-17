'use client';

import Script from 'next/script';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { QfSessionSummary } from '@/lib/qf-user';
import { useToast } from '@/components/toast';

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
const starterFeeling =
  'I feel unsettled, heavy, and disconnected from gratitude. I want to return to a calmer, Allah-centered state.';
/** ISO 639-1 language code → first Quran.com translation resource ID */
const TRANSLATION_BY_LANG: Record<string, number> = {
  aa: 854, // Afar
  am: 87, // Amharic
  ar: 1014, // Arabic
  as: 120, // Assamese
  az: 75, // Azeri
  bg: 237, // Bulgarian
  bm: 795, // Bambara
  bn: 161, // Bengali
  bs: 214, // Bosnian
  ce: 106, // Chechen
  cs: 26, // Czech
  de: 208, // German
  dv: 86, // Divehi
  en: 85, // English (Abdel Haleem)
  es: 83, // Spanish
  fa: 135, // Persian
  fi: 30, // Finnish
  fr: 136, // French
  gu: 225, // Gujarati
  ha: 32, // Hausa
  he: 233, // Hebrew
  hi: 122, // Hindi
  hr: 997, // Croatian
  id: 134, // Indonesian
  it: 153, // Italian
  ja: 35, // Japanese
  kk: 222, // Kazakh
  km: 128, // Khmer
  kn: 771, // Kannada
  ko: 36, // Korean
  ku: 81, // Kurdish
  ky: 858, // Kyrgyz
  lg: 232, // Ganda
  ln: 855, // Lingala
  lt: 904, // Lithuanian
  mk: 788, // Macedonian
  ml: 80, // Malayalam
  mr: 226, // Marathi
  ms: 39, // Malay
  ne: 108, // Nepali
  nl: 235, // Dutch
  no: 41, // Norwegian
  om: 111, // Oromo
  pa: 857, // Punjabi
  pl: 42, // Polish
  ps: 118, // Pashto
  pt: 103, // Portuguese
  rn: 921, // Rundi
  ro: 782, // Romanian
  ru: 79, // Russian
  rw: 774, // Kinyarwanda
  sd: 238, // Sindhi
  si: 228, // Sinhala
  so: 46, // Somali
  sq: 88, // Albanian
  sr: 215, // Serbian
  sv: 48, // Swedish
  sw: 793, // Swahili
  ta: 229, // Tamil
  te: 227, // Telugu
  tg: 139, // Tajik
  th: 230, // Thai
  tl: 211, // Tagalog
  tr: 210, // Turkish
  tt: 53, // Tatar
  ug: 76, // Uyghur
  uk: 217, // Ukrainian
  ur: 234, // Urdu
  uz: 55, // Uzbek
  vi: 220, // Vietnamese
  yo: 125, // Yoruba
  zh: 56, // Chinese
};

const DEFAULT_TRANSLATION_ID = 20; // Saheeh International (English)
const PENDING_SESSION_KEY = 'sakinah:pending-session';

type PendingSession = {
  eventContent: string;
  result: ApiResponse;
  scrollY?: number;
  userFeeling: string;
};

function getPreferredTranslationId(): number {
  if (typeof navigator === 'undefined') return DEFAULT_TRANSLATION_ID;

  const languages = navigator.languages ?? [navigator.language];
  for (const lang of languages) {
    const code = lang.split('-')[0]?.toLowerCase();
    if (code && TRANSLATION_BY_LANG[code]) {
      return TRANSLATION_BY_LANG[code];
    }
  }

  return DEFAULT_TRANSLATION_ID;
}

const APP_CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://sakinah.now';

function buildQuranEmbedUrl(surahNo: number, ayahNo: string, translationId: number) {
  const verseRef = `${surahNo}:${ayahNo}`;
  const params = new URLSearchParams({
    answers: 'false',
    lessons: 'false',
    mergeVerses: 'true',
    mushaf: 'kfgqpc_v2',
    reflections: 'false',
    tafsir: 'false',
    translations: String(translationId),
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

export default function AntidoteWorkbench({ initialAuth }: { initialAuth: QfSessionSummary }) {
  const [eventContent, setEventContent] = useState(starterEvent);
  const [userFeeling, setUserFeeling] = useState(starterFeeling);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [translationId, setTranslationId] = useState(DEFAULT_TRANSLATION_ID);

  useEffect(() => {
    setTranslationId(getPreferredTranslationId());
  }, []);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_SESSION_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_SESSION_KEY);
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

  function saveSessionBeforeNav() {
    try {
      if (result) {
        sessionStorage.setItem(
          PENDING_SESSION_KEY,
          JSON.stringify({ eventContent, result, scrollY: window.scrollY, userFeeling }),
        );
      }
    } catch {
      // storage may be unavailable
    }
  }

  const selectedEmbeds = useMemo<Array<{ label: string; reference: ReflectionReference }>>(
    () =>
      result?.selected_reflection ? getSelectedReflectionEmbeds(result.selected_reflection) : [],
    [result],
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
        if (process.env.NODE_ENV !== 'production') {
          console.log('[qf-bookmark]', 'hydrating bookmark state', {
            embeds: selectedEmbeds.map((embed) => ({
              ayahNo: embed.label.split(':')[1] ?? '',
              key: embed.label,
              surahNo: embed.reference.chapterId,
            })),
          });
        }

        const updates: Record<string, boolean> = {};

        await Promise.all(
          selectedEmbeds.map(async (embed) => {
            const requestedAyahNo = embed.label.split(':')[1] ?? '';
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

            if (process.env.NODE_ENV !== 'production') {
              console.log('[qf-bookmark]', 'hydrate response', {
                ayahNo: requestedAyahNo,
                key: embed.label,
                payloadKeysCount: Object.keys(payload.bookmarkIdsByVerseNumber ?? {}).length,
                responseOk: response.ok,
                status: response.status,
                surahNo: embed.reference.chapterId,
              });
            }

            if (!response.ok) {
              throw new Error(payload.error || 'Could not load bookmark state.');
            }

            updates[embed.label] =
              Boolean(payload.bookmarkIdsByVerseNumber) &&
              Object.keys(payload.bookmarkIdsByVerseNumber ?? {}).length > 0;
          }),
        );

        if (isCancelled) {
          return;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log('[qf-bookmark]', 'hydrate updates', updates);
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

  function buildNoteRangesFromReflection() {
    if (!result?.selected_reflection?.reflection) {
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
          diagnosis: result?.diagnosis ?? null,
          eventContent,
          reflectionBody: result?.selected_reflection?.reflection?.body ?? null,
          reflectionGuide: result?.reflection_guide ?? null,
          selectedReflection: result?.selected_reflection
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

      if (!response.ok) {
        let errorMessage = 'Could not generate draft.';
        try {
          const payload = (await response.json()) as { error?: string };
          errorMessage = payload.error || errorMessage;
        } catch {
          // response may not be JSON
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('No stream received from server.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        setNoteState((prev) => ({ ...prev, body: prev.body + chunk }));
      }

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
      const ranges = buildNoteRangesFromReflection();
      const attachedEntities: Array<{
        entityId: string;
        entityType: 'reflection';
      }> = [];

      if (result?.selected_reflection?.reflection) {
        attachedEntities.push({
          entityId: String(result.selected_reflection.reflection.id),
          entityType: 'reflection',
        });
      }

      const response = await fetch('/api/qf/note', {
        body: JSON.stringify({
          attachedEntities,
          body: noteState.body.trim(),
          ranges,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      const payload = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not save the note.');
      }

      setNoteState({
        body: '',
        error: null,
        isGenerating: false,
        isSaving: false,
        open: false,
        success: null,
      });
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
          <div className="hero-panel overflow-hidden rounded-4xl px-6 py-8 shadow-[0_24px_80px_rgba(24,24,27,0.1)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)] lg:items-end">
              <div className="relative z-10 flex flex-col gap-6">
                <div className="space-y-4">
                  <p className="eyebrow">Sakinah.now</p>
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-(--ink-strong) sm:text-5xl lg:text-6xl">
                    Return to inner calm through Quranic reflection
                  </h1>
                  <p className="max-w-2xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                    Share what shook your heart, name what you are feeling, and receive a grounded
                    reading path that helps you move from noise to sakinah.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-(--ink-soft)">
                  <span className="rounded-full border border-[rgba(82,82,91,0.14)] bg-white/72 px-4 py-2 font-medium text-(--ink-strong)">
                    Reflect on what unsettled you
                  </span>
                  <span className="rounded-full border border-[rgba(82,82,91,0.14)] bg-white/72 px-4 py-2 font-medium text-(--ink-strong)">
                    Receive Quranic grounding
                  </span>
                  <span className="rounded-full border border-[rgba(82,82,91,0.14)] bg-white/72 px-4 py-2 font-medium text-(--ink-strong)">
                    Save ayahs to revisit later
                  </span>
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
                <div className="rounded-[1.8rem] border border-[rgba(82,82,91,0.12)] bg-[linear-gradient(180deg,rgba(39,39,42,0.96),rgba(63,63,70,0.94))] p-5 text-white shadow-[0_16px_34px_rgba(24,24,27,0.18)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                    Step 3
                  </p>
                  <p className="mt-3 text-lg font-semibold">Sit with a guided verse</p>
                  <p className="mt-2 text-sm leading-7 text-white/78">
                    Read a selected reflection and return to a steadier, Allah-centered view.
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                      href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=/`}
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

                      <div className="border-t border-(--line) pt-2">
                        <div className="mt-5">
                          <ReflectionBody
                            body={result.selected_reflection.reflection.body}
                            alwaysExpand
                            postId={result.selected_reflection.reflection.id}
                          />
                        </div>
                      </div>
                      {selectedEmbeds.map((embed) => (
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
                                  href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=/`}
                                  onClick={saveSessionBeforeNav}
                                >
                                  Connect to Bookmark
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
                              translationId,
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
                            href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=/`}
                            onClick={saveSessionBeforeNav}
                          >
                            Connect to Save as Note
                          </a>
                        )}
                      </div>
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

                            <ReflectionBody body={reflection.body} postId={reflection.id} />

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
            <h2 className="text-lg font-semibold text-(--ink-strong)">Save a Note</h2>
            <p className="mt-1 text-sm leading-7 text-(--ink-soft)">
              This note will be saved to your Quran Foundation account
              {selectedEmbeds.length > 0
                ? ` and linked to ${selectedEmbeds.map((e) => e.label).join(', ')}`
                : ''}
              .
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
                placeholder="Write your personal reflection or note here (min 6 characters)..."
                value={noteState.body}
              />
              <div className="absolute bottom-3 left-3">
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-(--line) bg-white/90 px-3.5 py-1.5 text-xs font-medium text-(--ink-soft) shadow-sm transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={noteState.isSaving || noteState.isGenerating || !result}
                  onClick={handleNoteDraftGenerate}
                  type="button"
                >
                  {noteState.isGenerating ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-(--line) border-t-(--accent-strong)" />
                      Drafting...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Generate Draft
                    </>
                  )}
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
                {noteState.isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ReflectionBody({
  body,
  alwaysExpand,
  postId,
}: {
  body: string;
  alwaysExpand?: boolean;
  postId?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalizedBody = body.trim();
  const shouldCollapse = normalizedBody.length > 420 && !alwaysExpand;

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

      {postId ? (
        <a
          className="mt-3 inline-block text-xs text-(--ink-soft) underline decoration-[rgba(82,82,91,0.25)] underline-offset-4 transition hover:text-(--ink-strong)"
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
