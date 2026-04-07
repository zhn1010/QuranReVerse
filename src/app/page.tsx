import { Language, QuranClient } from '@quranjs/api';

export const dynamic = 'force-dynamic';

function getRequiredEnv(name: 'QURAN_CLIENT_ID' | 'QURAN_CLIENT_SECRET' | 'QURAN_ENDPOINT') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function getChapters() {
  const client = new QuranClient({
    clientId: getRequiredEnv('QURAN_CLIENT_ID'),
    clientSecret: getRequiredEnv('QURAN_CLIENT_SECRET'),
    authBaseUrl: getRequiredEnv('QURAN_ENDPOINT'),
    defaults: {
      language: Language.ENGLISH,
    },
  });

  return client.chapters.findAll();
}

export default async function Home() {
  const chapters = await getChapters();

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="hero-panel overflow-hidden rounded-4xl px-6 py-8 shadow-[0_30px_120px_rgba(43,27,8,0.16)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-5 lg:max-w-3xl">
            <p className="eyebrow">QuranJS Test Page</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-(--ink-strong) sm:text-5xl">
                Authenticated chapter list from Quran Foundation
              </h1>
              <p className="max-w-2xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                This page uses <code>@quranjs/api</code> in a Next.js server component with your
                OAuth client credentials loaded from <code>.env</code>.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-(--ink-soft) sm:grid-cols-3">
              <div className="stat-card">
                <span className="stat-label">Language</span>
                <strong className="stat-value">English</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Endpoint</span>
                <strong className="stat-value">oauth2.quran.foundation</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Chapters</span>
                <strong className="stat-value">{chapters.length}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Result</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
                `await client.chapters.findAll()`
              </h2>
            </div>
            <p className="hidden text-sm text-(--ink-soft) sm:block">
              Rendered on the server at request time.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {chapters.map((chapter) => (
              <article key={chapter.id} className="chapter-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-(--accent-strong)">
                      Surah {chapter.id}
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-(--ink-strong)">
                      {chapter.nameSimple}
                    </h3>
                    <p className="mt-1 text-sm text-(--ink-soft)">{chapter.translatedName.name}</p>
                  </div>
                  <span className="rounded-full border border-(--line) px-3 py-1 text-xs font-medium text-(--ink-soft)">
                    {chapter.revelationPlace}
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm text-(--ink-soft)">Arabic name</p>
                    <p className="text-xl text-(--ink-strong)">{chapter.nameArabic}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-(--ink-soft)">Verses</p>
                    <p className="text-3xl font-semibold text-(--ink-strong)">
                      {chapter.versesCount}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
