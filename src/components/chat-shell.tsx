'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { QfSessionSummary } from '@/lib/qf-user';
import { listChatThreads, getServerSnapshot, subscribeToChatHistory } from '@/lib/chat-store';

const APP_CANONICAL_ORIGIN = process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'https://sakinah.now';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarHasOpened, setSidebarHasOpened] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,244,245,0.98))]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[288px] border-r border-[rgba(63,63,70,0.08)] bg-[rgba(248,248,249,0.96)] px-4 py-4 backdrop-blur-xl ${sidebarHasOpened ? 'transition-transform duration-300' : ''} ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-(--ink-soft)">
                Conversations
              </span>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--line) bg-white/80 text-(--ink-soft) transition hover:bg-white"
                onClick={() => setIsSidebarOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-(--ink-strong) px-4 py-3 text-sm font-semibold text-white transition hover:bg-(--accent) md:mt-2"
              href="/"
              onClick={() => setIsSidebarOpen(false)}
            >
              New chat
            </Link>

            <div className="mt-6 flex-1 overflow-y-auto">
              <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-(--ink-soft)">
                Recent
              </p>
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
                            ? 'bg-white text-(--ink-strong) shadow-[0_10px_24px_rgba(24,24,27,0.08)]'
                            : 'text-(--ink-soft) hover:bg-white/70 hover:text-(--ink-strong)'
                        }`}
                        href={`/chat/${thread.id}`}
                        key={thread.id}
                        onClick={() => setIsSidebarOpen(false)}
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
            </div>
          </div>
        </aside>

        {isSidebarOpen ? (
          <button
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-[rgba(24,24,27,0.18)]"
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 backdrop-blur-xl bg-[rgba(255,255,255,0.82)] border-b border-(--line)">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-(--ink-soft) transition hover:bg-[rgba(244,244,245,0.8)]"
                  onClick={() => {
                    setSidebarHasOpened(true);
                    setIsSidebarOpen(true);
                  }}
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
                  <div className="relative h-10 w-10 overflow-hidden rounded-full shadow-[0_8px_20px_rgba(24,24,27,0.06)]">
                    <Image
                      alt="Sakinah.now logo"
                      className="object-contain p-1.5"
                      fill
                      sizes="40px"
                      src="/LogoSakinah.now.png"
                    />
                  </div>
                  <div className="relative hidden h-6 w-[150px] sm:block">
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

              <div className="relative">
                <button
                  className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[rgba(82,82,91,0.12)] bg-white shadow-[0_10px_24px_rgba(24,24,27,0.08)]"
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
                  ) : (
                    <span className="text-sm font-semibold text-(--ink-strong)">{avatarLabel}</span>
                  )}
                </button>

                {isMenuOpen ? (
                  <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-(--line) bg-white p-3 shadow-[0_18px_40px_rgba(24,24,27,0.12)]">
                    <div className="border-b border-(--line) px-2 pb-3">
                      <p className="text-sm font-semibold text-(--ink-strong)">
                        {auth.displayName || 'Sakinah.now'}
                      </p>
                      <p className="mt-1 text-xs text-(--ink-soft)">
                        {auth.isAuthenticated
                          ? 'Connected with Quran Foundation'
                          : 'Not connected to Quran Foundation'}
                      </p>
                    </div>
                    <div className="mt-3">
                      {auth.isAuthenticated ? (
                        <a
                          className="flex rounded-xl px-3 py-2 text-sm font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.9)]"
                          href="/api/qf/auth/logout"
                        >
                          Log out
                        </a>
                      ) : (
                        <a
                          className="flex rounded-xl px-3 py-2 text-sm font-medium text-(--ink-strong) transition hover:bg-[rgba(244,244,245,0.9)]"
                          href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(pathname || '/')}`}
                        >
                          Connect Quran Foundation
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
