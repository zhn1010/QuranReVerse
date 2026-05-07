import { callStructuredOpenAI } from '@/lib/server/openai/client';
import { getRelatedReflectionsForAyah } from '@/lib/server/quran/reflect';

export type AntidoteDebugLogger = (message: string, details: Record<string, unknown>) => void;

export type StructuredOpenAICaller = typeof callStructuredOpenAI;
export type StructuredOpenAIRequestParams = Parameters<StructuredOpenAICaller>[0];

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

export async function callStructuredOpenAIWithRetry<T>(
  {
    debugLogger = noopDebugLogger,
    initialMaxOutputTokens,
    requestParams,
    retryMaxOutputTokens,
    structuredOpenAICaller = callStructuredOpenAI,
    warnContext = {},
    warnLabel,
    warnLogger = console,
  }: {
    debugLogger?: AntidoteDebugLogger;
    initialMaxOutputTokens: number;
    requestParams: Omit<StructuredOpenAIRequestParams, 'maxOutputTokens'>;
    retryMaxOutputTokens: number;
    structuredOpenAICaller?: StructuredOpenAICaller;
    warnContext?: Record<string, unknown>;
    warnLabel: string;
    warnLogger?: WarnLogger;
  },
) {
  try {
    return await structuredOpenAICaller<T>(
      {
        ...requestParams,
        maxOutputTokens: initialMaxOutputTokens,
      },
      {
        debugLogger,
      },
    );
  } catch (error) {
    if (!looksLikeTruncatedJsonError(error)) {
      throw error;
    }

    warnLogger.warn(`[${warnLabel}] retrying after likely truncated JSON`, {
      ...warnContext,
      message: error instanceof Error ? error.message : String(error),
    });

    return structuredOpenAICaller<T>(
      {
        ...requestParams,
        maxOutputTokens: retryMaxOutputTokens,
      },
      {
        debugLogger,
      },
    );
  }
}
