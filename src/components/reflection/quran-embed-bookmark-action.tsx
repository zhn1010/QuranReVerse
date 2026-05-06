'use client';

import type { MouseEvent } from 'react';
import { BookmarkIcon } from '@/components/icons';

export function QuranEmbedBookmarkAction({
  ayahNo,
  href,
  isAuthenticated,
  isSaved,
  isSaving,
  onConnectClick,
  onToggle,
  surahNo,
}: {
  ayahNo: string;
  href: string;
  isAuthenticated: boolean;
  isSaved: boolean;
  isSaving: boolean;
  onConnectClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  onToggle: (surahNo: number, ayahNo: string) => void;
  surahNo: number;
}) {
  if (isAuthenticated) {
    return (
      <button
        aria-label={isSaved ? 'Remove bookmark' : 'Bookmark ayah'}
        className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] cursor-pointer items-center justify-center rounded-xl border border-(--border-soft) bg-(--surface-card-strong) text-(--ink-soft) transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSaving}
        onClick={() => onToggle(surahNo, ayahNo)}
        type="button"
      >
        {isSaving ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-(--border-accent-strong) border-t-(--accent)" />
        ) : (
          <BookmarkIcon className="h-4 w-4" filled={isSaved} strokeWidth="1.8" />
        )}
      </button>
    );
  }

  return (
    <a
      aria-label="Connect to bookmark"
      className="pointer-events-auto inline-flex h-[2.115rem] w-[2.115rem] items-center justify-center rounded-xl border border-(--border-soft) bg-(--surface-card-strong) text-(--ink-soft) transition hover:bg-white"
      href={href}
      onClick={onConnectClick}
    >
      <BookmarkIcon className="h-4 w-4" strokeWidth="1.8" />
    </a>
  );
}
