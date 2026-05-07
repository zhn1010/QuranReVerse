'use client';

import { ChatLoadingPattern } from './chat-loading-pattern';

export const LOADING_STEPS = [
  { key: 'language_detection', label: 'Detecting your input language' },
  { key: 'ayah_selection', label: 'Selecting grounding ayahs' },
  { key: 'reflection_fetch', label: 'Collecting relevant reflections' },
  { key: 'reflection_curation', label: 'Curating the strongest match' },
  { key: 'reflection_translation', label: 'Aligning reflection language' },
  { key: 'guide_generation', label: 'Preparing your guided reading' },
] as const;

export type PipelineStepKey = (typeof LOADING_STEPS)[number]['key'];
export type PipelineStepStatus = 'completed' | 'in_progress' | 'pending';

const STEP_VISUAL_COPY: Record<PipelineStepKey, string> = {
  language_detection: 'Guide circles and quiet axes are drawn to establish the measure.',
  ayah_selection: 'The outer gold boundary is traced as a measured contour beneath the construction lines.',
  reflection_fetch: 'The eight outer petals are sketched clockwise, widening the form around the center.',
  reflection_curation: 'The inner hearts are drawn inward one by one to complete the hidden rhythm.',
  reflection_translation: 'All contours settle into a finished line drawing before any color is introduced.',
  guide_generation: 'The completed mark receives its full color and turns softly while your guided reading is prepared.',
};

export function createInitialLoadingStepStatus(): Record<PipelineStepKey, PipelineStepStatus> {
  return {
    ayah_selection: 'pending',
    guide_generation: 'pending',
    language_detection: 'pending',
    reflection_curation: 'pending',
    reflection_fetch: 'pending',
    reflection_translation: 'pending',
  };
}

export function ChatLoadingState({
  stepStatus,
}: {
  stepStatus: Record<PipelineStepKey, PipelineStepStatus>;
}) {
  const currentIndex = LOADING_STEPS.findIndex((step) => stepStatus[step.key] === 'in_progress');
  const activeIndex =
    currentIndex >= 0
      ? currentIndex
      : LOADING_STEPS.filter((step) => stepStatus[step.key] === 'completed').length - 1;
  const displayIndex = Math.max(0, Math.min(activeIndex, LOADING_STEPS.length - 1));
  const currentStep = LOADING_STEPS[displayIndex];
  const total = LOADING_STEPS.length;
  const loadingLabel = `${displayIndex + 1} of ${total}: ${currentStep.label}`;

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      aria-label={`Preparing your guided reading. ${loadingLabel}.`}
      className="pattern-loader-card max-w-136 rounded-4xl border border-(--border-accent-soft) bg-(--surface-card) p-5 sm:p-7"
      role="status"
    >
      <div className="relative z-10 flex flex-col items-center text-center">
        <ChatLoadingPattern phase={displayIndex + 1} />

        <p className="eyebrow mt-2 text-[0.68rem] tracking-[0.32em] text-(--ink-soft)">
          Mark In Formation
        </p>
        <p className="mt-3 max-w-md text-lg font-semibold text-(--ink-strong)">
          {currentStep.label}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-7 text-(--ink-soft)">
          {STEP_VISUAL_COPY[currentStep.key]}
        </p>

        <div className="mt-5 flex items-center gap-2">
          {LOADING_STEPS.map((step, index) => {
            const status = stepStatus[step.key];

            return (
              <span
                key={step.key}
                aria-hidden="true"
                className={`pattern-loader-step-dot ${status} ${index === displayIndex ? 'is-current' : ''}`}
              />
            );
          })}
        </div>

        <p className="mt-3 text-xs tracking-[0.18em] text-(--ink-soft) uppercase">
          Step {displayIndex + 1} of {total}
        </p>
      </div>
    </div>
  );
}
