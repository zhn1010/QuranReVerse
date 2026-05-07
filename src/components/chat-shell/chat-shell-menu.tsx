'use client';

import Image from 'next/image';
import { useId } from 'react';
import { UserIcon } from '@/components/icons';
import { APP_CANONICAL_ORIGIN, APP_NAME } from '@/lib/shared/constants/app';
import type { QfSessionSummary } from '@/lib/shared/qf/types';

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
  const menuId = useId();
  const buttonLabel = auth.isAuthenticated ? 'Open account options' : 'Open connection options';

  return (
    <>
      <button
        aria-controls={isMenuOpen ? menuId : undefined}
        aria-expanded={isMenuOpen}
        aria-haspopup="true"
        aria-label={buttonLabel}
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
          <UserIcon className="h-5 w-5 text-(--ink-soft)" />
        )}
      </button>

      {isMenuOpen ? (
        <div
          aria-label="Account options"
          className="absolute right-0 top-full z-30 mt-2 w-64 origin-top-right rounded-2xl border border-(--line) bg-(--surface-card-strong) p-2 shadow-(--shadow-menu) backdrop-blur-md transition duration-150 ease-out"
          id={menuId}
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
          <nav aria-label="Account actions" className="mt-1 border-t border-(--border-subtle) pt-1">
            {auth.isAuthenticated ? (
              <a
                className="flex rounded-xl px-3 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle)"
                href="/api/qf/auth/logout"
                onClick={() => setIsMenuOpen(false)}
              >
                Log out
              </a>
            ) : (
              <a
                className="flex rounded-xl px-3 py-2.5 text-sm font-medium text-(--ink-strong) transition hover:bg-(--surface-subtle)"
                href={`${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(pathname || '/')}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Connect Quran Foundation
              </a>
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}
