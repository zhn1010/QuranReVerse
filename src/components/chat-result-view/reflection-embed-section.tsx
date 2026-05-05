'use client';

import type { MouseEvent } from 'react';
import { QuranEmbedBookmarkAction } from '@/components/reflection/quran-embed-bookmark-action';
import { QuranEmbedCard } from '@/components/reflection/quran-embed-card';
import type { AyahReference } from '@/lib/ayah';
import type { QfSessionSummary } from '@/lib/qf-user';

type BookmarkState = {
  savedKeys: Record<string, boolean>;
  savingKey: string | null;
};

type SelectedEmbed = {
  label: string;
  reference: AyahReference;
};

export function ReflectionEmbedSection({
  auth,
  bookmarkState,
  handleBookmarkToggle,
  handleConnectClick,
  loginHref,
  selectedEmbeds,
  translationId,
}: {
  auth: QfSessionSummary;
  bookmarkState: BookmarkState;
  handleBookmarkToggle: (surahNo: number, ayahNo: string, label: string) => void;
  handleConnectClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  loginHref: string;
  selectedEmbeds: SelectedEmbed[];
  translationId: number;
}) {
  if (selectedEmbeds.length === 0) {
    return null;
  }

  const renderCard = (embed: SelectedEmbed) => (
    <QuranEmbedCard
      ayahNo={embed.label.split(':')[1] ?? ''}
      containerClassName="rounded-xl border border-(--border-subtle) bg-white"
      frameClassName="rounded-xl bg-white"
      key={embed.label}
      label={embed.label}
      overlayAction={
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-17.5 items-center justify-end pr-38">
          <QuranEmbedBookmarkAction
            ayahNo={embed.label.split(':')[1] ?? ''}
            href={loginHref}
            isAuthenticated={auth.isAuthenticated}
            isSaved={Boolean(bookmarkState.savedKeys[embed.label])}
            isSaving={bookmarkState.savingKey === embed.label}
            onConnectClick={handleConnectClick}
            onToggle={(surahNo, ayahNo) => handleBookmarkToggle(surahNo, ayahNo, embed.label)}
            surahNo={embed.reference.chapterId}
          />
        </div>
      }
      overlayClassName="pointer-events-none absolute inset-x-0 top-0 z-10"
      surahNo={embed.reference.chapterId}
      translationId={translationId}
    />
  );

  if (selectedEmbeds.length > 1) {
    return (
      <details className="rounded-xl border border-(--border-subtle) bg-(--surface-card-soft) p-3 text-sm text-(--ink-soft)">
        <summary className="cursor-pointer font-medium text-(--ink-strong)">
          Show referenced ayahs ({selectedEmbeds.length})
        </summary>
        <div className="mt-3 space-y-4">{selectedEmbeds.map((embed) => renderCard(embed))}</div>
      </details>
    );
  }

  return (
    <QuranEmbedCard
      ayahNo={selectedEmbeds[0].label.split(':')[1] ?? ''}
      containerClassName="rounded-xl border border-(--border-subtle) bg-white shadow-(--shadow-card-sm)"
      frameClassName="rounded-xl bg-white"
      label={selectedEmbeds[0].label}
      overlayAction={
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-17.5 items-center justify-end pr-38">
          <QuranEmbedBookmarkAction
            ayahNo={selectedEmbeds[0].label.split(':')[1] ?? ''}
            href={loginHref}
            isAuthenticated={auth.isAuthenticated}
            isSaved={Boolean(bookmarkState.savedKeys[selectedEmbeds[0].label])}
            isSaving={bookmarkState.savingKey === selectedEmbeds[0].label}
            onConnectClick={handleConnectClick}
            onToggle={(surahNo, ayahNo) =>
              handleBookmarkToggle(surahNo, ayahNo, selectedEmbeds[0].label)
            }
            surahNo={selectedEmbeds[0].reference.chapterId}
          />
        </div>
      }
      overlayClassName="pointer-events-none absolute inset-x-0 top-0 z-10"
      surahNo={selectedEmbeds[0].reference.chapterId}
      translationId={translationId}
    />
  );
}
