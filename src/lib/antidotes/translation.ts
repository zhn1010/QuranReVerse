import { callStructuredOpenAI } from '@/lib/openai-client';
import { getLanguageCodeFromReflectionLanguageName } from '@/lib/antidotes/language';
import { reflectionTranslationSystemPrompt } from '@/lib/antidotes/prompts';
import { reflectionTranslationResponseSchema } from '@/lib/antidotes/schemas';
import type {
  ReflectionTranslationResponse,
  SelectedReflection,
} from '@/lib/antidotes/types';
import { noopDebugLogger, type OpenAIServiceDeps } from '@/lib/antidotes/service-shared';

export async function translateSelectedReflectionIfNeeded(
  selectedReflection: SelectedReflection | null,
  targetLanguageCode: string,
  {
    debugLogger = noopDebugLogger,
    structuredOpenAICaller = callStructuredOpenAI,
  }: OpenAIServiceDeps = {},
) {
  if (!selectedReflection?.reflection) {
    debugLogger('reflection translation skipped: no selected reflection body', {
      hasSelectedReflection: Boolean(selectedReflection),
      targetLanguageCode,
    });
    return selectedReflection;
  }

  const sourceLanguageCode =
    selectedReflection.reflection_source_language_code ??
    getLanguageCodeFromReflectionLanguageName(selectedReflection.reflection.languageName);

  if (!sourceLanguageCode) {
    debugLogger('reflection translation skipped: unknown source language', {
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
    debugLogger('reflection translation skipped: source equals target', {
      reflectionId: selectedReflection.reflection.id,
      sourceLanguageCode,
      targetLanguageCode,
    });

    return {
      ...selectedReflection,
      reflection_source_language_code: sourceLanguageCode,
    };
  }

  debugLogger('reflection translation started', {
    reflectionBodyLength: selectedReflection.reflection.body.length,
    reflectionId: selectedReflection.reflection.id,
    sourceLanguageCode,
    targetLanguageCode,
  });

  const translation = await structuredOpenAICaller<ReflectionTranslationResponse>(
    {
      inputText: `Target language code: ${targetLanguageCode}

Source language code: ${sourceLanguageCode}

Reflection text:
${selectedReflection.reflection.body}`,
      instructions: reflectionTranslationSystemPrompt,
      maxOutputTokens: 1200,
      schema: reflectionTranslationResponseSchema,
      schemaName: 'selected_reflection_translation',
    },
    {
      debugLogger,
    },
  );

  const translatedText = translation.translated_text.trim();
  const usedOriginalFallback = translatedText.length === 0;

  debugLogger('reflection translation completed', {
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
