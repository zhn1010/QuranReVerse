import { NextResponse } from 'next/server';
import { getVerseWithTranslation, type EnrichedAyah } from '@/lib/quran-client';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5';

const systemPrompt = `You are a specialist in Islamic Psychology (Ilm an-Nafs) and Quranic Exegesis (Tafsir). Your goal is to help a user transition from a "Materialistic/Power-centric" worldview to a "God-centric" worldview.

The Logic:
1. Analyze the External Event (what happened/what was read).
2. Analyze the Internal Feeling (the spiritual symptom).
3. Identify the Root Spiritual Drift (e.g., Fear of Poverty, Attachment to Status, Heedlessness, Social Comparison).
4. Select 1-3 Quranic Ayahs that act as a direct Antidote—specifically verses that reframe the event through the lens of Allah's Power, Wisdom, or Provision.

Return only JSON. Do not include any introductory or trailing text. Use the Clear Quran or Sahih International logic for verse selection. Keep each reasoning brief, concrete, and under 25 words.`;

const responseSchema = {
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

type EnrichedAntidote = OpenAIAntidote & {
  verse: EnrichedAyah | null;
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

async function callOpenAI(eventText: string, feelingText: string) {
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
              text: `User Input:\n\nEvent/Content: "${eventText}"\n\nUser Feeling: "${feelingText}"\n\nTask:\nProvide only the most relevant Quranic antidotes. Each suggestion must include the Surah name, Surah number, Ayah number, and a short Spiritual Reframing reasoning.`,
              type: 'input_text',
            },
          ],
          role: 'user',
        },
      ],
      instructions: systemPrompt,
      max_output_tokens: 350,
      model: OPENAI_MODEL,
      reasoning: {
        effort: 'minimal',
      },
      text: {
        verbosity: 'low',
        format: {
          name: 'quranic_antidotes',
          schema: responseSchema,
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

  return JSON.parse(text) as AntidoteResponse;
}

async function enrichAntidotes(antidotes: OpenAIAntidote[]) {
  return Promise.all(
    antidotes.map(async (antidote): Promise<EnrichedAntidote> => {
      const normalizedAyahNo = normalizeAyahNo(antidote.surah_no, antidote.ayah_no);

      return {
        ...antidote,
        ayah_no: normalizedAyahNo,
        verse: await getVerseWithTranslation(
          antidote.surah_no,
          normalizedAyahNo,
          antidote.surah_name,
        ),
      };
    }),
  );
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

    const response = await callOpenAI(eventContent, userFeeling);
    const enrichedAntidotes = await enrichAntidotes(response.antidotes);

    return NextResponse.json({
      antidotes: enrichedAntidotes,
      diagnosis: response.diagnosis,
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
