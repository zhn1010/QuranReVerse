'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getSidebarBookmarksServerSnapshot,
  getSidebarBookmarksSnapshot,
  prefetchSidebarBookmarks,
  revalidateSidebarBookmarks,
  resetSidebarBookmarks,
  subscribeSidebarBookmarks,
} from '@/lib/sidebar-bookmarks-store';

export function SidebarBookmarksPanel({ isAuthenticated }: { isAuthenticated: boolean }) {
  const state = useSyncExternalStore(
    subscribeSidebarBookmarks,
    getSidebarBookmarksSnapshot,
    getSidebarBookmarksServerSnapshot,
  );
  const [deletingBookmarkId, setDeletingBookmarkId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDeleteBookmark(bookmark: (typeof state.bookmarks)[number]) {
    if (deletingBookmarkId) {
      return;
    }

    setDeleteError(null);
    setDeletingBookmarkId(bookmark.bookmarkId);

    try {
      const response = await fetch('/api/qf/bookmark', {
        body: JSON.stringify({
          ayahNo: bookmark.ayahNo,
          surahNo: bookmark.surahNo,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not remove this bookmark.');
      }

      await revalidateSidebarBookmarks();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not remove this bookmark.');
    } finally {
      setDeletingBookmarkId(null);
    }
  }

  return (
    <div className="space-y-3">
      {deleteError ? (
        <p className="rounded-2xl border border-[rgba(140,32,32,0.18)] bg-[rgba(140,32,32,0.05)] px-3 py-2 text-xs text-[rgb(110,28,28)]">
          {deleteError}
        </p>
      ) : null}
      {state.bookmarks.map((bookmark) => (
        <div
          className="rounded-[1.25rem] border border-[rgba(63,63,70,0.08)] bg-white/68 px-4 py-3 transition hover:bg-white/92"
          key={bookmark.bookmarkId}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-(--ink-strong)">{bookmark.surahName}</p>
              <p className="mt-1 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-(--ink-soft)">
                {bookmark.verseKey}
              </p>
            </div>
            <div className="flex items-start gap-2">
              {bookmark.surahArabicName ? (
                <p className="shrink-0 text-right text-sm leading-6 text-(--ink-soft)" dir="rtl">
                  {bookmark.surahArabicName}
                </p>
              ) : null}
              <button
                aria-label={`Delete bookmark ${bookmark.verseKey}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-[rgba(140,32,32,0.1)] hover:text-[rgb(140,32,32)] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={Boolean(deletingBookmarkId)}
                onClick={() => void handleDeleteBookmark(bookmark)}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M8 10v8" />
                  <path d="M12 10v8" />
                  <path d="M16 10v8" />
                  <path d="M6 6l1 14h10l1-14" />
                </svg>
              </button>
            </div>
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
            <a
              className="text-(--ink-soft) transition hover:text-(--ink-strong)"
              href={`https://quran.com/${bookmark.verseKey}`}
              rel="noreferrer"
              target="_blank"
            >
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
