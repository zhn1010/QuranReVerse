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
  const currentStep = LOADING_STEPS.find((step) => stepStatus[step.key] === 'in_progress');

  return (
    <section className="overflow-hidden rounded-[2rem] border border-(--line) bg-[rgba(255,255,255,0.94)] shadow-[0_20px_64px_rgba(24,24,27,0.08)]">
      <div className="border-b border-(--line) bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.9))] px-6 py-6 sm:px-8">
        <div className="inline-flex items-center gap-4 rounded-full border border-[rgba(82,82,91,0.14)] bg-white/80 px-4 py-2">
          <div className="relative h-9 w-9 overflow-hidden rounded-full">
            <Image
              alt="Sakinah.now logo"
              className="object-contain p-1.5"
              fill
              sizes="36px"
              src="/LogoSakinah.now.png"
            />
          </div>
          <p className="text-sm font-medium text-(--ink-soft)">
            {currentStep
              ? `Working on ${currentStep.label.toLowerCase()}`
              : 'Finalizing your reading'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8">
        <div className="rounded-3xl border border-(--line) bg-[rgba(250,250,250,0.8)] p-4">
          <div className="space-y-3">
            {LOADING_STEPS.map((step, index) => {
              const status = stepStatus[step.key];

              return (
                <div className="flex items-center gap-3" key={step.key}>
                  {status === 'completed' ? (
                    <div className="relative h-4 w-4 overflow-hidden rounded-full">
                      <Image
                        alt=""
                        aria-hidden
                        className="object-contain p-[2px]"
                        fill
                        sizes="16px"
                        src="/LogoSakinah.now.png"
                      />
                    </div>
                  ) : status === 'in_progress' ? (
                    <div className="relative h-4 w-4">
                      <span className="subtle-pulse absolute inset-0 rounded-full bg-[rgba(82,82,91,0.24)]" />
                      <div className="relative h-4 w-4 overflow-hidden rounded-full">
                        <Image
                          alt=""
                          aria-hidden
                          className="object-contain p-[2px]"
                          fill
                          sizes="16px"
                          src="/LogoSakinah.now.png"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-[rgba(161,161,170,0.45)]" />
                  )}
                  <p
                    className={`text-sm ${
                      status === 'completed' || status === 'in_progress'
                        ? 'text-(--ink-strong)'
                        : 'text-(--ink-soft)'
                    } ${status === 'in_progress' ? 'shimmer-text' : ''}`}
                  >
                    {index + 1}. {step.label}
                    {status === 'in_progress' ? '...' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="shimmer-bar h-5 w-4/5 rounded-full" />
          <div className="shimmer-bar h-4 w-full rounded-full" />
          <div className="shimmer-bar h-4 w-11/12 rounded-full" />
          <div className="shimmer-bar h-4 w-4/6 rounded-full" />
        </div>
      </div>
    </section>
  );
}
