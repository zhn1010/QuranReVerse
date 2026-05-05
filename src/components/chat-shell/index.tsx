'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { ChatShellHeader } from './chat-shell-header';
import { ChatShellSidebar, type SidebarTabId } from './chat-shell-sidebar';
import type { QfSessionSummary } from '@/lib/qf-user';
import { prefetchSidebarNotes, resetSidebarNotes } from '@/lib/sidebar-notes-store';
import { prefetchSidebarBookmarks, resetSidebarBookmarks } from '@/lib/sidebar-bookmarks-store';
import { getServerSnapshot, listChatThreads, subscribeToChatHistory } from '@/lib/chat-store';

const DESKTOP_SIDEBAR_EXPANDED_KEY = 'sakinah:desktop-sidebar-expanded';

export function ChatShell({
  activeChatId,
  auth,
  children,
}: {
  activeChatId?: string;
  auth: QfSessionSummary;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const history = useSyncExternalStore(subscribeToChatHistory, listChatThreads, getServerSnapshot);
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false);
  const [hasLoadedDesktopSidebarPreference, setHasLoadedDesktopSidebarPreference] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTabId>('chats');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  const avatarLabel = useMemo(() => {
    if (auth.displayName?.trim()) {
      return auth.displayName
        .trim()
        .split(/\s+/u)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
    }

    return 'S';
  }, [auth.displayName]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuContainerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !menuContainerRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    try {
      setIsDesktopSidebarExpanded(
        window.localStorage.getItem(DESKTOP_SIDEBAR_EXPANDED_KEY) === 'true',
      );
    } catch {
      // Ignore storage failures so sidebar state still works in memory.
    } finally {
      setHasLoadedDesktopSidebarPreference(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedDesktopSidebarPreference) {
      return;
    }

    try {
      window.localStorage.setItem(
        DESKTOP_SIDEBAR_EXPANDED_KEY,
        isDesktopSidebarExpanded ? 'true' : 'false',
      );
    } catch {
      // Ignore storage failures so sidebar state still works in memory.
    }
  }, [hasLoadedDesktopSidebarPreference, isDesktopSidebarExpanded]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      resetSidebarBookmarks();
      resetSidebarNotes();
      return;
    }

    void prefetchSidebarBookmarks();
    void prefetchSidebarNotes();
  }, [auth.isAuthenticated]);

  const handleSidebarToggle = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setIsDesktopSidebarExpanded((current) => !current);
      setIsMobileSidebarOpen(false);
      return;
    }

    setIsMobileSidebarOpen((current) => !current);
  };
  const handleSidebarCollapse = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setIsDesktopSidebarExpanded(false);
      return;
    }

    setIsMobileSidebarOpen(false);
  };
  const handleSidebarNavigation = () => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      return;
    }

    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="app-shell-gradient min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-400">
        <ChatShellSidebar
          activeChatId={activeChatId}
          activeSidebarTab={activeSidebarTab}
          authIsAuthenticated={auth.isAuthenticated}
          history={history}
          isDesktopSidebarExpanded={isDesktopSidebarExpanded}
          isMobileSidebarOpen={isMobileSidebarOpen}
          onSidebarCollapse={handleSidebarCollapse}
          onSidebarNavigation={handleSidebarNavigation}
          onSidebarToggle={handleSidebarToggle}
          setActiveSidebarTab={setActiveSidebarTab}
        />

        {isMobileSidebarOpen ? (
          <button
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-(--surface-scrim-sidebar) md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <div ref={menuContainerRef}>
            <ChatShellHeader
              auth={auth}
              avatarLabel={avatarLabel}
              isMenuOpen={isMenuOpen}
              pathname={pathname || '/'}
              setIsMenuOpen={setIsMenuOpen}
              setIsMobileSidebarOpen={setIsMobileSidebarOpen}
            />
          </div>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
