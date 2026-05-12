import { ChatShell } from '@/components/chat-shell';
import type { QfSessionSummary } from '@/lib/qf-user';

function PlaceholderFrame({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-(--border-soft) bg-(--surface-card) p-4 shadow-(--shadow-card)">
      <div className="aspect-4/3 rounded-[1.4rem] border border-dashed border-(--border-accent-strong) bg-[linear-gradient(180deg,rgb(255_255_255/0.72),rgb(244_244_245/0.94))] p-5">
        <div className="flex h-full flex-col items-center justify-center rounded-[1.1rem] border border-(--border-subtle) bg-(--surface-subtle-soft) text-center">
          <p className="text-sm font-semibold tracking-[0.18em] text-(--accent-strong) uppercase">
            Placeholder
          </p>
          <p className="mt-3 max-w-xs text-base font-medium text-(--ink-strong)">{label}</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-(--ink-soft)">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function ExtensionGuideScreen({ auth }: { auth: QfSessionSummary }) {
  return (
    <ChatShell auth={auth}>
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-4 sm:px-6 lg:px-8">
        <div className="hero-panel overflow-hidden rounded-4xl px-6 py-8 sm:px-8 sm:py-10 lg:px-10">
          <p className="eyebrow">Browser Companion</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-medium tracking-[-0.04em] text-(--ink-strong) sm:text-4xl lg:text-[2.9rem]">
            Bring difficult words back under a gentler, Quran-centered gaze.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-(--ink-soft) sm:text-lg">
            Sometimes a sentence online unsettles the heart before we have time to slow down. The
            Sakinah.now browser add-on helps you carry that exact moment into reflection, so what
            disturbed you can be met with remembrance, perspective, and a steadier interior state.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-(--border-soft) bg-(--surface-card-soft) px-3 py-1.5 text-sm text-(--ink-soft)">
              Chrome desktop
            </span>
            <span className="rounded-full border border-(--border-soft) bg-(--surface-card-soft) px-3 py-1.5 text-sm text-(--ink-soft)">
              Firefox desktop
            </span>
            <span className="rounded-full border border-(--border-soft) bg-(--surface-card-soft) px-3 py-1.5 text-sm text-(--ink-soft)">
              Minimal handoff
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
            <h2 className="text-lg font-semibold text-(--ink-strong)">Why it belongs here</h2>
            <p className="mt-3 text-sm leading-7 text-(--ink-soft)">
              Sakinah.now is meant to help a person return from agitation to clearer sight. The
              add-on shortens that distance when the disturbance begins on a webpage, post, or
              comment.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
            <h2 className="text-lg font-semibold text-(--ink-strong)">What it carries over</h2>
            <p className="mt-3 text-sm leading-7 text-(--ink-soft)">
              Only the selected words and the feeling you choose to name are brought into the
              reflection flow. It stays focused on the moment that needs Qur&apos;anic reorientation.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
            <h2 className="text-lg font-semibold text-(--ink-strong)">How it helps</h2>
            <p className="mt-3 text-sm leading-7 text-(--ink-soft)">
              Instead of reacting while the heart is compressed, you can pause, name what you feel,
              and open a guided reading shaped around the words that affected you.
            </p>
          </article>
        </div>

        <div className="rounded-4xl border border-(--line) bg-(--surface-warm-panel-soft) p-6 shadow-(--shadow-warm) sm:p-8">
          <div className="max-w-3xl">
            <p className="eyebrow">How It Works</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-(--ink-strong)">
              A quiet flow from interruption to reflection
            </h2>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-(--border-soft) bg-(--surface-warm-panel) p-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-(--ink-soft) uppercase">
                01
              </p>
              <h3 className="mt-3 text-base font-semibold text-(--ink-strong)">Select the words</h3>
              <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                Highlight a sentence, paragraph, or excerpt that weighed on you.
              </p>
            </article>

            <article className="rounded-3xl border border-(--border-soft) bg-(--surface-warm-panel) p-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-(--ink-soft) uppercase">
                02
              </p>
              <h3 className="mt-3 text-base font-semibold text-(--ink-strong)">Name the feeling</h3>
              <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                Use the small popover to describe the feeling if you want, then send it into
                Sakinah.now.
              </p>
            </article>

            <article className="rounded-3xl border border-(--border-soft) bg-(--surface-warm-panel) p-5">
              <p className="text-xs font-semibold tracking-[0.2em] text-(--ink-soft) uppercase">
                03
              </p>
              <h3 className="mt-3 text-base font-semibold text-(--ink-strong)">
                Read with a steadier heart
              </h3>
              <p className="mt-2 text-sm leading-7 text-(--ink-soft)">
                The reflection opens with the selected text already carried over, so the Qur&apos;anic
                lens meets the exact moment that unsettled you.
              </p>
            </article>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Visual Guide</p>
            <h2 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-(--ink-strong)">
              Place the two companion screenshots here
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-(--ink-soft)">
              These placeholders are for the right-click menu with the Sakinah item and the in-page
              popover. Once added, they will make the flow immediately clear without heavy
              explanation.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <PlaceholderFrame
            description="Replace this with the browser right-click menu showing the Sakinah item."
            label="Right-click menu screenshot"
          />
          <PlaceholderFrame
            description="Replace this with the popover where the user adds a feeling and opens Sakinah.now."
            label="Popover screenshot"
          />
        </div>

        <div className="rounded-[1.75rem] border border-(--line) bg-(--surface-card) p-6 shadow-(--shadow-card-sm)">
          <h2 className="text-lg font-semibold text-(--ink-strong)">A note on privacy</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-(--ink-soft)">
            The companion flow is designed to stay narrow and intentional. It is meant to carry the
            selected text and the feeling you choose to share, not your wider browsing trail.
          </p>
        </div>
      </section>
    </ChatShell>
  );
}
