import { callStructuredOpenAI } from '@/lib/openai-client';
import { chatTitleSystemPrompt, spiritualGuideSystemPrompt } from '@/lib/antidotes/prompts';
import { chatTitleResponseSchema, spiritualGuideResponseSchema } from '@/lib/antidotes/schemas';
import {
  FALLBACK_CHAT_TITLE,
  looksLikeTruncatedJsonError,
  noopDebugLogger,
  type OpenAIServiceDeps,
} from '@/lib/antidotes/service-shared';
import type {
  ChatTitleResponse,
  Diagnosis,
  ReflectionGuide,
  SelectedReflection,
  SpiritualGuideResponse,
} from '@/lib/antidotes/types';

export async function buildReflectionGuide(
  {
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
  },
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
    warnLogger = console,
  }: OpenAIServiceDeps = {},
): Promise<ReflectionGuide | null> {
  if (!selectedReflection?.reflection) {
    return null;
  }

  const requestParams = {
    inputText: `Context for Synthesis:

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

intro_text: Validate the user's feeling about the event. Gently point out how the materialistic view is affecting their heart. Then naturally bridge into the chosen reflection by mentioning its core theme, the insight it carries—so the reader feels the reflection is a continuation of your words, not a separate block.

conclusion_text: Pick up where the reflection leaves off by echoing a specific phrase, keyword, or central metaphor from it to ensure a seamless transition. Using that insight as a bridge, reframe the user's original event—not through a list of actions, but by describing how this Quranic perspective transforms the 'heavy' weight of their situation into something 'purposeful' or 'light.' Close with a quiet, contemplative thought on how Allah’s Presence and Wisdom are uniquely manifesting in their specific situation right now.

Constraint: Do not reproduce the reflection text itself—only reference its themes. The intro should flow into the reflection and the conclusion should flow out of it, as one integrated reading experience. Only return the JSON.`,
    instructions: spiritualGuideSystemPrompt,
    schema: spiritualGuideResponseSchema,
    schemaName: 'spiritual_guide_wrapper',
  } as const;

  try {
    return await structuredOpenAICaller<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 900,
      },
      {
        debugLogger,
      },
    );
  } catch (error) {
    if (!looksLikeTruncatedJsonError(error)) {
      throw error;
    }

    warnLogger.warn('[spiritual-guide] retrying after likely truncated JSON', {
      detectedLanguageCode,
      message: error instanceof Error ? error.message : String(error),
    });

    return structuredOpenAICaller<SpiritualGuideResponse>(
      {
        ...requestParams,
        maxOutputTokens: 1400,
      },
      {
        debugLogger,
      },
    );
  }
}

export async function generateChatTitle(
  {
    detectedLanguageCode,
    eventContent,
    userFeeling,
  }: {
    detectedLanguageCode: string;
    eventContent: string;
    userFeeling: string;
  },
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  const response = await structuredOpenAICaller<ChatTitleResponse>(
    {
      inputText: `Output language: ${detectedLanguageCode}

Event/Content: ${eventContent}

User Feeling: ${userFeeling}`,
      instructions: chatTitleSystemPrompt,
      maxOutputTokens: 40,
      schema: chatTitleResponseSchema,
      schemaName: 'chat_title',
    },
    {
      debugLogger,
    },
  );

  return response.title.trim() || FALLBACK_CHAT_TITLE;
}
