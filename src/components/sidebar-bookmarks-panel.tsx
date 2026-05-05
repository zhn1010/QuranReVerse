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
  const [confirmingBookmarkId, setConfirmingBookmarkId] = useState<string | null>(null);
  const [optimisticallyRemovedBookmarkIds, setOptimisticallyRemovedBookmarkIds] = useState<
    Record<string, true>
  >({});
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const visibleBookmarks = state.bookmarks.filter(
    (bookmark) => !optimisticallyRemovedBookmarkIds[bookmark.bookmarkId],
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
      <div className="rounded-7 border border-dashed border-(--line) bg-white/55 px-4 py-5">
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
            className="rounded-7 border border-(--border-subtle) bg-(--surface-card-muted) px-4 py-4"
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
      <div className="rounded-7 border border-(--border-danger) bg-(--surface-danger-soft) px-4 py-5">
        <p className="text-sm font-semibold text-(--ink-danger)">Could not load bookmarks</p>
        <p className="mt-2 text-sm leading-6 text-(--ink-danger)">{state.error}</p>
      </div>
    );
  }

  if (visibleBookmarks.length === 0) {
    return (
      <div className="rounded-7 border border-dashed border-(--line) bg-white/55 px-4 py-5">
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

    const bookmarkId = bookmark.bookmarkId;
    setDeleteError(null);
    setConfirmingBookmarkId(null);
    setDeletingBookmarkId(bookmarkId);
    setOptimisticallyRemovedBookmarkIds((prev) => ({
      ...prev,
      [bookmarkId]: true,
    }));

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
      setOptimisticallyRemovedBookmarkIds((prev) => {
        const next = { ...prev };
        delete next[bookmarkId];
        return next;
      });
      setDeleteError(error instanceof Error ? error.message : 'Could not remove this bookmark.');
    } finally {
      setDeletingBookmarkId(null);
    }
  }

  return (
    <div className="space-y-3">
      {deleteError ? (
        <p className="rounded-2xl border border-(--border-danger) bg-(--surface-danger-soft) px-3 py-2 text-xs text-(--ink-danger)">
          {deleteError}
        </p>
      ) : null}
      {visibleBookmarks.map((bookmark) => (
        <div
          className="rounded-5 border border-(--border-subtle) bg-(--surface-card-tint) px-4 py-3 transition hover:bg-(--surface-card-hover)"
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-(--surface-danger-strong) hover:text-(--ink-danger) disabled:cursor-not-allowed disabled:opacity-55"
                disabled={Boolean(deletingBookmarkId)}
                onClick={() =>
                  setConfirmingBookmarkId((current) =>
                    current === bookmark.bookmarkId ? null : bookmark.bookmarkId,
                  )
                }
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
          {confirmingBookmarkId === bookmark.bookmarkId ? (
            <div className="mt-2 flex items-center justify-between rounded-xl border border-(--border-danger) bg-(--surface-danger-soft) px-3 py-2">
              <p className="text-xs text-(--ink-danger)">Confirm?</p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-(--border-danger-strong) px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-(--ink-danger) transition hover:bg-(--surface-danger-strong) disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={Boolean(deletingBookmarkId)}
                  onClick={() => void handleDeleteBookmark(bookmark)}
                  type="button"
                >
                  Yes
                </button>
                <button
                  className="rounded-full border border-(--border-strong) px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-(--ink-soft) transition hover:bg-white"
                  onClick={() => setConfirmingBookmarkId(null)}
                  type="button"
                >
                  No
                </button>
              </div>
            </div>
          ) : null}

          <p
            className="mt-2 line-clamp-2 text-right text-base leading-8 text-(--ink-strong)"
            dir="rtl"
          >
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
