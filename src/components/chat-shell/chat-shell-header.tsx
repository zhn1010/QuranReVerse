'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { QfSessionSummary } from '@/lib/qf-user';
import { ChatShellMenu } from './chat-shell-menu';

export function ChatShellHeader({
  auth,
  avatarLabel,
  isMobileSidebarOpen,
  isMenuOpen,
  pathname,
  setIsMenuOpen,
  setIsMobileSidebarOpen,
}: {
  auth: QfSessionSummary;
  avatarLabel: string;
  isMobileSidebarOpen: boolean;
  isMenuOpen: boolean;
  pathname: string;
  setIsMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  setIsMobileSidebarOpen: (value: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-(--line) bg-(--surface-card) backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            aria-expanded={isMobileSidebarOpen}
            aria-haspopup="dialog"
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

        <div className="relative">
          <ChatShellMenu
            auth={auth}
            avatarLabel={avatarLabel}
            isMenuOpen={isMenuOpen}
            pathname={pathname}
            setIsMenuOpen={setIsMenuOpen}
          />
        </div>
      </div>
    </header>
  );
}
