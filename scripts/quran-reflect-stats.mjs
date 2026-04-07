#!/usr/bin/env node

import process from 'node:process';
import {
  fetchReflectionCountForAyah,
  getAccessToken,
  getQuranReflectDefaultFeedOptions,
  getQuranFoundationConfig,
  loadDotEnv,
  parseOptionalIntegerList,
} from './lib/quran-reflect.mjs';

const DEFAULT_PAGE_LIMIT = 1;

function parseArgs(argv) {
  const defaultFeedOptions = getQuranReflectDefaultFeedOptions();
  const options = {
    json: false,
    languages: defaultFeedOptions.languages,
    limit: DEFAULT_PAGE_LIMIT,
    postTypeIds: defaultFeedOptions.postTypeIds,
    tab: defaultFeedOptions.tab,
    verifiedOnly: false,
    verseInput: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    if (arg === '--') {
      continue;
    }

    if (!arg.startsWith('--') && !options.verseInput) {
      options.verseInput = arg;
      continue;
    }

    if (arg === '--json') {
      options.json = true;
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

    if (arg === '--post-type-ids') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error('Missing value for --post-type-ids');
      }

      options.postTypeIds = parseOptionalIntegerList(value, '--post-type-ids');
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

    if (arg === '--verified-only') {
      options.verifiedOnly = true;
      continue;
    }

    if (arg === '--limit') {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error('Missing value for --limit');
      }

      const parsedLimit = Number.parseInt(nextValue, 10);

      if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
        throw new Error(`Invalid --limit value: ${nextValue}`);
      }

      options.limit = parsedLimit;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.verseInput) {
    throw new Error('Usage: pnpm reflections:stats -- <chapter>:<ayah> or <chapter>:<from>-<to>');
  }

  return options;
}

function parseVerseInput(verseInput) {
  const normalized = verseInput.trim();
  const match = /^(\d+):(\d+)(?:-(\d+))?$/u.exec(normalized);

  if (!match) {
    throw new Error(
      `Invalid verse input "${verseInput}". Expected formats like "2:255" or "2:255-257".`,
    );
  }

  const chapterId = Number.parseInt(match[1], 10);
  const from = Number.parseInt(match[2], 10);
  const to = match[3] ? Number.parseInt(match[3], 10) : from;

  if (chapterId < 1 || from < 1 || to < from) {
    throw new Error(`Invalid verse range "${verseInput}".`);
  }

  return {
    chapterId,
    from,
    to,
    input: normalized,
  };
}

async function fetchAllReflectionStats({
  apiBaseUrl,
  clientId,
  languages,
  limit,
  postTypeIds,
  range,
  tab,
  token,
  verifiedOnly,
}) {
  const stats = [];

  for (let ayah = range.from; ayah <= range.to; ayah += 1) {
    const reflectionsCount = await fetchReflectionCountForAyah({
      apiBaseUrl,
      ayah,
      chapterId: range.chapterId,
      clientId,
      languages,
      limit,
      postTypeIds,
      tab,
      token,
      verifiedOnly,
    });

    stats.push({
      ayahKey: `${range.chapterId}:${ayah}`,
      reflectionsCount,
    });
  }

  return {
    languages,
    postTypeIds,
    requestsMade: stats.length,
    tab,
    verseKey: range.input,
    verifiedOnly,
    stats,
  };
}

function printHumanReadableReport(result) {
  console.log(`Reflection stats for ${result.verseKey}`);
  console.log(`Exact ayah queries made: ${result.requestsMade}`);
  console.log(`Tab: ${result.tab}`);
  console.log(`Languages: ${result.languages.length > 0 ? result.languages.join(',') : 'all'}`);
  console.log(
    `Post types: ${result.postTypeIds.length > 0 ? result.postTypeIds.join(',') : 'all'}`,
  );
  console.log(`Verified only: ${result.verifiedOnly ? 'yes' : 'no'}`);
  console.log('');

  const labelWidth = Math.max(...result.stats.map((entry) => entry.ayahKey.length), 'Ayah'.length);
  const countWidth = Math.max(
    ...result.stats.map((entry) => String(entry.reflectionsCount).length),
    'Reflections'.length,
  );

  console.log(`${'Ayah'.padEnd(labelWidth)}  ${'Reflections'.padStart(countWidth)}`);
  console.log(`${'-'.repeat(labelWidth)}  ${'-'.repeat(countWidth)}`);

  for (const entry of result.stats) {
    console.log(
      `${entry.ayahKey.padEnd(labelWidth)}  ${String(entry.reflectionsCount).padStart(countWidth)}`,
    );
  }
}

async function main() {
  loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const range = parseVerseInput(options.verseInput);
  const { apiBaseUrl, authBaseUrl, clientId, clientSecret } = getQuranFoundationConfig();
  const token = await getAccessToken({
    authBaseUrl,
    clientId,
    clientSecret,
    scope: 'post.read',
  });

  const result = await fetchAllReflectionStats({
    apiBaseUrl,
    clientId,
    languages: options.languages,
    limit: options.limit,
    postTypeIds: options.postTypeIds,
    range,
    tab: options.tab,
    token,
    verifiedOnly: options.verifiedOnly,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printHumanReadableReport(result);
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
