'use client';

import { useState } from 'react';

type Verse = {
  arabicText: string;
  ayahNo: string;
  englishTranslation: string;
  surahName: string;
  surahNo: number;
  translationName: string;
  verseKey: string;
};

type Antidote = {
  ayah_no: string;
  reasoning: string;
  surah_name: string;
  surah_no: number;
  verse: Verse | null;
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
};

const starterEvent =
  'I read a story celebrating wealth, influence, and social recognition, and it made success feel like the main proof that a person matters.';
const starterFeeling = 'I felt restless, small, and afraid that I am falling behind in life.';

export default function AntidoteWorkbench() {
  const [eventContent, setEventContent] = useState(starterEvent);
  const [userFeeling, setUserFeeling] = useState(starterFeeling);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="hero-panel overflow-hidden rounded-4xl px-6 py-8 shadow-[0_30px_120px_rgba(43,27,8,0.16)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:max-w-4xl">
            <p className="eyebrow">Ilm an-Nafs Workbench</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.05em] text-(--ink-strong) sm:text-5xl">
                Reframe an event from material pull toward God-centered meaning
              </h1>
              <p className="max-w-3xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                Enter what happened or what the user consumed, then describe the feeling that
                followed. The backend uses <code>gpt-5</code> to diagnose the spiritual drift and
                select Quranic antidotes, then enriches those ayahs with Arabic text and English
                translation.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-(--ink-soft) sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Model</span>
                <strong className="stat-value">GPT-5</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Output</span>
                <strong className="stat-value">Strict JSON schema</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Verse Enrichment</span>
                <strong className="stat-value">Arabic + English</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="rounded-4xl border border-(--line) bg-[rgba(255,249,241,0.92)] p-6 shadow-[0_18px_44px_rgba(70,45,14,0.08)] sm:p-8">
              <div className="space-y-5">
                <div>
                  <p className="eyebrow">Input</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
                    Event, content, and emotional response
                  </h2>
                </div>

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.18em] text-(--accent-strong)">
                    What happened or what was read?
                  </span>
                  <textarea
                    className="min-h-64 rounded-[1.6rem] border border-(--line) bg-white/70 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(155,77,17,0.45)] focus:ring-4 focus:ring-[rgba(198,109,31,0.12)]"
                    onChange={(inputEvent) => setEventContent(inputEvent.target.value)}
                    placeholder="Describe the event, article, post, video, conversation, or experience."
                    value={eventContent}
                  />
                </label>

                <label className="flex flex-col gap-3">
                  <span className="text-sm font-medium uppercase tracking-[0.18em] text-(--accent-strong)">
                    What did she feel after that?
                  </span>
                  <textarea
                    className="min-h-32 rounded-[1.6rem] border border-(--line) bg-white/70 px-5 py-4 text-base leading-8 text-(--ink-strong) outline-none transition focus:border-[rgba(155,77,17,0.45)] focus:ring-4 focus:ring-[rgba(198,109,31,0.12)]"
                    onChange={(inputEvent) => setUserFeeling(inputEvent.target.value)}
                    placeholder="Describe the emotional or spiritual feeling that followed."
                    value={userFeeling}
                  />
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="inline-flex items-center justify-center rounded-full bg-(--accent-strong) px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Analyzing...' : 'Generate Quranic Antidotes'}
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

          <div className="flex flex-col gap-6">
            <section className="rounded-4xl border border-(--line) bg-[rgba(255,249,241,0.92)] p-6 shadow-[0_18px_44px_rgba(70,45,14,0.08)] sm:p-8">
              <p className="eyebrow">Diagnosis</p>
              {result ? (
                <div className="mt-4 flex flex-col gap-5">
                  <div className="rounded-3xl border border-(--line) bg-[rgba(255,252,247,0.72)] p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                      Spiritual Drift
                    </p>
                    <p className="mt-2 text-base leading-8 text-(--ink-strong)">
                      {result.diagnosis.spiritual_drift}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-(--line) bg-[rgba(255,252,247,0.72)] p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                      Materialistic Narrative
                    </p>
                    <p className="mt-2 text-base leading-8 text-(--ink-strong)">
                      {result.diagnosis.materialistic_narrative}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-(--line) bg-[rgba(255,252,247,0.72)] p-4">
                    <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                      God-Centric Reframe
                    </p>
                    <p className="mt-2 text-base leading-8 text-(--ink-strong)">
                      {result.diagnosis.god_centric_reframe}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-base leading-8 text-(--ink-soft)">
                  Submit the form to see the spiritual diagnosis and Quranic antidotes.
                </p>
              )}
            </section>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Ayah Response</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
              Arabic text and English translation
            </h2>
          </div>

          {result ? (
            <div className="grid gap-4">
              {result.antidotes.map((antidote) => (
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
                      {antidote.verse?.translationName ?? 'Translation unavailable'}
                    </span>
                  </div>

                  <p className="text-base leading-8 text-(--ink-strong)">{antidote.reasoning}</p>

                  {antidote.verse ? (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                      <div className="rounded-[1.6rem] border border-(--line) bg-[rgba(255,252,247,0.72)] p-5">
                        <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                          Arabic
                        </p>
                        <p
                          className="mt-4 text-right text-3xl leading-[2.3] text-(--ink-strong)"
                          dir="rtl"
                        >
                          {antidote.verse.arabicText}
                        </p>
                      </div>
                      <div className="rounded-[1.6rem] border border-(--line) bg-[rgba(255,252,247,0.72)] p-5">
                        <p className="text-sm uppercase tracking-[0.18em] text-(--accent-strong)">
                          English
                        </p>
                        <p className="mt-4 text-base leading-8 text-(--ink-strong)">
                          {antidote.verse.englishTranslation}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-7 text-(--ink-soft)">
                      Verse text could not be enriched automatically for this ayah selection.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-4xl border border-dashed border-(--line) bg-[rgba(255,249,241,0.56)] p-8 text-base leading-8 text-(--ink-soft)">
              The selected ayahs, their Arabic text, and their English translation will appear here
              after analysis.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
