import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';
import { getSession } from '@/lib/session';

// Initialize Redis client for rate limiting (uses same KV env vars)
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

function readDailyLimitFromEnv(key: string, fallback: number) {
  const raw = process.env[key]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

const ANONYMOUS_DAILY_LIMIT = readDailyLimitFromEnv('ANONYMOUS_DAILY_LIMIT', 4);
const AUTHENTICATED_DAILY_LIMIT = readDailyLimitFromEnv('AUTHENTICATED_DAILY_LIMIT', 10);

async function checkRateLimit(
  request: Request,
): Promise<{ allowed: true } | { allowed: false; reason: string; limit: number }> {
  const session = await getSession();
  const isAuthenticated = Boolean(session?.data?.quranFoundationId);
  const userId = session?.data?.quranFoundationId;

  // Get today's date string for the key
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (isAuthenticated && userId) {
    if (AUTHENTICATED_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    const key = `rate_limit:user:${userId}:${today}`;
    const current = await redis.incr(key);

    // Set expiry on first request of the day
    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24); // 24 hours
    }

    if (current > AUTHENTICATED_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: AUTHENTICATED_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${AUTHENTICATED_DAILY_LIMIT} reflections. Please try again tomorrow.`,
      };
    }
  } else {
    if (ANONYMOUS_DAILY_LIMIT < 0) {
      return { allowed: true };
    }

    // Anonymous user - use browser fingerprint for more reliable tracking
    const fingerprint =
      request.headers.get('x-browser-fingerprint') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const key = `rate_limit:fingerprint:${fingerprint}:${today}`;
    const current = await redis.incr(key);

    // Set expiry on first request of the day
    if (current === 1) {
      await redis.expire(key, 60 * 60 * 24); // 24 hours
    }

    if (current > ANONYMOUS_DAILY_LIMIT) {
      return {
        allowed: false,
        limit: ANONYMOUS_DAILY_LIMIT,
        reason: `You have reached your daily limit of ${ANONYMOUS_DAILY_LIMIT} reflections. Sign in with Quran Foundation for ${AUTHENTICATED_DAILY_LIMIT} reflections per day.`,
      };
    }
  }

  return { allowed: true };
}

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5';

const antidoteSystemPrompt = `You are a specialist in Islamic Psychology (Ilm an-Nafs) and Quranic Exegesis (Tafsir). Your goal is to help a user return to sakinah by transitioning from a "Materialistic/Power-centric" worldview to a "God-centric" worldview.

The Logic:
1. Analyze the External Event (what happened/what was read).
2. Analyze the Internal Feeling (the spiritual symptom).
3. Identify the Root Spiritual Drift (e.g., Fear of Poverty, Attachment to Status, Heedlessness, Social Comparison).
4. Select 1-3 Quranic Ayahs that act as direct grounding anchors—specifically verses that reframe the event through the lens of Allah's Power, Wisdom, or Provision.

Return only JSON. Do not include any introductory or trailing text. Use the Clear Quran or Sahih International logic for verse selection. Keep each reasoning brief, concrete, and under 25 words.`;

const curatorSystemPrompt = `You are an expert curator of Islamic spiritual content. Your task is to review a list of human-written reflections and select the single most effective grounding reflection for a user's specific spiritual state.

Selection Criteria:
1. Relevance: Does the reflection directly address the spiritual drift?
2. Reframing Power: Does it move the reader from a materialistic or power-centric view to a God-centric view?
3. Practicality: Is the tone empathetic and useful in a modern context?
4. Quality: Avoid reflections that are too short, overly academic, or purely personal journals without a broader lesson.

Return only JSON. Do not include any introductory or trailing text. Select exactly one candidate from the provided IDs. Keep the reason concrete and under 35 words.`;

const spiritualGuideSystemPrompt = `You are a compassionate spiritual companion designed to help Muslims navigate modern life through the Quran.

Your voice:
1. Empathetic and validating: Acknowledge that the user's feelings are real.
2. Insightful: Connect the spiritual drift to the current experience.
3. Action-oriented: End with a small, practical heart-action or dua focus.
4. Grounded: Use a modern tone that is warm and clear without sounding preachy.
5. Integrative: The intro must naturally lead into the chosen reflection and the conclusion must naturally follow from it, so the reader experiences one seamless narrative—not three separate paragraphs.

Return only JSON. Do not reproduce the reflection text itself. The intro should be 3-4 sentences. The conclusion should be 2-3 sentences.`;

const languageDetectionSystemPrompt = `Detect the primary language used in the user's input. Return a normalized ISO-639-1 language code when possible.

Rules:
1. Return a lowercase language code such as en, ar, tr, ur, fa, fr, de, es.
2. If mixed language is used, choose the language that dominates the meaning.
3. If uncertain, return en.
4. Return only JSON.`;

const reflectionTranslationSystemPrompt = `Translate the provided reflection text into the target language.

Rules:
1. Preserve line breaks and paragraph structure.
2. Keep hashtags, references, and links unchanged when possible.
3. Keep tone and meaning faithful; do not summarize.
4. Return only JSON.`;

const chatTitleSystemPrompt = `Write a very short title for this reflection session.

Rules:
1. Use the same language as the user input.
2. Keep it concrete, calm, and natural.
3. Prefer 3 to 6 words.
4. Do not use quotation marks.
5. Return only JSON.`;

const antidoteResponseSchema = {
  additionalProperties: false,
  properties: {
    antidotes: {
      items: {
        additionalProperties: false,
        properties: {
          ayah_no: { type: 'string' },
          reasoning: { type: 'string' },
          surah_name: { type: 'string' },
          surah_no: { type: 'integer' },
        },
        required: ['surah_name', 'surah_no', 'ayah_no', 'reasoning'],
        type: 'object',
      },
      maxItems: 3,
      minItems: 1,
      type: 'array',
    },
    diagnosis: {
      additionalProperties: false,
      properties: {
        god_centric_reframe: { type: 'string' },
        materialistic_narrative: { type: 'string' },
        spiritual_drift: { type: 'string' },
      },
      required: ['spiritual_drift', 'materialistic_narrative', 'god_centric_reframe'],
      type: 'object',
    },
  },
  required: ['diagnosis', 'antidotes'],
  type: 'object',
} as const;

const curatorResponseSchema = {
  additionalProperties: false,
  properties: {
    selected_reflection_id: { type: 'integer' },
    selection_reason: { type: 'string' },
  },
  required: ['selected_reflection_id', 'selection_reason'],
  type: 'object',
} as const;

const spiritualGuideResponseSchema = {
  additionalProperties: false,
  properties: {
    conclusion_text: { type: 'string' },
    intro_text: { type: 'string' },
  },
  required: ['intro_text', 'conclusion_text'],
  type: 'object',
} as const;

const languageDetectionResponseSchema = {
  additionalProperties: false,
  properties: {
    language_code: { type: 'string' },
  },
  required: ['language_code'],
  type: 'object',
} as const;

const reflectionTranslationResponseSchema = {
  additionalProperties: false,
  properties: {
    translated_text: { type: 'string' },
  },
  required: ['translated_text'],
  type: 'object',
} as const;

const chatTitleResponseSchema = {
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
  },
  required: ['title'],
  type: 'object',
} as const;

type OpenAIAntidote = {
  ayah_no: string;
  reasoning: string;
  surah_name: string;
  surah_no: number;
};

type AntidoteResponse = {
  antidotes: OpenAIAntidote[];
  diagnosis: {
    god_centric_reframe: string;
    materialistic_narrative: string;
    spiritual_drift: string;
  };
};

type Diagnosis = AntidoteResponse['diagnosis'];

type CuratedReflectionResponse = {
  selected_reflection_id: number;
  selection_reason: string;
};

type SpiritualGuideResponse = {
  conclusion_text: string;
  intro_text: string;
};

type LanguageDetectionResponse = {
  language_code: string;
};

type ReflectionTranslationResponse = {
  translated_text: string;
};

type ChatTitleResponse = {
  title: string;
};

type EnrichedAntidote = OpenAIAntidote & {
  related_reflections: RelatedReflection[];
};

type CuratedReflectionCandidate = RelatedReflection & {
  ayah_no: string;
  surah_name: string;
  surah_no: number;
};

type SelectedReflection = {
  ayah_no: string;
  reflection_is_translated: boolean;
  reflection_original_body: string | null;
  reflection_source_language_code: string | null;
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

type PipelineStepKey =
  | 'language_detection'
  | 'ayah_selection'
  | 'reflection_fetch'
  | 'reflection_curation'
  | 'reflection_translation'
  | 'guide_generation';

type PipelineStepEvent = {
  label: string;
  status: 'completed' | 'in_progress';
  step: PipelineStepKey;
  type: 'step';
};

type PipelineResultEvent = {
  data: {
    antidotes: EnrichedAntidote[];
    chat_title: string;
    detected_language_code: string;
    diagnosis: Diagnosis;
    reflection_guide: ReflectionGuide | null;
    selected_reflection: SelectedReflection | null;
  };
  type: 'result';
};

type PipelineErrorEvent = {
  error: string;
  type: 'error';
};

type PipelineEvent = PipelineStepEvent | PipelineResultEvent | PipelineErrorEvent;

const SUPPORTED_LANGUAGE_CODES = new Set([
  'aa',
  'am',
  'ar',
  'as',
  'az',
  'bg',
  'bm',
  'bn',
  'bs',
  'ce',
  'cs',
  'de',
  'dv',
  'en',
  'es',
  'fa',
  'fi',
  'fr',
  'gu',
  'ha',
  'he',
  'hi',
  'hr',
  'id',
  'it',
  'ja',
  'kk',
  'km',
  'kn',
  'ko',
  'ku',
  'ky',
  'lg',
  'ln',
  'lt',
  'mk',
  'ml',
  'mr',
  'ms',
  'ne',
  'nl',
  'no',
  'om',
  'pa',
  'pl',
  'ps',
  'pt',
  'rn',
  'ro',
  'ru',
  'rw',
  'sd',
  'si',
  'so',
  'sq',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'tg',
  'th',
  'tl',
  'tr',
  'tt',
  'ug',
  'uk',
  'ur',
  'uz',
  'vi',
  'yo',
  'zh',
]);

const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  arabic: 'ar',
  azeri: 'az',
  bengali: 'bn',
  bosnian: 'bs',
  chechen: 'ce',
  chinese: 'zh',
  croatian: 'hr',
  czech: 'cs',
  divehi: 'dv',
  dutch: 'nl',
  english: 'en',
  finnish: 'fi',
  french: 'fr',
  german: 'de',
  hebrew: 'he',
  hindi: 'hi',
  indonesian: 'id',
  italian: 'it',
  japanese: 'ja',
  korean: 'ko',
  kurdish: 'ku',
  malay: 'ms',
  malayalam: 'ml',
  nepali: 'ne',
  norwegian: 'no',
  pashto: 'ps',
  persian: 'fa',
  polish: 'pl',
  portuguese: 'pt',
  romanian: 'ro',
  russian: 'ru',
  sinhala: 'si',
  somali: 'so',
  spanish: 'es',
  swahili: 'sw',
  swedish: 'sv',
  tagalog: 'tl',
  tajik: 'tg',
  tamil: 'ta',
  telugu: 'te',
  thai: 'th',
  turkish: 'tr',
  ukrainian: 'uk',
  urdu: 'ur',
  uzbek: 'uz',
  vietnamese: 'vi',
};

function normalizeAyahNo(surahNo: number, ayahNo: string) {
  const normalized = ayahNo.trim();
  const exactMatch = new RegExp(`^${surahNo}:(\\d+(?:-\\d+)?)$`, 'u').exec(normalized);

  if (exactMatch) {
    return exactMatch[1];
  }

  return normalized;
}

function normalizeLanguageCode(rawCode: string) {
  const normalized = rawCode.trim().toLowerCase();

  if (!normalized) {
    return 'en';
  }

  const base = normalized.split('-')[0] ?? normalized;

  if (SUPPORTED_LANGUAGE_CODES.has(base)) {
    return base;
  }

  return 'en';
}

function getLanguageCodeFromReflectionLanguageName(languageName: string | null) {
  if (!languageName) {
    return null;
  }

  const key = languageName.trim().toLowerCase();

  return LANGUAGE_NAME_TO_CODE[key] ?? null;
}

function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const output = Array.isArray(payload.output) ? payload.output : [];

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];

    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const maybeText = (block as { text?: unknown }).text;

      if (typeof maybeText === 'string' && maybeText.trim().length > 0) {
        return maybeText;
      }
    }
  }

  return null;
}

function isLlmDebugEnabled() {
  return process.env.LLM_DEBUG === 'true';
}

function logLlmDebug(message: string, details: Record<string, unknown>) {
  if (!isLlmDebugEnabled()) {
    return;
  }

  console.log('[llm-debug]', message, details);
}

async function callStructuredOpenAI<T>({
  inputText,
  instructions,
  maxOutputTokens,
  schema,
  schemaName,
}: {
  inputText: string;
  instructions: string;
  maxOutputTokens: number;
  schema: Record<string, unknown>;
  schemaName: string;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: inputText,
              type: 'input_text',
            },
          ],
          role: 'user',
        },
      ],
      instructions,
      max_output_tokens: maxOutputTokens,
      model: OPENAI_MODEL,
      reasoning: {
        effort: 'minimal',
      },
      text: {
        verbosity: 'low',
        format: {
          name: schemaName,
          schema,
          strict: true,
          type: 'json_schema',
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${response.statusText} ${details}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  logLlmDebug('received openai payload', {
    hasOutputText: typeof payload.output_text === 'string',
    schemaName,
    status: payload.status,
  });

  const refusal = payload.refusal;

  if (typeof refusal === 'string' && refusal.trim().length > 0) {
    throw new Error(refusal);
  }

  const text = extractResponseText(payload);

  if (!text) {
    logLlmDebug('missing structured json text', {
      schemaName,
    });
    throw new Error('OpenAI did not return structured JSON text.');
  }

  logLlmDebug('raw structured text extracted', {
    preview: text.slice(0, 500),
    schemaName,
    textEndsWithBrace: text.trim().endsWith('}'),
    textLength: text.length,
    textStartsWithBrace: text.trim().startsWith('{'),
  });

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    logLlmDebug('failed to parse structured json', {
      parseError: error instanceof Error ? error.message : String(error),
      preview: text.slice(0, 1000),
      schemaName,
      textLength: text.length,
    });
    throw error;
  }
}

async function callAntidoteModel(eventText: string, feelingText: string) {
  return callStructuredOpenAI<AntidoteResponse>({
    inputText: `User Input:\n\nEvent/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"\n\nTask:\nProvide only the most relevant Quranic grounding passages. Each suggestion must include the Surah name, Surah number, Ayah number, and a short spiritual reframing rationale.`,
    instructions: antidoteSystemPrompt,
    maxOutputTokens: 350,
    schema: antidoteResponseSchema,
    schemaName: 'quranic_antidotes',
  });
}

async function detectInputLanguage(eventText: string, feelingText: string) {
  const response = await callStructuredOpenAI<LanguageDetectionResponse>({
    inputText: `Event/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"`,
    instructions: languageDetectionSystemPrompt,
    maxOutputTokens: 40,
    schema: languageDetectionResponseSchema,
    schemaName: 'input_language_detection',
  });

  return normalizeLanguageCode(response.language_code);
}

async function enrichAntidotes(antidotes: OpenAIAntidote[]) {
  return Promise.all(
    antidotes.map(async (antidote): Promise<EnrichedAntidote> => {
      const normalizedAyahNo = normalizeAyahNo(antidote.surah_no, antidote.ayah_no);
      let relatedReflections: RelatedReflection[] = [];

      try {
        relatedReflections = await getRelatedReflectionsForAyah(
          antidote.surah_no,
          normalizedAyahNo,
        );
      } catch (error) {
        console.warn('[quran-reflect] failed to fetch related reflections', {
          ayahNo: normalizedAyahNo,
          message: error instanceof Error ? error.message : 'Unknown error',
          surahNo: antidote.surah_no,
        });
      }

      return {
        ...antidote,
        ayah_no: normalizedAyahNo,
        related_reflections: relatedReflections,
      };
    }),
  );
}

function buildReflectionCandidates(antidotes: EnrichedAntidote[]) {
  return antidotes.flatMap((antidote) =>
    antidote.related_reflections.map(
      (reflection): CuratedReflectionCandidate => ({
        ...reflection,
        ayah_no: antidote.ayah_no,
        surah_name: antidote.surah_name,
        surah_no: antidote.surah_no,
      }),
    ),
  );
}

async function curateReflection(
  diagnosis: Diagnosis,
  candidates: CuratedReflectionCandidate[],
): Promise<SelectedReflection | null> {
  if (candidates.length === 0) {
    return null;
  }

  const serializedCandidates = candidates
    .map(
      (candidate) =>
        `[ID: ${candidate.id}] [Ayah: ${candidate.surah_no}:${candidate.ayah_no}] "${candidate.body}"`,
    )
    .join('\n\n');

  const selection = await callStructuredOpenAI<CuratedReflectionResponse>({
    inputText: `Part 1: The Spiritual Diagnosis

Spiritual Drift: ${diagnosis.spiritual_drift}

Materialistic Narrative: ${diagnosis.materialistic_narrative}

God-Centric Reframe: ${diagnosis.god_centric_reframe}

Part 2: Candidate Reflections
Below is a list of reflections fetched from the community. Each has an ID and the reflection text:
${serializedCandidates}

Task:
Analyze the candidate reflections against the diagnosis. Select the one reflection that best grounds the user and addresses their current drift.`,
    instructions: curatorSystemPrompt,
    maxOutputTokens: 180,
    schema: curatorResponseSchema,
    schemaName: 'curated_reflection_selection',
  });

  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selection.selected_reflection_id) ?? null;

  return {
    ayah_no: selectedCandidate?.ayah_no ?? '',
    reflection_is_translated: false,
    reflection_original_body: selectedCandidate?.body ?? null,
    reflection_source_language_code: getLanguageCodeFromReflectionLanguageName(
      selectedCandidate?.languageName ?? null,
    ),
    reflection: selectedCandidate
      ? {
          authorName: selectedCandidate.authorName,
          body: selectedCandidate.body,
          commentsCount: selectedCandidate.commentsCount,
          createdAt: selectedCandidate.createdAt,
          id: selectedCandidate.id,
          languageName: selectedCandidate.languageName,
          likesCount: selectedCandidate.likesCount,
          postTypeName: selectedCandidate.postTypeName,
          references: selectedCandidate.references,
        }
      : null,
    selected_reflection_id: selection.selected_reflection_id,
    selection_reason: selection.selection_reason,
    surah_name: selectedCandidate?.surah_name ?? '',
    surah_no: selectedCandidate?.surah_no ?? 0,
  };
}

async function translateSelectedReflectionIfNeeded(
  selectedReflection: SelectedReflection | null,
  targetLanguageCode: string,
) {
  if (!selectedReflection?.reflection) {
    logLlmDebug('reflection translation skipped: no selected reflection body', {
      hasSelectedReflection: Boolean(selectedReflection),
      targetLanguageCode,
    });
    return selectedReflection;
  }

  const sourceLanguageCode =
    selectedReflection.reflection_source_language_code ??
    getLanguageCodeFromReflectionLanguageName(selectedReflection.reflection.languageName);

  if (!sourceLanguageCode) {
    logLlmDebug('reflection translation skipped: unknown source language', {
      reflectionId: selectedReflection.reflection.id,
      reflectionLanguageName: selectedReflection.reflection.languageName,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: null,
    };
  }

  if (sourceLanguageCode === targetLanguageCode) {
    logLlmDebug('reflection translation skipped: source equals target', {
      reflectionId: selectedReflection.reflection.id,
      sourceLanguageCode,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: sourceLanguageCode,
    };
  }

  logLlmDebug('reflection translation started', {
    reflectionBodyLength: selectedReflection.reflection.body.length,
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
  });

  const translation = await callStructuredOpenAI<ReflectionTranslationResponse>({
    inputText: `Target language code: ${targetLanguageCode}

Source language code: ${sourceLanguageCode}

Reflection text:
${selectedReflection.reflection.body}`,
    instructions: reflectionTranslationSystemPrompt,
    maxOutputTokens: 1200,
    schema: reflectionTranslationResponseSchema,
    schemaName: 'selected_reflection_translation',
  });

  const translatedText = translation.translated_text.trim();
  const usedOriginalFallback = translatedText.length === 0;

  logLlmDebug('reflection translation completed', {
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
    translatedTextLength: translatedText.length,
    usedOriginalFallback,
  });

  return {
    ...selectedReflection,
    reflection_is_translated: true,
    reflection_source_language_code: sourceLanguageCode,
    reflection: {
      ...selectedReflection.reflection,
      body: translatedText || selectedReflection.reflection.body,
    },
  };
}

async function buildReflectionGuide({
  detectedLanguageCode,
  diagnosis,
  eventContent,
  selectedReflection,
  userFeeling,
}: {
  detectedLanguageCode: string;
  diagnosis: Diagnosis;
  eventContent: string;
  selectedReflection: SelectedReflection | null;
  userFeeling: string;
}): Promise<ReflectionGuide | null> {
  if (!selectedReflection?.reflection) {
    return null;
  }

  const inputText = `Context for Synthesis:

The Event: ${eventContent}

User Feeling: ${userFeeling}

Diagnosis:
- Drift: ${diagnosis.spiritual_drift}
- Materialistic View: ${diagnosis.materialistic_narrative}
- God-centric Reframe: ${diagnosis.god_centric_reframe}

Output language: ${detectedLanguageCode}

The Chosen Reflection (for context only): ${selectedReflection.reflection.body}

Task:
Generate two pieces of text to wrap around the selected reflection.

intro_text: Validate the user's feeling about the event. Gently point out how the materialistic view is affecting their heart. Then naturally bridge into the chosen reflection by mentioning its core theme, the author's name (if available in the reflection), or the insight it carries—so the reader feels the reflection is a continuation of your words, not a separate block.

conclusion_text: Pick up where the reflection leaves off. Echo a specific phrase, image, or idea from the reflection to create continuity. Then distill the grounding lesson into a short, practical heart-action or dua focus based on the God-centric reframe.

Constraint: Do not reproduce the reflection text itself—only reference its themes. The intro should flow into the reflection and the conclusion should flow out of it, as one integrated reading experience. Only return the JSON.`;
  const requestParams = {
    inputText,
    instructions: spiritualGuideSystemPrompt,
    schema: spiritualGuideResponseSchema,
    schemaName: 'spiritual_guide_wrapper',
  } as const;

  try {
    return await callStructuredOpenAI<SpiritualGuideResponse>({
      ...requestParams,
      maxOutputTokens: 900,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeTruncatedJson =
      message.includes('Unterminated string in JSON') ||
      message.includes('Unexpected end of JSON input');

    if (!looksLikeTruncatedJson) {
      throw error;
    }

    console.warn('[spiritual-guide] retrying after likely truncated JSON', {
      detectedLanguageCode,
      message,
    });

    return callStructuredOpenAI<SpiritualGuideResponse>({
      ...requestParams,
      maxOutputTokens: 1400,
    });
  }
}

async function generateChatTitle({
  detectedLanguageCode,
  eventContent,
  userFeeling,
}: {
  detectedLanguageCode: string;
  eventContent: string;
  userFeeling: string;
}) {
  const response = await callStructuredOpenAI<ChatTitleResponse>({
    inputText: `Output language: ${detectedLanguageCode}

Event/Content: ${eventContent}

User Feeling: ${userFeeling}`,
    instructions: chatTitleSystemPrompt,
    maxOutputTokens: 40,
    schema: chatTitleResponseSchema,
    schemaName: 'chat_title',
  });

  return response.title.trim() || 'Reflection';
}

function createPipelineStep(
  step: PipelineStepKey,
  label: string,
  status: PipelineStepEvent['status'],
): PipelineStepEvent {
  return {
    label,
    status,
    step,
    type: 'step',
  };
}

function toJsonLine(event: PipelineEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  // Check rate limit first
  const rateLimitCheck = await checkRateLimit(request);
  if (!rateLimitCheck.allowed) {
    return NextResponse.json({ error: rateLimitCheck.reason }, { status: 429 });
  }

  let body: {
    eventContent?: string;
    userFeeling?: string;
  };

  try {
    body = (await request.json()) as {
      eventContent?: string;
      userFeeling?: string;
    };
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid JSON body.',
      },
      { status: 400 },
    );
  }

  const eventContent = body.eventContent?.trim();
  const userFeeling = body.userFeeling?.trim();

  if (!eventContent || !userFeeling) {
    return NextResponse.json(
      { error: 'Both eventContent and userFeeling are required.' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PipelineEvent) => {
        controller.enqueue(encoder.encode(toJsonLine(event)));
      };

      try {
        send(
          createPipelineStep('language_detection', 'Detecting your input language', 'in_progress'),
        );
        const detectedLanguageCode = await detectInputLanguage(eventContent, userFeeling);
        send(
          createPipelineStep('language_detection', 'Detecting your input language', 'completed'),
        );

        send(createPipelineStep('ayah_selection', 'Selecting grounding ayahs', 'in_progress'));
        const response = await callAntidoteModel(eventContent, userFeeling);
        send(createPipelineStep('ayah_selection', 'Selecting grounding ayahs', 'completed'));

        send(
          createPipelineStep('reflection_fetch', 'Collecting relevant reflections', 'in_progress'),
        );
        const enrichedAntidotes = await enrichAntidotes(response.antidotes);
        send(
          createPipelineStep('reflection_fetch', 'Collecting relevant reflections', 'completed'),
        );

        send(
          createPipelineStep('reflection_curation', 'Curating the strongest match', 'in_progress'),
        );
        const selectedReflection = await curateReflection(
          response.diagnosis,
          buildReflectionCandidates(enrichedAntidotes),
        );
        send(
          createPipelineStep('reflection_curation', 'Curating the strongest match', 'completed'),
        );

        send(
          createPipelineStep(
            'reflection_translation',
            'Aligning reflection language with your input',
            'in_progress',
          ),
        );
        let localizedSelectedReflection = selectedReflection;
        try {
          localizedSelectedReflection = await translateSelectedReflectionIfNeeded(
            selectedReflection,
            detectedLanguageCode,
          );
        } catch (error) {
          console.warn('[reflection-translation] failed to translate selected reflection', {
            detectedLanguageCode,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        send(
          createPipelineStep(
            'reflection_translation',
            'Aligning reflection language with your input',
            'completed',
          ),
        );

        send(
          createPipelineStep('guide_generation', 'Preparing your guided reading', 'in_progress'),
        );
        const [reflectionGuide, chatTitle] = await Promise.all([
          buildReflectionGuide({
            detectedLanguageCode,
            diagnosis: response.diagnosis,
            eventContent,
            selectedReflection: localizedSelectedReflection,
            userFeeling,
          }),
          generateChatTitle({
            detectedLanguageCode,
            eventContent,
            userFeeling,
          }),
        ]);
        send(createPipelineStep('guide_generation', 'Preparing your guided reading', 'completed'));

        const resultEvent: PipelineResultEvent = {
          data: {
            antidotes: enrichedAntidotes,
            chat_title: chatTitle,
            detected_language_code: detectedLanguageCode,
            diagnosis: response.diagnosis,
            reflection_guide: reflectionGuide,
            selected_reflection: localizedSelectedReflection,
          },
          type: 'result',
        };

        send(resultEvent);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        send({
          error: message,
          type: 'error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
