import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AyahReflectionStat = {
  ayahKey: string;
  ayahNumber: number;
  chapterId: number;
  chapterName: string;
  reflectionsCount: number;
};

type ReflectionDataset = {
  completedAyahs: number;
  generatedAt: string;
  maxReflectionsCount: number;
  totalAyahs: number;
  verifiedOnly: boolean;
  stats: AyahReflectionStat[];
};

type HistogramBin = {
  count: number;
  label: string;
  max: number;
  min: number;
};

const DATASET_PATH = path.join(
  process.cwd(),
  'data',
  'quran-reflect',
  'all-ayah-reflection-stats.json',
);

function createHistogramBins(maxValue: number): HistogramBin[] {
  const bins: HistogramBin[] = [
    { count: 0, label: '0', max: 0, min: 0 },
    { count: 0, label: '1', max: 1, min: 1 },
    { count: 0, label: '2', max: 2, min: 2 },
    { count: 0, label: '3-4', max: 4, min: 3 },
    { count: 0, label: '5-9', max: 9, min: 5 },
    { count: 0, label: '10-19', max: 19, min: 10 },
    { count: 0, label: '20-49', max: 49, min: 20 },
    { count: 0, label: '50-99', max: 99, min: 50 },
  ];

  let lowerBound = 100;

  while (lowerBound <= maxValue) {
    const upperBound = lowerBound * 2 - 1;
    bins.push({
      count: 0,
      label: `${lowerBound}-${upperBound}`,
      max: upperBound,
      min: lowerBound,
    });
    lowerBound *= 2;
  }

  if (bins[bins.length - 1].max < maxValue) {
    bins.push({
      count: 0,
      label: `${lowerBound}+`,
      max: Number.POSITIVE_INFINITY,
      min: lowerBound,
    });
  }

  return bins;
}

function buildHistogram(stats: AyahReflectionStat[]) {
  const maxReflections = stats.reduce(
    (currentMax, entry) => Math.max(currentMax, entry.reflectionsCount),
    0,
  );
  const bins = createHistogramBins(maxReflections);

  for (const entry of stats) {
    const bin = bins.find(
      (candidate) =>
        entry.reflectionsCount >= candidate.min && entry.reflectionsCount <= candidate.max,
    );

    if (bin) {
      bin.count += 1;
    }
  }

  return bins.filter((bin) => bin.count > 0);
}

function calculateMedian(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

async function readDataset(): Promise<ReflectionDataset | null> {
  try {
    const content = await fs.readFile(DATASET_PATH, 'utf8');
    return JSON.parse(content) as ReflectionDataset;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export default async function ReflectionsHistogramPage() {
  const dataset = await readDataset();

  if (!dataset || dataset.stats.length === 0) {
    return (
      <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-4xl border border-(--line) bg-[rgba(255,251,245,0.84)] p-8 shadow-[0_30px_120px_rgba(43,27,8,0.12)]">
          <p className="eyebrow">Reflections Histogram</p>
          <h1 className="text-4xl font-semibold tracking-[-0.04em] text-(--ink-strong)">
            No all-ayah dataset yet
          </h1>
          <p className="max-w-2xl text-base leading-8 text-(--ink-soft)">
            Generate the full Quran Reflect count dataset first, then reload this page.
          </p>
          <pre className="overflow-x-auto rounded-3xl border border-(--line) bg-[rgba(255,252,247,0.72)] p-4 text-sm text-(--ink-strong)">
            pnpm reflections:generate -- --concurrency 6
          </pre>
          <Link className="text-sm font-medium text-(--accent-strong)" href="/">
            Back to chapter test page
          </Link>
        </div>
      </main>
    );
  }

  const histogram = buildHistogram(dataset.stats);
  const maxBinCount = Math.max(...histogram.map((bin) => bin.count));
  const counts = dataset.stats.map((entry) => entry.reflectionsCount);
  const totalReflections = counts.reduce((total, value) => total + value, 0);
  const zeroReflectionAyahs = counts.filter((value) => value === 0).length;
  const averageReflections = totalReflections / counts.length;
  const medianReflections = calculateMedian(counts);
  const topAyahs = [...dataset.stats]
    .sort((left, right) => right.reflectionsCount - left.reflectionsCount)
    .slice(0, 12);

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <section className="hero-panel overflow-hidden rounded-4xl px-6 py-8 shadow-[0_30px_120px_rgba(43,27,8,0.16)] sm:px-8 sm:py-10">
          <div className="flex flex-col gap-5">
            <p className="eyebrow">Reflections Histogram</p>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-(--ink-strong) sm:text-5xl">
                Distribution of Quran Reflect posts across all ayahs
              </h1>
              <p className="max-w-3xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                This histogram is based on exact ayah-by-ayah feed queries using the documented
                Quran Reflect feed endpoint. Each ayah count comes from the API&apos;s own{' '}
                <code>total</code> field for that exact verse filter.
              </p>
            </div>
            <div className="grid gap-4 text-sm text-(--ink-soft) sm:grid-cols-2 xl:grid-cols-5">
              <div className="stat-card">
                <span className="stat-label">Ayahs Counted</span>
                <strong className="stat-value">{dataset.completedAyahs}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Total Reflections</span>
                <strong className="stat-value">{totalReflections.toLocaleString()}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Average</span>
                <strong className="stat-value">{averageReflections.toFixed(2)}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Median</span>
                <strong className="stat-value">{medianReflections}</strong>
              </div>
              <div className="stat-card">
                <span className="stat-label">Zero Reflections</span>
                <strong className="stat-value">{zeroReflectionAyahs}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <article className="rounded-4xl border border-(--line) bg-[rgba(255,249,241,0.92)] p-6 shadow-[0_18px_44px_rgba(70,45,14,0.08)] sm:p-8">
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Histogram</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
                Ayah frequency by reflection count
              </h2>
              <p className="text-sm leading-7 text-(--ink-soft)">
                Generated at {new Date(dataset.generatedAt).toLocaleString()} with{' '}
                {dataset.verifiedOnly ? 'verified-only filtering' : 'all public reflections'}.
              </p>
            </div>

            <div className="mt-8 overflow-x-auto">
              <div className="flex min-w-[720px] items-end gap-4">
                {histogram.map((bin) => (
                  <div key={bin.label} className="flex min-w-0 flex-1 flex-col items-center gap-3">
                    <p className="text-sm font-medium text-(--ink-strong)">{bin.count}</p>
                    <div className="flex h-80 w-full items-end rounded-3xl bg-[rgba(112,75,33,0.06)] p-2">
                      <div
                        className="w-full rounded-2xl bg-[linear-gradient(180deg,#c66d1f_0%,#9b4d11_100%)] transition-[height] duration-500"
                        style={{
                          height: `${Math.max(8, (bin.count / maxBinCount) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-(--ink-soft)">
                      {bin.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <aside className="rounded-4xl border border-(--line) bg-[rgba(255,249,241,0.92)] p-6 shadow-[0_18px_44px_rgba(70,45,14,0.08)] sm:p-8">
            <div className="flex flex-col gap-2">
              <p className="eyebrow">Top Ayahs</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
                Most reflected verses
              </h2>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {topAyahs.map((entry, index) => (
                <div
                  key={entry.ayahKey}
                  className="flex items-center justify-between rounded-3xl border border-(--line) bg-[rgba(255,252,247,0.72)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm uppercase tracking-[0.22em] text-(--accent-strong)">
                      #{index + 1}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-(--ink-strong)">
                      {entry.ayahKey}
                    </p>
                    <p className="text-sm text-(--ink-soft)">{entry.chapterName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-(--ink-soft)">Reflections</p>
                    <p className="text-2xl font-semibold text-(--ink-strong)">
                      {entry.reflectionsCount}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
