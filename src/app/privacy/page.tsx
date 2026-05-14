import type { Metadata } from 'next';
import Link from 'next/link';
import { createPageMetadata } from '@/lib/site-metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Privacy Policy',
  description:
    'Privacy Policy for the Sakinah.now browser extension and its guided Quran-centered reflection flow.',
  keywords: ['privacy policy', 'Sakinah.now privacy', 'browser extension privacy'],
  pathname: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <section className="hero-panel rounded-4xl px-6 py-8 sm:px-8">
        <p className="eyebrow">Privacy Policy</p>
        <h1 className="mt-4 text-3xl font-medium tracking-[-0.04em] text-(--ink-strong) sm:text-4xl">
          Sakinah.now Privacy Policy
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-(--ink-soft) sm:text-base">
          Last updated: May 14, 2026
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-(--ink-soft) sm:text-base">
          This policy explains how the Sakinah.now browser extension and the related handoff to{' '}
          <span className="font-medium text-(--ink-strong)">sakinah.now</span> handle data when a
          user selects text on a webpage and sends it into the guided reflection flow.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">What the extension collects</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>
            The extension is designed to collect only the data needed for its single purpose:
            carrying a user-selected passage into a Quran-centered reflection.
          </p>
          <p>
            This may include the selected text from a webpage and any feeling text the user chooses
            to enter in the extension popover.
          </p>
          <p>
            If the user chooses the feeling-detection feature, the selected text may also be sent
            to Sakinah.now so that the app can help infer a nafs-driven reading or emotional state.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">What the extension does not collect</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>
            The extension is not designed to collect a user&apos;s broader browsing history.
          </p>
          <p>
            It does not intentionally send page titles, page URLs, or a list of pages visited as
            part of the reflection handoff.
          </p>
          <p>
            It is meant to stay focused on the specific text the user selected and the optional
            feeling they provided.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">How data is used</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>Collected data is used only to operate the Sakinah.now reflection flow.</p>
          <p>This includes:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>opening a Sakinah.now reflection for the selected text</li>
            <li>carrying over the optional feeling entered by the user</li>
            <li>supporting optional feeling detection when the user requests it</li>
            <li>preventing accidental replay of the same handoff request</li>
          </ul>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">Local storage in the extension</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>
            The extension uses local browser storage only to keep a temporary handoff record for
            the selected text and optional feeling.
          </p>
          <p>
            That temporary state is used so the reflection request can be delivered to Sakinah.now
            and so completed requests are not replayed unexpectedly.
          </p>
          <p>
            Temporary extension request data is automatically pruned after a short time window,
            currently about 15 minutes.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">When data is sent to Sakinah.now</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>
            When a user confirms the extension action, the selected text and optional feeling are
            sent to Sakinah.now to start the guided reflection.
          </p>
          <p>
            If the user uses feeling detection, selected text is sent to Sakinah.now to process
            that request. Features on Sakinah.now may rely on service providers that help operate
            the app, including AI service providers used for reflection assistance or feeling
            detection.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">Data sharing</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-(--ink-soft)">
          <p>
            Sakinah.now does not sell selected text, feeling text, or extension handoff data.
          </p>
          <p>
            Data is used only to operate the extension&apos;s single purpose and the related
            reflection experience.
          </p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
        <h2 className="text-lg font-semibold text-(--ink-strong)">Policy updates</h2>
        <p className="mt-4 text-sm leading-7 text-(--ink-soft)">
          This policy may be updated over time as the extension or the Sakinah.now app changes.
          The latest version will be published at this page.
        </p>
      </section>

      <p className="text-sm leading-7 text-(--ink-soft)">
        Related page:{' '}
        <Link className="underline decoration-(--underline-soft) underline-offset-4" href="/extension">
          Browser Companion
        </Link>
      </p>
    </main>
  );
}
