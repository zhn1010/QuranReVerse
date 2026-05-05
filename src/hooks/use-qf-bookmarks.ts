'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import type { ToastContextValue } from '@/components/toast-public';
import { buildQfLoginHref, fetchQfBookmarkStates, toggleQfBookmark } from '@/lib/qf-browser';
import { revalidateSidebarBookmarks } from '@/lib/sidebar-bookmarks-store';

type BookmarkState = {
  savedKeys: Record<string, boolean>;
  savingAction: 'add' | 'remove' | null;
  savingKey: string | null;
};

type Embed = {
  label: string;
  reference: {
    chapterId: number;
  };
};

export function useQfBookmarks({
  auth,
  chatPath,
  selectedEmbeds,
  toast,
}: {
  auth: {
    collectionName: string;
    isAuthenticated: boolean;
  };
  chatPath: string;
  selectedEmbeds: Embed[];
  toast: Pick<ToastContextValue, 'error' | 'success'>;
}) {
  const [bookmarkState, setBookmarkState] = useState<BookmarkState>({
    savedKeys: {},
    savingAction: null,
    savingKey: null,
  });
  const loginHref = buildQfLoginHref(chatPath);

  useEffect(() => {
    if (!auth.isAuthenticated || selectedEmbeds.length === 0) {
      return;
    }

    let isCancelled = false;

    async function hydrateBookmarks() {
      try {
        const updates = await fetchQfBookmarkStates(selectedEmbeds);

        if (!isCancelled) {
          setBookmarkState((prev) => ({
            ...prev,
            savedKeys: {
              ...prev.savedKeys,
              ...updates,
            },
          }));
        }
      } catch {
        // Ignore bookmark hydration failures in the UI shell.
      }
    }

    hydrateBookmarks();

    return () => {
      isCancelled = true;
    };
  }, [auth.isAuthenticated, selectedEmbeds]);

  function handleConnectClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const nextUrl = new URL(chatPath, window.location.origin);
    nextUrl.searchParams.set('scrollTo', String(Math.round(window.scrollY)));

    const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    window.location.assign(buildQfLoginHref(next));
  }

  async function handleBookmarkToggle(surahNo: number, ayahNo: string, key: string) {
    const isBookmarked = Boolean(bookmarkState.savedKeys[key]);
    setBookmarkState((prev) => ({
      ...prev,
      savingAction: isBookmarked ? 'remove' : 'add',
      savingKey: key,
    }));

    try {
      const payload = await toggleQfBookmark({
        ayahNo,
        isBookmarked,
        surahNo,
      });

      setBookmarkState((prev) => ({
        ...prev,
        savedKeys: {
          ...prev.savedKeys,
          [key]: !isBookmarked,
        },
        savingAction: null,
        savingKey: null,
      }));
      void revalidateSidebarBookmarks();

      if (isBookmarked) {
        toast.success(
          `${payload.removedCount ?? 1} ayah removed from ${payload.collectionName ?? auth.collectionName}.`,
        );
      } else {
        toast.success(
          `${payload.savedCount ?? 1} ayah saved to ${payload.collectionName ?? auth.collectionName}.`,
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the ayah.');
      setBookmarkState((prev) => ({
        ...prev,
        savingAction: null,
        savingKey: null,
      }));
    }
  }

  return {
    bookmarkState,
    handleBookmarkToggle,
    handleConnectClick,
    loginHref,
  };
}
