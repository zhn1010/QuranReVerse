import { NextResponse } from 'next/server';
import { getRelatedReflectionsForAyah, type RelatedReflection } from '@/lib/quran-reflect';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5';

const antidoteSystemPrompt = `You are a specialist in Islamic Psychology (Ilm an-Nafs) and Quranic Exegesis (Tafsir). Your goal is to help a user transition from a "Materialistic/Power-centric" worldview to a "God-centric" worldview.

The Logic:
1. Analyze the External Event (what happened/what was read).
2. Analyze the Internal Feeling (the spiritual symptom).
3. Identify the Root Spiritual Drift (e.g., Fear of Poverty, Attachment to Status, Heedlessness, Social Comparison).
4. Select 1-3 Quranic Ayahs that act as a direct Antidote—specifically verses that reframe the event through the lens of Allah's Power, Wisdom, or Provision.

Return only JSON. Do not include any introductory or trailing text. Use the Clear Quran or Sahih International logic for verse selection. Keep each reasoning brief, concrete, and under 25 words.`;

const curatorSystemPrompt = `You are an expert curator of Islamic spiritual content. Your task is to review a list of human-written reflections and select the single most effective antidote for a user's specific spiritual state.

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

Return only JSON. Do not include the reflection text itself. The intro should be 3-4 sentences. The conclusion should be 2-3 sentences.`;

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

function normalizeAyahNo(surahNo: number, ayahNo: string) {
  const normalized = ayahNo.trim();
  const exactMatch = new RegExp(`^${surahNo}:(\\d+(?:-\\d+)?)$`, 'u').exec(normalized);

  if (exactMatch) {
    return exactMatch[1];
  }

  return normalized;
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
  const refusal = payload.refusal;

  if (typeof refusal === 'string' && refusal.trim().length > 0) {
    throw new Error(refusal);
  }

  const text = extractResponseText(payload);

  if (!text) {
    throw new Error('OpenAI did not return structured JSON text.');
  }

  return JSON.parse(text) as T;
}

async function callAntidoteModel(eventText: string, feelingText: string) {
  return callStructuredOpenAI<AntidoteResponse>({
    inputText: `User Input:\n\nEvent/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"\n\nTask:\nProvide only the most relevant Quranic antidotes. Each suggestion must include the Surah name, Surah number, Ayah number, and a short Spiritual Reframing reasoning.`,
    instructions: antidoteSystemPrompt,
    maxOutputTokens: 350,
    schema: antidoteResponseSchema,
    schemaName: 'quranic_antidotes',
  });
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
Analyze the candidate reflections against the diagnosis. Select the one reflection that best serves as an antidote to the user's current drift.`,
    instructions: curatorSystemPrompt,
    maxOutputTokens: 180,
    schema: curatorResponseSchema,
    schemaName: 'curated_reflection_selection',
  });

  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selection.selected_reflection_id) ?? null;

  return {
    ayah_no: selectedCandidate?.ayah_no ?? '',
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

async function buildReflectionGuide({
  diagnosis,
  eventContent,
  selectedReflection,
  userFeeling,
}: {
  diagnosis: Diagnosis;
  eventContent: string;
  selectedReflection: SelectedReflection | null;
  userFeeling: string;
}): Promise<ReflectionGuide | null> {
  if (!selectedReflection?.reflection) {
    return null;
  }

  return callStructuredOpenAI<SpiritualGuideResponse>({
    inputText: `Context for Synthesis:

The Event: ${eventContent}

User Feeling: ${userFeeling}

Diagnosis:
- Drift: ${diagnosis.spiritual_drift}
- Materialistic View: ${diagnosis.materialistic_narrative}
- God-centric Reframe: ${diagnosis.god_centric_reframe}

The Chosen Reflection (for context only): ${selectedReflection.reflection.body}

Task:
Generate two pieces of text to wrap around the selected reflection.

intro_text: Validate the user's feeling about the event. Gently point out how the materialistic view is affecting their heart, and segue into the reflection as a source of God-centric clarity.

conclusion_text: Summarize the antidote. Provide a short, practical heart-action or a dua focus based on the God-centric reframe to help the user move forward today.

Constraint: Do not include the reflection text itself. Only return the JSON.`,
    instructions: spiritualGuideSystemPrompt,
    maxOutputTokens: 260,
    schema: spiritualGuideResponseSchema,
    schemaName: 'spiritual_guide_wrapper',
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      eventContent?: string;
      userFeeling?: string;
    };

    const eventContent = body.eventContent?.trim();
    const userFeeling = body.userFeeling?.trim();

    if (!eventContent || !userFeeling) {
      return NextResponse.json(
        { error: 'Both eventContent and userFeeling are required.' },
        { status: 400 },
      );
    }

    const response = await callAntidoteModel(eventContent, userFeeling);
    const enrichedAntidotes = await enrichAntidotes(response.antidotes);
    const selectedReflection = await curateReflection(
      response.diagnosis,
      buildReflectionCandidates(enrichedAntidotes),
    );
    const reflectionGuide = await buildReflectionGuide({
      diagnosis: response.diagnosis,
      eventContent,
      selectedReflection,
      userFeeling,
    });

    return NextResponse.json({
      antidotes: enrichedAntidotes,
      diagnosis: response.diagnosis,
      reflection_guide: reflectionGuide,
      selected_reflection: selectedReflection,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 },
    );
  }
}
