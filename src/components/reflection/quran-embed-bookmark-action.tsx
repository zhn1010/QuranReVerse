'use client';

import type { MouseEvent } from 'react';

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
          <svg
            className="h-4 w-4"
            fill={isSaved ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
          </svg>
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
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75v14.19a.5.5 0 0 1-.79.407L12 15.5l-5.21 3.847A.5.5 0 0 1 6 18.94V4.75Z" />
      </svg>
    </a>
  );
}
