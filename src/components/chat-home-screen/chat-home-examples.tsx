'use client';

import { useCallback, useRef, useState } from 'react';

export type ChatHomeExample = {
  dir?: 'rtl' | 'ltr';
  event: string;
  feeling: string;
  label: string;
};

const EXAMPLES: ReadonlyArray<ChatHomeExample> = [
  {
    label: 'Social media envy',
    event:
      'I spent an hour scrolling success clips and luxury posts. By the end I felt like my worth depended on being seen, praised, and always ahead.',
    feeling: 'Unsettled, heavy, and disconnected from gratitude.',
  },
  {
    label: 'المقارنة بالآخرين',
    event:
      'رأيت زميلي يحصل على ترقية بينما أنا أعمل بجد منذ سنوات. شعرت أن جهدي لا قيمة له.',
    feeling: 'حسد وإحباط وبُعد عن الرضا.',
    dir: 'rtl',
  },
  {
    label: 'A hurtful conversation',
    event:
      'Someone close to me dismissed something I care about deeply. Their words keep replaying in my head and I can’t shake the sting.',
    feeling: 'Wounded, small, and struggling to let go.',
  },
  {
    label: 'بی‌حسی معنوی',
    event:
      'نماز خواندم ولی هیچ احساسی نداشتم، فقط حرکات را انجام می‌دادم. هفته‌هاست که دلم حاضر نیست.',
    feeling: 'خالی، دور از خدا، و نگران از ادامه این حال.',
    dir: 'rtl',
  },
  {
    label: 'Career anxiety',
    event:
      'I didn’t get the role I interviewed for. Everyone around me seems to be moving forward while I’m stuck in the same place.',
    feeling: 'Hopeless and questioning whether my efforts even matter.',
  },
  {
    label: 'دل کی بےچینی',
    event:
      'میرے قریبی شخص نے میری اہم بات کو نظرانداز کیا۔ ان کے الفاظ ذہن میں گونجتے رہتے ہیں۔',
    feeling: 'زخمی، چھوٹا محسوس کر رہا ہوں.',
    dir: 'rtl',
  },
  {
    label: 'Spiritual numbness',
    event:
      'I prayed but felt nothing—just going through the motions. It’s been weeks since my heart was truly present.',
    feeling: 'Empty, distant from Allah, and afraid of staying this way.',
  },
  {
    label: 'Kariyer kaygısı',
    event:
      'Mülakatı geçemedim. Etrafımdaki herkes ilerliyor, ben hep aynı yerde sayıyorum.',
    feeling: 'Umutsuz ve çabalarımın bir anlamı olup olmadığını sorguluyorum.',
  },
  {
    label: 'Tekanan sosial',
    event:
      'Saya terus membandingkan diri dengan rakan-rakan yang kelihatan lebih berjaya. Rasa seperti saya ketinggalan.',
    feeling: 'Rendah diri dan jauh dari rasa syukur.',
  },
  {
    label: 'অশান্তি',
    event:
      'সোশ্যাল মিডিয়ায় সফল মানুষদের দেখে মনে হলো আমি পিছিয়ে পড়ছি। আমার মূল্য যেন অন্যদের প্রশংসার উপর নির্ভর করে।',
    feeling: 'অস্থির, ভারী, এবং কৃতজ্ঞতা থেকে বিচ্ছিন্ন।',
  },
  {
    label: 'Kecemasan hidup',
    event:
      'Saya merasa hampa setelah shalat. Sudah berminggu-minggu hati saya tidak benar-benar hadir.',
    feeling: 'Kosong, jauh dari Allah, dan takut terus seperti ini.',
  },
  {
    label: 'Sentiment d’injustice',
    event:
      'On m’a refusé une opportunité que je méritais. Je vois les autres avancer pendant que je stagne.',
    feeling: 'Frustré, déçu, et en doute sur la volonté divine.',
  },
];

export function ChatHomeExamples({ onSelect }: { onSelect: (example: ChatHomeExample) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scrollByAmount = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }

    el.scrollBy({
      behavior: 'smooth',
      left: direction === 'left' ? -220 : 220,
    });
  }, []);

  return (
    <div className="relative mt-6 w-full">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs font-medium text-(--ink-soft)">Browse example prompts</p>
        <div className="flex items-center gap-2">
          <button
            aria-label="Scroll examples left"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--border-subtle) bg-(--surface-card-soft) text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canScrollLeft}
            onClick={() => scrollByAmount('left')}
            type="button"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            aria-label="Scroll examples right"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-(--border-subtle) bg-(--surface-card-soft) text-(--ink-soft) transition hover:bg-white hover:text-(--ink-strong) disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canScrollRight}
            onClick={() => scrollByAmount('right')}
            type="button"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      {canScrollLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-(--background) to-transparent transition-opacity" />
      ) : null}
      {canScrollRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-(--background) to-transparent transition-opacity" />
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
        aria-label="Example prompts"
        className="scrollbar-subtle flex gap-3 overflow-x-auto px-1 py-1 pb-3"
        onScroll={handleScroll}
      >
        {EXAMPLES.map((example) => (
          <button
            key={example.label}
            className="shrink-0 rounded-xl border border-(--border-subtle) bg-(--surface-card-soft) px-4 py-3 text-left transition hover:border-(--border-accent-hover) hover:bg-white hover:shadow-(--shadow-card)"
            dir={example.dir}
            onClick={() => onSelect(example)}
            style={{ maxWidth: '11rem' }}
            type="button"
          >
            <p className="line-clamp-1 text-sm font-medium text-(--ink-strong)">{example.label}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-(--ink-soft)">{example.feeling}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
