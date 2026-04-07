#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  fetchChapters,
  fetchReflectionCountForAyah,
  getAccessToken,
  getQuranReflectDefaultFeedOptions,
  getQuranFoundationConfig,
  loadDotEnv,
  parseOptionalIntegerList,
} from './lib/quran-reflect.mjs';

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_LIMIT = 1;
const DEFAULT_OUTPUT_PATH = 'data/quran-reflect/all-ayah-reflection-stats.json';
const SAVE_EVERY = 25;

function parseArgs(argv) {
  const defaultFeedOptions = getQuranReflectDefaultFeedOptions();
  const options = {
    chapter: null,
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
    languages: defaultFeedOptions.languages,
    limit: DEFAULT_LIMIT,
    maxAyahs: null,
    output: DEFAULT_OUTPUT_PATH,
    postTypeIds: defaultFeedOptions.postTypeIds,
    tab: defaultFeedOptions.tab,
    verifiedOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--verified-only') {
      options.verifiedOnly = true;
      continue;
    }

    if (arg === '--languages') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('Missing value for --languages');
      }

      options.languages = parseOptionalIntegerList(value, '--languages');
      index += 1;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--chapter') {
      const value = argv[index + 1];
      options.chapter = Number.parseInt(value ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--concurrency') {
      const value = argv[index + 1];
      options.concurrency = Number.parseInt(value ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--limit') {
      const value = argv[index + 1];
      options.limit = Number.parseInt(value ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--max-ayahs') {
      const value = argv[index + 1];
      options.maxAyahs = Number.parseInt(value ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--post-type-ids') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('Missing value for --post-type-ids');
      }

      options.postTypeIds = parseOptionalIntegerList(value, '--post-type-ids');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('Missing value for --output');
      }

      options.output = value;
      index += 1;
      continue;
    }

    if (arg === '--tab') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('Missing value for --tab');
      }

      options.tab = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error('`--concurrency` must be a positive integer.');
  }

  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error('`--limit` must be a positive integer.');
  }

  if (options.chapter !== null && (!Number.isInteger(options.chapter) || options.chapter < 1)) {
    throw new Error('`--chapter` must be a positive integer.');
  }

  if (options.maxAyahs !== null && (!Number.isInteger(options.maxAyahs) || options.maxAyahs < 1)) {
    throw new Error('`--max-ayahs` must be a positive integer.');
  }

  return options;
}

function buildAyahTasks(chapters, chapterFilter) {
  const filteredChapters =
    chapterFilter === null ? chapters : chapters.filter((chapter) => chapter.id === chapterFilter);

  return filteredChapters.flatMap((chapter) =>
    Array.from({ length: chapter.versesCount }, (_, index) => ({
      ayahKey: `${chapter.id}:${index + 1}`,
      ayahNumber: index + 1,
      chapterId: chapter.id,
      chapterName: chapter.nameSimple,
    })),
  );
}

async function readExistingResults(outputPath) {
  try {
    const content = await fs.readFile(outputPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function createStatsMap(existingData, force) {
  if (force || !existingData || !Array.isArray(existingData.stats)) {
    return new Map();
  }

  return new Map(existingData.stats.map((entry) => [entry.ayahKey, entry]));
}

async function writeResults(outputPath, payload) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function buildOutputPayload({ options, statsMap, tasks }) {
  const stats = tasks
    .map((task) => statsMap.get(task.ayahKey))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.chapterId !== right.chapterId) {
        return left.chapterId - right.chapterId;
      }

      return left.ayahNumber - right.ayahNumber;
    });

  const reflectionCounts = stats.map((entry) => entry.reflectionsCount);
  const maxReflectionsCount = reflectionCounts.length > 0 ? Math.max(...reflectionCounts) : 0;

  return {
    completedAyahs: stats.length,
    generatedAt: new Date().toISOString(),
    languages: options.languages,
    maxReflectionsCount,
    postTypeIds: options.postTypeIds,
    tab: options.tab,
    totalAyahs: tasks.length,
    verifiedOnly: options.verifiedOnly,
    stats,
  };
}

async function main() {
  loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const outputPath = path.resolve(process.cwd(), options.output);
  const existingData = await readExistingResults(outputPath);
  const { apiBaseUrl, authBaseUrl, clientId, clientSecret } = getQuranFoundationConfig();
  const chapters = await fetchChapters({
    authBaseUrl,
    clientId,
    clientSecret,
  });

  let tasks = buildAyahTasks(chapters, options.chapter);

  if (options.maxAyahs !== null) {
    tasks = tasks.slice(0, options.maxAyahs);
  }

  const statsMap = createStatsMap(existingData, options.force);

  if (
    existingData &&
    !options.force &&
    existingData.verifiedOnly !== undefined &&
    existingData.verifiedOnly !== options.verifiedOnly
  ) {
    throw new Error(
      `Existing output file uses verifiedOnly=${existingData.verifiedOnly}. Use --force or a different --output path.`,
    );
  }

  const token = await getAccessToken({
    authBaseUrl,
    clientId,
    clientSecret,
    scope: 'post.read',
  });

  let completed = tasks.filter((task) => statsMap.has(task.ayahKey)).length;
  let nextTaskIndex = 0;
  let sinceLastSave = 0;
  const startedAt = Date.now();

  const save = async () => {
    const payload = buildOutputPayload({
      options,
      statsMap,
      tasks,
    });

    await writeResults(outputPath, payload);
    sinceLastSave = 0;
  };

  const worker = async () => {
    while (true) {
      const task = tasks[nextTaskIndex];
      nextTaskIndex += 1;

      if (!task) {
        return;
      }

      if (statsMap.has(task.ayahKey)) {
        continue;
      }

      const reflectionsCount = await fetchReflectionCountForAyah({
        apiBaseUrl,
        ayah: task.ayahNumber,
        chapterId: task.chapterId,
        clientId,
        languages: options.languages,
        limit: options.limit,
        postTypeIds: options.postTypeIds,
        tab: options.tab,
        token,
        verifiedOnly: options.verifiedOnly,
      });

      statsMap.set(task.ayahKey, {
        ...task,
        reflectionsCount,
      });

      completed += 1;
      sinceLastSave += 1;

      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const rate = (completed / elapsedSeconds).toFixed(2);

      console.log(
        `[${completed}/${tasks.length}] ${task.ayahKey} -> ${reflectionsCount} reflections (${rate} ayahs/sec)`,
      );

      if (sinceLastSave >= SAVE_EVERY || completed === tasks.length) {
        await save();
      }
    }
  };

  console.log(`Output: ${outputPath}`);
  console.log(`Ayahs queued: ${tasks.length}`);
  console.log(`Resume mode: ${options.force ? 'off' : 'on'}`);
  console.log(`Tab: ${options.tab}`);
  console.log(`Languages: ${options.languages.length > 0 ? options.languages.join(',') : 'all'}`);
  console.log(
    `Post types: ${options.postTypeIds.length > 0 ? options.postTypeIds.join(',') : 'all'}`,
  );
  console.log(`Verified only: ${options.verifiedOnly ? 'yes' : 'no'}`);
  console.log(`Concurrency: ${options.concurrency}`);
  console.log('');

  await Promise.all(Array.from({ length: options.concurrency }, () => worker()));

  if (sinceLastSave > 0) {
    await save();
  }

  console.log('');
  console.log(`Finished. Wrote ${tasks.length} ayah stats to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));

  if (
    error instanceof Error &&
    /post\.read|scope|forbidden|unauthorized|401|403/iu.test(error.message)
  ) {
    console.error(
      'Your client must be allowed to request the "post.read" scope for the Quran Reflect feed.',
    );
  }

  process.exitCode = 1;
});
