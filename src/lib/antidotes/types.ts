import type { ApiResponse, Diagnosis, ReflectionGuide, SelectedReflection } from '@/lib/antidote-types';
import type { RelatedReflection } from '@/lib/quran-reflect';

export type OpenAIAntidote = {
  ayah_no: string;
  reasoning: string;
  surah_name: string;
  surah_no: number;
};

export type AntidoteResponse = {
  antidotes: OpenAIAntidote[];
  diagnosis: Diagnosis;
};

export type CuratedReflectionResponse = {
  selected_reflection_id: number;
  selection_reason: string;
};

export type SpiritualGuideResponse = ReflectionGuide;

export type LanguageDetectionResponse = {
  language_code: string;
};

export type ReflectionTranslationResponse = {
  translated_text: string;
};

export type ChatTitleResponse = {
  title: string;
};

export type EnrichedAntidote = OpenAIAntidote & {
  related_reflections: RelatedReflection[];
};

export type CuratedReflectionCandidate = RelatedReflection & {
  ayah_no: string;
  surah_name: string;
  surah_no: number;
};

export type PipelineStepKey =
  | 'language_detection'
  | 'ayah_selection'
  | 'reflection_fetch'
  | 'reflection_curation'
  | 'reflection_translation'
  | 'guide_generation';

export type PipelineStepEvent = {
  label: string;
  status: 'completed' | 'in_progress';
  step: PipelineStepKey;
  type: 'step';
};

export type PipelineResultEvent = {
  data: ApiResponse;
  type: 'result';
};

export type PipelineErrorEvent = {
  error: string;
  type: 'error';
};

export type PipelineEvent = PipelineStepEvent | PipelineResultEvent | PipelineErrorEvent;

export type {
  ApiResponse,
  Diagnosis,
  ReflectionGuide,
  SelectedReflection,
};
