'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { ChatShell } from '@/components/chat-shell';
import type { QfSessionSummary } from '@/lib/qf-user';
import { createPendingChatThread } from '@/lib/chat-store';
import { detectTextDirection, getDirectionStyles } from '@/lib/reflection-ui';

const starterEvent = '';
const starterFeeling = '';
const HERO_HIDDEN_KEY = 'sakinah:hero-hidden';

const EXAMPLES: ReadonlyArray<{
  label: string;
  event: string;
  feeling: string;
  dir?: 'rtl' | 'ltr';
}> = [
  {
    label: 'Social media envy',
    event:
      'I spent an hour scrolling success clips and luxury posts. By the end I felt like my worth depended on being seen, praised, and always ahead.',
    feeling: 'Unsettled, heavy, and disconnected from gratitude.',
  },
  {
    label:
      '\u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629 \u0628\u0627\u0644\u0622\u062E\u0631\u064A\u0646',
    event:
      '\u0631\u0623\u064A\u062A \u0632\u0645\u064A\u0644\u064A \u064A\u062D\u0635\u0644 \u0639\u0644\u0649 \u062A\u0631\u0642\u064A\u0629 \u0628\u064A\u0646\u0645\u0627 \u0623\u0646\u0627 \u0623\u0639\u0645\u0644 \u0628\u062C\u062F \u0645\u0646\u0630 \u0633\u0646\u0648\u0627\u062A. \u0634\u0639\u0631\u062A \u0623\u0646 \u062C\u0647\u062F\u064A \u0644\u0627 \u0642\u064A\u0645\u0629 \u0644\u0647.',
    feeling:
      '\u062D\u0633\u062F \u0648\u0625\u062D\u0628\u0627\u0637 \u0648\u0628\u064F\u0639\u062F \u0639\u0646 \u0627\u0644\u0631\u0636\u0627.',
    dir: 'rtl',
  },
  {
    label: 'A hurtful conversation',
    event:
      'Someone close to me dismissed something I care about deeply. Their words keep replaying in my head and I can\u2019t shake the sting.',
    feeling: 'Wounded, small, and struggling to let go.',
  },
  {
    label: '\u0628\u06CC\u200C\u062D\u0633\u06CC \u0645\u0639\u0646\u0648\u06CC',
    event:
      '\u0646\u0645\u0627\u0632 \u062E\u0648\u0627\u0646\u062F\u0645 \u0648\u0644\u06CC \u0647\u06CC\u0686 \u0627\u062D\u0633\u0627\u0633\u06CC \u0646\u062F\u0627\u0634\u062A\u0645\u060C \u0641\u0642\u0637 \u062D\u0631\u06A9\u0627\u062A \u0631\u0627 \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u062F\u0627\u062F\u0645. \u0647\u0641\u062A\u0647\u200C\u0647\u0627\u0633\u062A \u06A9\u0647 \u062F\u0644\u0645 \u062D\u0627\u0636\u0631 \u0646\u06CC\u0633\u062A.',
    feeling:
      '\u062E\u0627\u0644\u06CC\u060C \u062F\u0648\u0631 \u0627\u0632 \u062E\u062F\u0627\u060C \u0648 \u0646\u06AF\u0631\u0627\u0646 \u0627\u0632 \u0627\u062F\u0627\u0645\u0647 \u0627\u06CC\u0646 \u062D\u0627\u0644.',
    dir: 'rtl',
  },
  {
    label: 'Career anxiety',
    event:
      'I didn\u2019t get the role I interviewed for. Everyone around me seems to be moving forward while I\u2019m stuck in the same place.',
    feeling: 'Hopeless and questioning whether my efforts even matter.',
  },
  {
    label: '\u062F\u0644 \u06A9\u06CC \u0628\u06D2\u0686\u06CC\u0646\u06CC',
    event:
      '\u0645\u06CC\u0631\u06D2 \u0642\u0631\u06CC\u0628\u06CC \u0634\u062E\u0635 \u0646\u06D2 \u0645\u06CC\u0631\u06CC \u0627\u06C1\u0645 \u0628\u0627\u062A \u06A9\u0648 \u0646\u0638\u0631\u0627\u0646\u062F\u0627\u0632 \u06A9\u06CC\u0627\u06D4 \u0627\u0646 \u06A9\u06D2 \u0627\u0644\u0641\u0627\u0638 \u0630\u06C1\u0646 \u0645\u06CC\u06BA \u06AF\u0648\u0646\u062C\u062A\u06D2 \u0631\u06C1\u062A\u06D2 \u06C1\u06CC\u06BA\u06D4',
    feeling:
      '\u0632\u062E\u0645\u06CC\u060C \u0686\u0648\u0679\u0627 \u0645\u062D\u0633\u0648\u0633 \u06A9\u0631 \u0631\u06C1\u0627 \u06C1\u0648\u06BA.',
    dir: 'rtl',
  },
  {
    label: 'Spiritual numbness',
    event:
      'I prayed but felt nothing\u2014just going through the motions. It\u2019s been weeks since my heart was truly present.',
    feeling: 'Empty, distant from Allah, and afraid of staying this way.',
  },
  {
    label: 'Kariyer kayg\u0131s\u0131',
    event:
      'M\u00FClakat\u0131 ge\u00E7emedim. Etraf\u0131mdaki herkes ilerliyor, ben hep ayn\u0131 yerde say\u0131yorum.',
    feeling:
      'Umutsuz ve \u00E7abalar\u0131m\u0131n bir anlam\u0131 olup olmad\u0131\u011F\u0131n\u0131 sorguluyorum.',
  },
  {
    label: 'Tekanan sosial',
    event:
      'Saya terus membandingkan diri dengan rakan-rakan yang kelihatan lebih berjaya. Rasa seperti saya ketinggalan.',
    feeling: 'Rendah diri dan jauh dari rasa syukur.',
  },
  {
    label: '\u0985\u09B6\u09BE\u09A8\u09CD\u09A4\u09BF',
    event:
      '\u09B8\u09CB\u09B6\u09CD\u09AF\u09BE\u09B2 \u09AE\u09BF\u09A1\u09BF\u09AF\u09BC\u09BE\u09AF\u09BC \u09B8\u09AB\u09B2 \u09AE\u09BE\u09A8\u09C1\u09B7\u09A6\u09C7\u09B0 \u09A6\u09C7\u0996\u09C7 \u09AE\u09A8\u09C7 \u09B9\u09B2\u09CB \u0986\u09AE\u09BF \u09AA\u09BF\u099B\u09BF\u09AF\u09BC\u09C7 \u09AA\u09A1\u09BC\u099B\u09BF\u0964 \u0986\u09AE\u09BE\u09B0 \u09AE\u09C2\u09B2\u09CD\u09AF \u09AF\u09C7\u09A8 \u0985\u09A8\u09CD\u09AF\u09A6\u09C7\u09B0 \u09AA\u09CD\u09B0\u09B6\u0982\u09B8\u09BE\u09B0 \u0989\u09AA\u09B0 \u09A8\u09BF\u09B0\u09CD\u09AD\u09B0 \u0995\u09B0\u09C7\u0964',
    feeling:
      '\u0985\u09B8\u09CD\u09A5\u09BF\u09B0, \u09AD\u09BE\u09B0\u09C0, \u098F\u09AC\u0982 \u0995\u09C3\u09A4\u099C\u09CD\u099E\u09A4\u09BE \u09A5\u09C7\u0995\u09C7 \u09AC\u09BF\u099A\u09CD\u099B\u09BF\u09A8\u09CD\u09A8\u0964',
  },
  {
    label: 'Kecemasan hidup',
    event:
      'Saya merasa hampa setelah shalat. Sudah berminggu-minggu hati saya tidak benar-benar hadir.',
    feeling: 'Kosong, jauh dari Allah, dan takut terus seperti ini.',
  },
  {
    label: 'Sentiment d\u2019injustice',
    event:
      'On m\u2019a refus\u00E9 une opportunit\u00E9 que je m\u00E9ritais. Je vois les autres avancer pendant que je stagne.',
    feeling: 'Frustr\u00E9, d\u00E9\u00E7u, et en doute sur la volont\u00E9 divine.',
  },
];

export function ChatHomeScreen({ auth }: { auth: QfSessionSummary }) {
  const router = useRouter();
  const [eventContent, setEventContent] = useState(starterEvent);
  const [userFeeling, setUserFeeling] = useState(starterFeeling);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const [isHeroVisible, setIsHeroVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(HERO_HIDDEN_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  return (
    <ChatShell auth={auth}>
      <section className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-3xl flex-col items-start justify-center px-4 pb-[16vh] sm:px-6">
        <div className="mb-10">
          <p className="text-lg text-(--ink-soft)">
            Salaam{auth.displayName ? ` ${auth.displayName.split(' ')[0]}` : ''}
          </p>
          <h1 className="mt-1 text-3xl font-medium tracking-[-0.03em] text-(--ink-strong) sm:text-4xl">
            What is weighing on your heart?
          </h1>
        </div>

        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();

            const normalizedEvent = eventContent.trim();
            const normalizedFeeling = userFeeling.trim();

            if (!normalizedEvent) {
              return;
            }

            const chatId = crypto.randomUUID();
            createPendingChatThread({
              eventContent: normalizedEvent,
              id: chatId,
              userFeeling: normalizedFeeling,
            });
            router.push(`/chat/${chatId}`);
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-[rgba(63,63,70,0.1)] bg-white shadow-[0_2px_12px_rgba(24,24,27,0.06)]">
            <div className="px-5 pt-4 pb-2 sm:px-6">
              <textarea
                className={`min-h-24 w-full resize-none bg-transparent text-base leading-7 text-(--ink-strong) outline-none placeholder:text-[rgba(113,113,122,0.55)] ${getDirectionStyles(
                  detectTextDirection(eventContent),
                )}`}
                dir={detectTextDirection(eventContent)}
                onChange={(inputEvent) => setEventContent(inputEvent.target.value)}
                placeholder="Describe the event, post, or conversation that pulled you off-center..."
                value={eventContent}
              />
            </div>

            <div className="flex items-center gap-3 border-t border-[rgba(63,63,70,0.06)] px-5 py-3 sm:px-6">
              <input
                className={`min-w-0 flex-1 bg-transparent text-sm leading-6 text-(--ink-strong) outline-none placeholder:text-[rgba(113,113,122,0.55)] ${getDirectionStyles(
                  detectTextDirection(userFeeling),
                )}`}
                dir={detectTextDirection(userFeeling)}
                onChange={(inputEvent) => setUserFeeling(inputEvent.target.value)}
                placeholder="How are you feeling? (optional)"
                type="text"
                value={userFeeling}
              />
              <button
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--ink-strong) text-white transition hover:bg-(--accent) disabled:opacity-40"
                disabled={!eventContent.trim()}
                type="submit"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </form>

        <div className="relative mt-6 w-full">
          {canScrollLeft ? (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[rgba(244,244,245,0.98)] to-transparent transition-opacity" />
          ) : null}
          {canScrollRight ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[rgba(244,244,245,0.98)] to-transparent transition-opacity" />
          ) : null}
          <div
            ref={(el) => {
              (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
              if (el) {
                requestAnimationFrame(() => {
                  setCanScrollLeft(el.scrollLeft > 2);
                  setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
                });
              }
            }}
            className="scrollbar-hide flex gap-3 overflow-x-auto px-1 py-1"
            onScroll={handleScroll}
          >
            {EXAMPLES.map((example) => (
              <button
                key={example.label}
                className="shrink-0 rounded-xl border border-[rgba(63,63,70,0.08)] bg-white/70 px-4 py-3 text-left transition hover:border-[rgba(63,63,70,0.18)] hover:bg-white hover:shadow-[0_2px_8px_rgba(24,24,27,0.06)]"
                dir={example.dir}
                onClick={() => {
                  setEventContent(example.event);
                  setUserFeeling(example.feeling);
                }}
                style={{ maxWidth: '11rem' }}
                type="button"
              >
                <p className="line-clamp-1 text-sm font-medium text-(--ink-strong)">
                  {example.label}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--ink-soft)">
                  {example.feeling}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {isHeroVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(18,18,20,0.32)] p-4 sm:p-6">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-8 shadow-[0_24px_80px_rgba(24,24,27,0.16)] sm:p-10">
            <button
              aria-label="Close intro"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg text-(--ink-soft) transition hover:bg-[rgba(244,244,245,0.8)] hover:text-(--ink-strong)"
              onClick={() => {
                setIsHeroVisible(false);
                try {
                  localStorage.setItem(HERO_HIDDEN_KEY, 'true');
                } catch {
                  // ignore localStorage failures
                }
              }}
              type="button"
            >
              ×
            </button>

            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                <Image
                  alt="Sakinah.now logo"
                  className="object-contain p-1"
                  fill
                  sizes="40px"
                  src="/LogoSakinah.now.png"
                />
              </div>
              <div className="relative h-6 w-[140px]">
                <Image
                  alt="Sakinah.now"
                  className="object-contain object-left"
                  fill
                  sizes="140px"
                  src="/LogoTypeSakinah.now.png"
                />
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-(--ink-strong)">
              Return to inner calm through Quranic reflection
            </h2>
            <p className="mt-3 text-sm leading-7 text-(--ink-soft)">
              Share what shook your heart, and receive a grounded reading path back to sakinah.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(244,244,245,0.9)] text-xs font-semibold text-(--ink-soft)">
                  1
                </span>
                <div>
                  <p className="text-sm font-medium text-(--ink-strong)">Describe the moment</p>
                  <p className="text-xs leading-5 text-(--ink-soft)">What disrupted your peace?</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(244,244,245,0.9)] text-xs font-semibold text-(--ink-soft)">
                  2
                </span>
                <div>
                  <p className="text-sm font-medium text-(--ink-strong)">Name what you feel</p>
                  <p className="text-xs leading-5 text-(--ink-soft)">
                    So the reading can meet you there.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(244,244,245,0.9)] text-xs font-semibold text-(--ink-soft)">
                  3
                </span>
                <div>
                  <p className="text-sm font-medium text-(--ink-strong)">Sit with a guided verse</p>
                  <p className="text-xs leading-5 text-(--ink-soft)">
                    A reflection and Quran passage to steady your heart.
                  </p>
                </div>
              </div>
            </div>

            <button
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-(--ink-strong) px-5 py-3 text-sm font-semibold text-white transition hover:bg-(--accent)"
              onClick={() => {
                setIsHeroVisible(false);
                try {
                  localStorage.setItem(HERO_HIDDEN_KEY, 'true');
                } catch {
                  // ignore localStorage failures
                }
              }}
              type="button"
            >
              Start reflecting
            </button>
          </div>
        </div>
      ) : null}
    </ChatShell>
  );
}
