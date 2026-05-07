import type { PipelineEvent, PipelineStepEvent, PipelineStepKey } from '@/lib/shared/antidotes/types';

export const PIPELINE_STEP_LABELS: Record<PipelineStepKey, string> = {
  ayah_selection: 'Selecting grounding ayahs',
  guide_generation: 'Preparing your guided reading',
  language_detection: 'Detecting your input language',
  reflection_curation: 'Curating the strongest match',
  reflection_fetch: 'Collecting relevant reflections',
  reflection_translation: 'Aligning reflection language with your input',
};

export function createPipelineStep(
  step: PipelineStepKey,
  status: PipelineStepEvent['status'],
): PipelineStepEvent {
  return {
    label: PIPELINE_STEP_LABELS[step],
    status,
    step,
    type: 'step',
  };
}

export function toJsonLine(event: PipelineEvent) {
  return `${JSON.stringify(event)}\n`;
}
