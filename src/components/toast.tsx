'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckIcon, CloseIcon, InfoIcon, XIcon } from '@/components/icons';
import type { ToastContextValue, ToastOptions } from '@/components/toast-public';

type ToastVariant = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  /** milliseconds before auto-dismiss; 0 = manual only */
  duration: number;
  leaving: boolean;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  error: 6000,
  info: 4000,
};

const LEAVE_MS = 320;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, LEAVE_MS);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = ++nextId;
      const duration = options?.duration ?? DEFAULT_DURATION[variant];
      setToasts((prev) => [...prev, { id, message, variant, duration, leaving: false }]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const ctx: ToastContextValue = {
    success: useCallback((msg, opts) => push('success', msg, opts), [push]),
    error: useCallback((msg, opts) => push('error', msg, opts), [push]),
    info: useCallback((msg, opts) => push('info', msg, opts), [push]),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-9999 flex flex-col items-center gap-3 px-4 pb-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */

const variantStyles: Record<
  ToastVariant,
  { bg: string; border: string; text: string; Icon: typeof CheckIcon }
> = {
  success: {
    bg: 'bg-(--surface-overlay)',
    border: 'border-(--border-success)',
    text: 'text-(--ink-success)',
    Icon: CheckIcon,
  },
  error: {
    bg: 'bg-(--surface-overlay)',
    border: 'border-(--border-warning)',
    text: 'text-(--ink-warning)',
    Icon: XIcon,
  },
  info: {
    bg: 'bg-(--surface-overlay)',
    border: 'border-(--border-default)',
    text: 'text-(--ink-strong)',
    Icon: InfoIcon,
  },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const style = variantStyles[toast.variant];
  const { Icon } = style;
  const liveProps =
    toast.variant === 'error'
      ? { 'aria-live': 'assertive' as const, role: 'alert' as const }
      : { 'aria-live': 'polite' as const, role: 'status' as const };

  return (
    <div
      aria-atomic="true"
      className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-(--shadow-toast) backdrop-blur-sm transition-all duration-300 ${style.bg} ${style.border} ${
        toast.leaving
          ? 'translate-y-4 scale-95 opacity-0'
          : 'translate-y-0 scale-100 opacity-100 animate-[toast-in_0.32s_ease-out]'
      }`}
      {...liveProps}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${style.text}`} />
      <p className={`flex-1 text-sm leading-6 font-medium ${style.text}`}>{toast.message}</p>
      <button
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 rounded-full p-0.5 text-(--ink-soft) transition hover:text-(--ink-strong)"
        onClick={() => onDismiss(toast.id)}
        type="button"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}
