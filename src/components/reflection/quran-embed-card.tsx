'use client';

import type { ReactNode } from 'react';
import { buildQuranEmbedUrl } from '@/lib/shared/reflection/ui';

export function QuranEmbedCard({
  ayahNo,
  containerClassName,
  frameClassName = 'bg-white',
  header,
  label,
  overlayAction,
  overlayClassName,
  surahNo,
  translationId,
}: {
  ayahNo: string;
  containerClassName: string;
  frameClassName?: string;
  header?: ReactNode;
  label: string;
  overlayAction?: ReactNode;
  overlayClassName?: string;
  surahNo: number;
  translationId: number;
}) {
  return (
    <div className={containerClassName}>
      {header}
      <div className={`relative overflow-hidden ${frameClassName}`}>
        {overlayAction ? (
          <div className={overlayClassName ?? 'pointer-events-none absolute inset-x-0 top-0 z-10'}>
            {overlayAction}
          </div>
        ) : null}
        <iframe
          allow="clipboard-write"
          className="block w-full bg-white"
          data-quran-embed="true"
          frameBorder="0"
          loading="lazy"
          src={buildQuranEmbedUrl(surahNo, ayahNo, translationId)}
          title={`Quran passage ${label}`}
          width="100%"
        />
      </div>
    </div>
  );
}
