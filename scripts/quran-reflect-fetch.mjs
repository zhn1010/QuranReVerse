#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  fetchReflectionFeedPage,
  getAccessToken,
  getQuranReflectDefaultFeedOptions,
  getQuranFoundationConfig,
  loadDotEnv,
  parseOptionalIntegerList,
} from './lib/quran-reflect.mjs';

const DEFAULT_PAGE_LIMIT = 50;

function printUsage() {
  console.log(
    [
      'Usage:',
      '  pnpm reflections:fetch -- <chapter>:<ayah> [more-inputs...]',
      '  pnpm reflections:fetch -- <chapter>:<from>-<to> [more-inputs...]',
      '',
      'Options:',
      '  --json              Print JSON',
      '  --languages <ids>   Comma-separated language IDs, for example 2 or 1,2',
      '  --output <path>     Write JSON to a file',
      '  --limit <n>         Page size per API request (default: 50)',
      '  --post-type-ids <ids>  Comma-separated post type IDs, 1=Reflection, 2=Lesson',
      '  --tab <name>        Feed tab, for example public or popular',
      '  --verified-only     Only include verified contributors',
      '  --help              Show this help',
    ].join('\n'),
  );
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
    input: normalized,
    to,
  };
}

function parseArgs(argv) {
  const defaultFeedOptions = getQuranReflectDefaultFeedOptions();
  const options = {
    inputs: [],
    json: false,
    languages: defaultFeedOptions.languages,
    limit: DEFAULT_PAGE_LIMIT,
    output: null,
    postTypeIds: defaultFeedOptions.postTypeIds,
    tab: defaultFeedOptions.tab,
    verifiedOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--help') {
      printUsage();
      process.exit(0);
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

    if (arg === '--verified-only') {
      options.verifiedOnly = true;
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

    if (arg === '--limit') {
      const value = argv[index + 1];
      const parsedValue = Number.parseInt(value ?? '', 10);

      if (!Number.isInteger(parsedValue) || parsedValue < 1) {
        throw new Error(`Invalid --limit value: ${value}`);
      }

      options.limit = parsedValue;
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

    if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    options.inputs.push(parseVerseInput(arg));
  }

  if (options.inputs.length === 0) {
    throw new Error('Provide at least one verse input. Use --help for usage.');
  }

  return options;
}

function normalizePost(post) {
  return {
    author: post.author
      ? {
          displayName: post.author.displayName,
          firstName: post.author.firstName,
          id: post.author.id,
          lastName: post.author.lastName,
          username: post.author.username,
          verified: post.author.verified,
        }
      : null,
    body: post.body ?? '',
    commentsCount: post.commentsCount ?? 0,
    createdAt: post.createdAt,
    id: post.id,
    languageName: post.languageName ?? null,
    likesCount: post.likesCount ?? 0,
    postTypeId: post.postTypeId ?? null,
    postTypeName: post.postTypeName ?? null,
    publishedAt: post.publishedAt ?? null,
    references: Array.isArray(post.references)
      ? post.references.map((reference) => ({
          chapterId: reference.chapterId ?? null,
          from: reference.from ?? null,
          id: reference.id ?? null,
          to: reference.to ?? null,
        }))
      : [],
    room: post.room
      ? {
          id: post.room.id,
          name: post.room.name,
          subdomain: post.room.subdomain,
          verified: post.room.verified,
        }
      : null,
    updatedAt: post.updatedAt,
    viewsCount: post.viewsCount ?? 0,
  };
}

async function fetchAllPostsForInput({
  apiBaseUrl,
  clientId,
  input,
  languages,
  limit,
  postTypeIds,
  tab,
  token,
  verifiedOnly,
}) {
  let page = 1;
  let total = 0;
  let pages = 0;
  const posts = [];

  while (true) {
    const payload = await fetchReflectionFeedPage({
      apiBaseUrl,
      chapterId: input.chapterId,
      clientId,
      from: input.from,
      languages,
      limit,
      page,
      postTypeIds,
      tab,
      to: input.to,
      token,
      verifiedOnly,
    });

    total = Number(payload.total ?? total ?? 0);
    pages = Number(payload.pages ?? pages ?? 0);

    for (const post of Array.isArray(payload.data) ? payload.data : []) {
      posts.push(normalizePost(post));
    }

    if (!pages || page >= pages) {
      break;
    }

    page += 1;
  }

  return {
    input: input.input,
    languages,
    pageLimit: limit,
    pagesFetched: page,
    posts,
    postTypeIds,
    tab,
    totalPosts: total,
    verifiedOnly,
  };
}

function truncate(text, length) {
  if (text.length <= length) {
    return text;
  }

  return `${text.slice(0, length - 1).trimEnd()}…`;
}

function printResult(result) {
  console.log(`Reflections for ${result.input}`);
  console.log(`Total posts: ${result.totalPosts}`);
  console.log(`Pages fetched: ${result.pagesFetched}`);
  console.log(`Tab: ${result.tab}`);
  console.log(`Languages: ${result.languages.length > 0 ? result.languages.join(',') : 'all'}`);
  console.log(
    `Post types: ${result.postTypeIds.length > 0 ? result.postTypeIds.join(',') : 'all'}`,
  );
  console.log(`Verified only: ${result.verifiedOnly ? 'yes' : 'no'}`);
  console.log('');

  for (const post of result.posts) {
    const authorLabel =
      post.author?.displayName ||
      [post.author?.firstName, post.author?.lastName].filter(Boolean).join(' ') ||
      post.author?.username ||
      'Unknown author';

    console.log(`[${post.id}] ${authorLabel}`);
    console.log(
      `  ${post.createdAt ?? 'unknown date'} | ${post.likesCount} likes | ${post.commentsCount} comments`,
    );
    console.log(`  ${truncate(post.body.replace(/\s+/gu, ' ').trim(), 280)}`);
    console.log('');
  }
}

async function main() {
  loadDotEnv();

  const options = parseArgs(process.argv.slice(2));
  const { apiBaseUrl, authBaseUrl, clientId, clientSecret } = getQuranFoundationConfig();
  const token = await getAccessToken({
    authBaseUrl,
    clientId,
    clientSecret,
    scope: 'post.read',
  });

  const results = [];

  for (const input of options.inputs) {
    results.push(
      await fetchAllPostsForInput({
        apiBaseUrl,
        clientId,
        input,
        languages: options.languages,
        limit: options.limit,
        postTypeIds: options.postTypeIds,
        tab: options.tab,
        token,
        verifiedOnly: options.verifiedOnly,
      }),
    );
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    queriedInputs: results.map((result) => result.input),
    results,
    verifiedOnly: options.verifiedOnly,
  };

  if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  for (const result of results) {
    printResult(result);
  }

  if (options.output) {
    console.log(`Saved JSON to ${path.resolve(process.cwd(), options.output)}`);
  }
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
