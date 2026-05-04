'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  getSidebarBookmarksServerSnapshot,
  getSidebarBookmarksSnapshot,
  prefetchSidebarBookmarks,
  resetSidebarBookmarks,
  subscribeSidebarBookmarks,
} from '@/lib/sidebar-bookmarks-store';

export function SidebarBookmarksPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const state = useSyncExternalStore(
    subscribeSidebarBookmarks,
    getSidebarBookmarksSnapshot,
    getSidebarBookmarksServerSnapshot,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      resetSidebarBookmarks();
      return;
    }

    void prefetchSidebarBookmarks();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-(--line) bg-white/55 px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-strong)">Bookmarks</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-soft)">
          Connect your Quran Foundation account to load bookmarked ayahs from your Sakinah.now
          collection.
        </p>
      </div>
    );
  }

  if (state.isLoading && !state.hasFetched) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            className="rounded-[1.75rem] border border-[rgba(63,63,70,0.08)] bg-white/60 px-4 py-4"
            key={index}
          >
            <div className="shimmer-bar h-3 w-24 rounded-full" />
            <div className="mt-4 shimmer-bar h-10 w-full rounded-2xl" />
            <div className="mt-3 shimmer-bar h-3 w-[88%] rounded-full" />
            <div className="mt-2 shimmer-bar h-3 w-[72%] rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="rounded-[1.75rem] border border-[rgba(140,32,32,0.18)] bg-[rgba(140,32,32,0.05)] px-4 py-5">
        <p className="text-sm font-semibold text-[rgb(110,28,28)]">Could not load bookmarks</p>
        <p className="mt-2 text-sm leading-6 text-[rgb(110,28,28)]">{state.error}</p>
      </div>
    );
  }

  if (state.bookmarks.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-(--line) bg-white/55 px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-strong)">Bookmarks</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-soft)">
          No ayahs have been saved in your {state.collectionName} collection yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.bookmarks.map((bookmark) => (
        <a
          className="block rounded-[1.25rem] border border-[rgba(63,63,70,0.08)] bg-white/68 px-4 py-3 transition hover:bg-white/92"
          href={`https://quran.com/${bookmark.verseKey}`}
          key={bookmark.bookmarkId}
          rel="noreferrer"
          target="_blank"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-(--ink-strong)">{bookmark.surahName}</p>
              <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-(--ink-soft)">
                {bookmark.verseKey}
              </p>
            </div>
            {bookmark.surahArabicName ? (
              <p className="shrink-0 text-right text-sm leading-6 text-(--ink-soft)" dir="rtl">
                {bookmark.surahArabicName}
              </p>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-right text-base leading-8 text-(--ink-strong)" dir="rtl">
            {bookmark.arabicText || `${bookmark.surahNo}:${bookmark.ayahNo}`}
          </p>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-(--ink-soft)">
              {new Date(bookmark.createdAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
            </p>
            <span className="text-(--ink-soft)" aria-hidden="true">
              ↗
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
