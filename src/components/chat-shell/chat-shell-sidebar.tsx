'use client';

import Link from 'next/link';
import { SidebarBookmarksPanel } from '@/components/sidebar-bookmarks-panel';
import { SidebarNotesPanel } from '@/components/sidebar-notes-panel';
import { ChatHistoryList } from './chat-history-list';
import type { LocalChatThread } from '@/lib/chat-store';

const SIDEBAR_TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'notes', label: 'Notes' },
  { id: 'bookmarks', label: 'Bookmarks' },
] as const;

export type SidebarTabId = (typeof SIDEBAR_TABS)[number]['id'];

export function ChatShellSidebar({
  activeChatId,
  activeSidebarTab,
  authIsAuthenticated,
  history,
  isDesktopSidebarExpanded,
  isMobileSidebarOpen,
  setActiveSidebarTab,
  onSidebarCollapse,
  onSidebarNavigation,
  onSidebarToggle,
}: {
  activeChatId?: string;
  activeSidebarTab: SidebarTabId;
  authIsAuthenticated: boolean;
  history: LocalChatThread[];
  isDesktopSidebarExpanded: boolean;
  isMobileSidebarOpen: boolean;
  setActiveSidebarTab: (tab: SidebarTabId) => void;
  onSidebarCollapse: () => void;
  onSidebarNavigation: () => void;
  onSidebarToggle: () => void;
}) {
  const isSidebarExpanded = isDesktopSidebarExpanded || isMobileSidebarOpen;
  const railButtonClass =
    'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--line) bg-white/80 text-(--ink-soft) transition hover:bg-white';
  const railSectionClass = 'px-4.5';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 h-screen w-72 -translate-x-full overflow-hidden border-r border-(--border-subtle) bg-(--surface-sidebar) backdrop-blur-xl transition-[width,transform] duration-300 ${
        isMobileSidebarOpen ? 'translate-x-0' : ''
      } ${isDesktopSidebarExpanded ? 'md:w-72' : 'md:w-18 md:px-0'} md:sticky md:top-0 md:translate-x-0`}
    >
      <div className="flex h-full min-h-0 flex-col pt-4">
        <div className={`${railSectionClass} flex items-center justify-between pt-2`}>
          <span className="sr-only">Conversations</span>
          <button
            aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className={railButtonClass}
            onClick={onSidebarToggle}
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
              onClick={onSidebarCollapse}
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
              isSidebarExpanded ? 'w-full gap-4 rounded-full pr-4 hover:bg-white/70' : 'h-9 w-9 justify-center'
            }`}
            href="/"
            onClick={onSidebarNavigation}
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
                  <ChatHistoryList
                    activeChatId={activeChatId}
                    history={history}
                    onNavigate={onSidebarNavigation}
                  />
                ) : activeSidebarTab === 'notes' ? (
                  <SidebarNotesPanel isAuthenticated={authIsAuthenticated} />
                ) : (
                  <SidebarBookmarksPanel isAuthenticated={authIsAuthenticated} />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
