import Image from 'next/image';
import Link from 'next/link';
import { CheckIcon, MagicStarsIcon } from '@/components/icons';
import { ChatShell } from '@/components/chat-shell';
import type { QfSessionSummary } from '@/lib/qf-user';

const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/sakinah-now/placeholder';

const installSteps = [
  {
    eyebrow: '01',
    title: 'Select the words that disturbed you',
    description:
      'Highlight the sentence, headline, or paragraph that landed heavily before you react to it.',
  },
  {
    eyebrow: '02',
    title: 'Name the feeling beneath it',
    description:
      'Use a few words of your own, or ask Sakinah.now to detect the nafs-driven reading.',
  },
  {
    eyebrow: '03',
    title: 'Begin Quranic reflection',
    description:
      'The handoff opens with the text already carried over, ready for a calmer and more grounded reading.',
  },
] as const;

const highlights = [
  'From disturbance to reflection',
  'Feeling-aware handoff',
  'Quran-centered perspective',
] as const;

function ScreenshotCard({
  alt,
  caption,
  src,
  title,
}: {
  alt: string;
  caption: string;
  src: string;
  title: string;
}) {
  return (
    <figure className="group">
      <div className="relative overflow-hidden rounded-4xl border border-(--line) bg-white shadow-(--shadow-card-lg)">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.75),transparent)]" />
        <div className="relative aspect-16/10 bg-white">
          <Image
            alt={alt}
            className="object-cover object-top transition duration-300 group-hover:scale-[1.01]"
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            src={src}
          />
        </div>
      </div>
      <figcaption className="px-1 pt-4">
        <p className="text-sm font-medium text-(--ink-strong)">{title}</p>
        <p className="mt-1 text-sm leading-6 text-(--ink-soft)">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function ExtensionGuideScreen({ auth }: { auth: QfSessionSummary }) {
  return (
    <ChatShell auth={auth}>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-6 sm:px-6 lg:px-8">
        <section className="hero-panel overflow-hidden rounded-4xl px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
            <div>
              <p className="eyebrow">Chrome Extension</p>
              <h1 className="mt-4 max-w-4xl text-3xl font-medium tracking-tighter text-(--ink-strong) sm:text-4xl lg:text-[3.15rem]">
                Carry a difficult moment on the web straight into Quranic reflection.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-(--ink-soft) sm:text-lg">
                When a headline, post, or argument unsettles the heart, Sakinah.now gives you a
                calmer next move: highlight the words, name what they stirred in you, and open a
                guided reflection shaped around that exact moment.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                {highlights.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-(--border-soft) bg-(--surface-card-soft) px-3 py-1.5 text-sm text-(--ink-soft)"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 lg:border-l lg:border-(--line) lg:pl-8">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-[rgb(111_81_33)] uppercase">
                  <MagicStarsIcon className="h-3.5 w-3.5" />
                  Chrome Web Store
                </div>
                <p className="mt-4 text-sm leading-7 text-(--ink-soft)">
                  Install the companion and keep Quranic reflection one highlight away.
                </p>
              </div>

              <div className="extension-cta-glow">
                <Link
                  className="extension-cta-button inline-flex items-center justify-center rounded-full bg-[#211811] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2d2118]"
                  href={CHROME_WEB_STORE_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  Add to Chrome
                </Link>
              </div>

              <div className="space-y-3 text-sm leading-6 text-(--ink-soft)">
                <div className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(111_81_33)]" />
                  <p>Built for Chrome desktop.</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(111_81_33)]" />
                  <p>Only the selected text and your chosen feeling are carried over.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="eyebrow">How It Works</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-(--ink-strong)">
              A quiet flow from interruption to steadier sight
            </h2>
          </div>

          <div className="mt-8 grid gap-6 border-t border-(--line) pt-6 md:grid-cols-3">
            {installSteps.map((step) => (
              <article key={step.eyebrow} className="pr-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-(--ink-soft) uppercase">
                  {step.eyebrow}
                </p>
                <h3 className="mt-3 text-base font-semibold text-(--ink-strong)">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-(--ink-soft)">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="max-w-3xl">
            <p className="eyebrow">Visual Flow</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-(--ink-strong)">
              Two moments are all it takes
            </h2>
            <p className="mt-4 text-sm leading-7 text-(--ink-soft)">
              The companion stays intentionally narrow: first it appears where the disturbance
              happened, then it carries that same moment into reflection without widening the
              handoff.
            </p>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <ScreenshotCard
              alt="Highlighted article text with the Sakinah.now right-click option shown in the browser context menu."
              caption="Highlight the exact words that hit the heart, then open the Sakinah.now action from the context menu."
              src="/2.jpg"
              title="Open the companion where the moment happened"
            />
            <ScreenshotCard
              alt="Sakinah.now popover on top of an article with the Detect Nafs-driven reading option and the Begin Quranic reflection button."
              caption="Name what the text stirred in you, or let the extension detect the nafs-driven reading before beginning reflection."
              src="/3.jpg"
              title="Carry the feeling over in a single, quiet step"
            />
          </div>
        </section>

        <section className="border-t border-(--line) pt-6">
          <h2 className="text-base font-semibold text-(--ink-strong)">A note on privacy</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-(--ink-soft)">
            The companion is designed to stay narrow and intentional. It is meant to carry the
            selected text and the feeling you choose to share, not your wider browsing trail. Read
            the{' '}
            <Link
              className="underline decoration-(--underline-soft) underline-offset-4"
              href="/privacy"
            >
              privacy policy
            </Link>
            .
          </p>
        </section>
      </section>
    </ChatShell>
  );
}
