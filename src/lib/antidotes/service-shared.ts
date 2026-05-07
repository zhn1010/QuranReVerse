import { callStructuredOpenAI } from '@/lib/openai-client';
import { getRelatedReflectionsForAyah } from '@/lib/quran-reflect';

export type AntidoteDebugLogger = (message: string, details: Record<string, unknown>) => void;

export type StructuredOpenAICaller = typeof callStructuredOpenAI;

export type RelatedReflectionsFetcher = typeof getRelatedReflectionsForAyah;

export type WarnLogger = Pick<Console, 'warn'>;

export type OpenAIServiceDeps = {
  debugLogger?: AntidoteDebugLogger;
  structuredOpenAICaller?: StructuredOpenAICaller;
  warnLogger?: WarnLogger;
};

export type ReflectionServiceDeps = {
  relatedReflectionsFetcher?: RelatedReflectionsFetcher;
  warnLogger?: WarnLogger;
};

export const FALLBACK_CHAT_TITLE = 'Reflection';

export function noopDebugLogger() {
  // no-op
}

export function isLlmDebugEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.LLM_DEBUG === 'true';
}

export function createLlmDebugLogger({
  env = process.env,
  logger = console,
}: {
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'log'>;
} = {}): AntidoteDebugLogger {
  return (message, details) => {
    if (!isLlmDebugEnabled(env)) {
      return;
    }

    logger.log('[llm-debug]', message, details);
  };
}

export function looksLikeTruncatedJsonError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('Unterminated string in JSON') ||
    message.includes('Unexpected end of JSON input')
  );
}
