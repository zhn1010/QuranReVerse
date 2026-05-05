'use client';

import Image from 'next/image';
import { APP_CANONICAL_ORIGIN, APP_NAME } from '@/lib/app-constants';
import type { QfSessionSummary } from '@/lib/qf-user';

export function ChatShellMenu({
  auth,
  avatarLabel,
  isMenuOpen,
  pathname,
  setIsMenuOpen,
}: {
  auth: QfSessionSummary;
  avatarLabel: string;
  isMenuOpen: boolean;
  pathname: string;
  setIsMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  return (
    <>
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
            {auth.isAuthenticated ? 'Connected with Quran Foundation' : 'Not connected to Quran Foundation'}
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
    </>
  );
}
