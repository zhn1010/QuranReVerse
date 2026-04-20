'use client';

import Image from 'next/image';

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

  return (
    <div className="inline-flex items-center gap-4 rounded-full border border-[rgba(82,82,91,0.14)] bg-white/80 px-4 py-2">
      <div className="relative h-9 w-9 overflow-hidden rounded-full">
        <Image
          alt="Sakinah.now logo"
          className="gentle-rotate object-contain p-1.5"
          fill
          sizes="36px"
          src="/LogoSakinah.now.png"
        />
      </div>
      <p className="shimmer-text-soft text-sm font-medium">
        {displayIndex + 1}/{total} {currentStep.label}
      </p>
    </div>
  );
}
