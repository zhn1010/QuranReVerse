'use client';

import { detectTextDirection, getDirectionStyles } from '@/lib/reflection-ui';

export function PromptSummaryCard({
  eventContent,
  userFeeling,
}: {
  eventContent: string;
  userFeeling: string;
}) {
  const eventDirection = detectTextDirection(eventContent);
  const feelingDirection = detectTextDirection(userFeeling);

  return (
    <section className="overflow-hidden rounded-[2rem] border border-(--line) bg-white shadow-[0_16px_44px_rgba(24,24,27,0.06)]">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-(--line) px-5 py-5 md:border-b-0 md:border-r md:px-6">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
            Event or content
          </p>
          <p
            className={`mt-3 line-clamp-6 text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
              eventDirection,
            )}`}
            dir={eventDirection}
          >
            {eventContent}
          </p>
        </div>
        <div className="px-5 py-5 md:px-6">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
            Feeling after that
          </p>
          <p
            className={`mt-3 line-clamp-6 text-sm leading-7 text-(--ink-strong) ${getDirectionStyles(
              feelingDirection,
            )}`}
            dir={feelingDirection}
          >
            {userFeeling}
          </p>
        </div>
      </div>
    </section>
  );
}
