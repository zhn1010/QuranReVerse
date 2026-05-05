'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SidebarBookmarksPanel } from '@/components/sidebar-bookmarks-panel';
import { SidebarNotesPanel } from '@/components/sidebar-notes-panel';
import { APP_CANONICAL_ORIGIN, APP_NAME } from '@/lib/app-constants';
import type { QfSessionSummary } from '@/lib/qf-user';
import { prefetchSidebarNotes, resetSidebarNotes } from '@/lib/sidebar-notes-store';
import { prefetchSidebarBookmarks, resetSidebarBookmarks } from '@/lib/sidebar-bookmarks-store';
import { getServerSnapshot, listChatThreads, subscribeToChatHistory } from '@/lib/chat-store';

const DESKTOP_SIDEBAR_EXPANDED_KEY = 'sakinah:desktop-sidebar-expanded';
const SIDEBAR_TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'notes', label: 'Notes' },
  { id: 'bookmarks', label: 'Bookmarks' },
] as const;

type SidebarTabId = (typeof SIDEBAR_TABS)[number]['id'];

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

  const isSidebarExpanded = isDesktopSidebarExpanded || isMobileSidebarOpen;
  const railButtonClass =
    'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--line) bg-white/80 text-(--ink-soft) transition hover:bg-white';
  const railSectionClass = 'px-4.5';
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
        <aside
          className={`fixed inset-y-0 left-0 z-40 h-screen w-72 -translate-x-full overflow-hidden border-r border-(--border-subtle) bg-(--surface-sidebar) backdrop-blur-xl transition-[width,transform] duration-300 ${
            isMobileSidebarOpen ? 'translate-x-0' : ''
          } ${
            isDesktopSidebarExpanded ? 'md:w-72' : 'md:w-18 md:px-0'
          } md:sticky md:top-0 md:translate-x-0`}
        >
          <div className="flex h-full min-h-0 flex-col pt-4">
            <div className={`${railSectionClass} flex items-center justify-between pt-2`}>
              <span className="sr-only">Conversations</span>
              <button
                aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                className={railButtonClass}
                onClick={handleSidebarToggle}
                type="button"
              >
                <svg
                  className="h-4.5 w-4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {isSidebarExpanded ? (
                <button
                  aria-label="Minimize sidebar"
                  className={railButtonClass}
                  onClick={handleSidebarCollapse}
                  type="button"
                >
                  <svg
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 6v12" />
                    <path d="M14 8l-4 4 4 4" />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className={`${railSectionClass} mt-6`}>
              <Link
                className={`inline-flex items-center overflow-hidden transition ${
                  isSidebarExpanded
                    ? 'w-full gap-4 rounded-full pr-4 hover:bg-white/70'
                    : 'h-9 w-9 justify-center'
                }`}
                href="/"
                onClick={handleSidebarNavigation}
              >
                <span className={railButtonClass}>
                  <svg
                    className="h-4.5 w-4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                {isSidebarExpanded ? (
                  <span className="shrink-0 whitespace-nowrap text-sm font-medium text-(--ink-strong)">
                    New chat
                  </span>
                ) : (
                  <span className="sr-only">New chat</span>
                )}
              </Link>
            </div>

            <div className="mt-6 min-h-0 flex-1">
              {isSidebarExpanded ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0 px-3">
                    <div className="grid grid-cols-3 gap-1 border-b border-(--border-subtle) pb-2">
                      {SIDEBAR_TABS.map((tab) => {
                        const isActive = activeSidebarTab === tab.id;

                        return (
                          <button
                            aria-pressed={isActive}
                            className={`cursor-pointer rounded-full px-2 py-1.5 text-xs font-medium transition ${
                              isActive
                                ? 'bg-white/90 text-(--ink-strong)'
                                : 'text-(--ink-soft) hover:text-(--ink-strong)'
                            }`}
                            key={tab.id}
                            onClick={() => setActiveSidebarTab(tab.id)}
                            type="button"
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                    {activeSidebarTab === 'chats' ? (
                      <>
                        <div className="mt-3 space-y-1">
                          {history.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-(--line) px-4 py-5 text-sm leading-7 text-(--ink-soft)">
                              Your reflection history will appear here.
                            </div>
                          ) : (
                            history.map((thread) => {
                              const isActive = thread.id === activeChatId;

                              return (
                                <Link
                                  className={`block rounded-2xl px-3 py-3 transition ${
                                    isActive
                                      ? 'bg-white text-(--ink-strong) shadow-(--shadow-pop)'
                                      : 'text-(--ink-soft) hover:bg-white/70 hover:text-(--ink-strong)'
                                  }`}
                                  href={`/chat/${thread.id}`}
                                  key={thread.id}
                                  onClick={handleSidebarNavigation}
                                >
                                  <p className="line-clamp-1 text-sm font-semibold">
                                    {thread.title || 'Reflection'}
                                  </p>
                                  <p className="mt-1 line-clamp-1 text-xs text-(--ink-soft)">
                                    {new Date(thread.updatedAt).toLocaleDateString(undefined, {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </p>
                                </Link>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : activeSidebarTab === 'notes' ? (
                      <SidebarNotesPanel isAuthenticated={auth.isAuthenticated} />
                    ) : (
                      <SidebarBookmarksPanel isAuthenticated={auth.isAuthenticated} />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {isMobileSidebarOpen ? (
          <button
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-(--surface-scrim-sidebar) md:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-(--line) bg-(--surface-card) backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-(--surface-subtle-strong) md:hidden"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  type="button"
                >
                  <span className="sr-only">Open sidebar</span>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <Link className="inline-flex items-center gap-3" href="/">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-(--shadow-logo)">
                    <Image
                      alt="Sakinah.now logo"
                      className="object-contain p-1.5"
                      fill
                      sizes="40px"
                      src="/LogoSakinah.now.png"
                    />
                  </div>
                  <div className="relative hidden h-6 w-37.5 sm:block">
                    <Image
                      alt="Sakinah.now"
                      className="object-contain object-left"
                      fill
                      sizes="150px"
                      src="/LogoTypeSakinah.now.png"
                    />
                  </div>
                </Link>
              </div>

              <div className="relative" ref={menuContainerRef}>
                <button
                  aria-expanded={isMenuOpen}
                  aria-haspopup="menu"
                  className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-(--border-accent-soft) bg-white shadow-(--shadow-pop) transition hover:shadow-(--shadow-pop-hover)"
                  onClick={() => setIsMenuOpen((current) => !current)}
                  type="button"
                >
                  {auth.avatarUrl ? (
                    <Image
                      alt={auth.displayName ? `${auth.displayName} avatar` : 'User avatar'}
                      className="object-cover"
                      fill
                      sizes="44px"
                      src={auth.avatarUrl}
                    />
                  ) : auth.isAuthenticated ? (
                    <span className="text-sm font-semibold text-(--ink-strong)">{avatarLabel}</span>
                  ) : (
                    <svg
                      className="h-5 w-5 text-(--ink-soft)"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>

                <div
                  aria-hidden={!isMenuOpen}
                  className={`absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-2xl border border-(--line) bg-(--surface-card-strong) p-2 shadow-(--shadow-menu) backdrop-blur-md transition duration-150 ease-out ${
                    isMenuOpen
                      ? 'translate-y-0 scale-100 opacity-100'
                      : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
                  }`}
                  role="menu"
                >
                  <div className="rounded-xl px-3 py-2">
                    <p className="text-sm font-semibold leading-tight text-(--ink-strong)">
                      {auth.displayName || APP_NAME}
                    </p>
                    <p className="mt-1 text-xs text-(--ink-soft)">
                      {auth.isAuthenticated
                        ? 'Connected with Quran Foundation'
                        : 'Not connected to Quran Foundation'}
                    </p>
                  </div>
                  <div className="mt-1 border-t border-(--border-subtle) pt-1">
                    {auth.isAuthenticated ? (
                      <a
                        className="flex rounded-xl px-3 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle)"
                        href="/api/qf/auth/logout"
                        role="menuitem"
                      >
                        Log out
                      </a>
                    ) : (
                      <a
                        className="flex rounded-xl px-3 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle)"
                        href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(pathname || '/')}`}
                        role="menuitem"
                      >
                        Connect Quran Foundation
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
