import { callStructuredOpenAI } from '@/lib/server/openai/client';
import { curatorSystemPrompt } from '@/lib/server/antidotes/prompts';
import { createSelectedReflection, serializeReflectionCandidates } from '@/lib/server/antidotes/reflections';
import { curatorResponseSchema } from '@/lib/server/antidotes/schemas';
import type {
  CuratedReflectionCandidate,
  CuratedReflectionResponse,
  Diagnosis,
  SelectedReflection,
} from '@/lib/shared/antidotes/types';
import { noopDebugLogger, type OpenAIServiceDeps } from '@/lib/server/antidotes/service-shared';

export async function curateReflection(
  diagnosis: Diagnosis,
  candidates: CuratedReflectionCandidate[],
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
): Promise<SelectedReflection | null> {
  if (candidates.length === 0) {
    return null;
  }

  const serializedCandidates = serializeReflectionCandidates(candidates);
  const selection = await structuredOpenAICaller<CuratedReflectionResponse>(
    {
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
    },
    {
      debugLogger,
    },
  );

  return createSelectedReflection(selection, candidates);
}
