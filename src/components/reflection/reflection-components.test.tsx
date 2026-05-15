import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OriginalReflectionDetails } from '@/components/reflection/original-reflection-details';
import { QuranEmbedCard } from '@/components/reflection/quran-embed-card';
import { ReflectionBody } from '@/components/reflection/reflection-body';
import { SaveNoteModal } from '@/components/reflection/save-note-modal';

describe('ReflectionBody', () => {
  it('renders inline metadata and post links for chat results', () => {
    const html = renderToStaticMarkup(
      <ReflectionBody
        authorName="Amina"
        body="A grounded reflection."
        createdAt="2025-01-01T00:00:00.000Z"
        fallbackDirection="ltr"
        postId={9}
        translatedFromLanguageCode="en"
      />,
    );

    expect(html).toContain('By Amina');
    expect(html).toContain('Translated from EN');
    expect(html).toContain('Read on QuranReflect.com');
    expect(html).toContain('https://quranreflect.com/posts/9');
  });

  it('renders the collapse affordance for long workbench reflections', () => {
    const html = renderToStaticMarkup(
      <ReflectionBody
        body={'x'.repeat(421)}
        collapsible
        fallbackDirection="ltr"
        metaLayout="stacked"
        postId={11}
      />,
    );

    expect(html).toContain('Continue reading');
    expect(html).toContain('Read on QuranReflect.com');
  });
});

describe('OriginalReflectionDetails', () => {
  it('renders the summary label and original body', () => {
    const html = renderToStaticMarkup(
      <OriginalReflectionDetails body="Original reflection body." fallbackDirection="ltr" />,
    );

    expect(html).toContain('Show original reflection text');
    expect(html).toContain('Original reflection body.');
  });
});

describe('QuranEmbedCard', () => {
  it('renders the iframe title and embed url', () => {
    const html = renderToStaticMarkup(
      <QuranEmbedCard
        ayahNo="255"
        containerClassName="card"
        label="2:255"
        surahNo={2}
        translationId={85}
      />,
    );

    expect(html).toContain('Quran passage 2:255');
    expect(html).toContain('verses=2%3A255');
  });
});

describe('SaveNoteModal', () => {
  it('renders the shared note modal content', () => {
    const html = renderToStaticMarkup(
      <SaveNoteModal
        body=""
        description="This note will be saved."
        error={null}
        isGenerating={false}
        isOpen
        isSaving={false}
        onBodyChange={() => {}}
        onClose={() => {}}
        onGenerateDraft={() => {}}
        onSave={() => {}}
        placeholder="Write here..."
        title="Save a note"
      />,
    );

    expect(html).toContain('Save a note');
    expect(html).toContain('Generate draft');
    expect(html).toContain('Save note');
    expect(html).toContain('Write here...');
  });

  it('hides the draft action when the textarea already has content', () => {
    const html = renderToStaticMarkup(
      <SaveNoteModal
        body="Draft body"
        description="This note will be saved."
        error={null}
        isGenerating={false}
        isOpen
        isSaving={false}
        onBodyChange={() => {}}
        onClose={() => {}}
        onGenerateDraft={() => {}}
        onSave={() => {}}
        placeholder="Write here..."
        title="Save a note"
      />,
    );

    expect(html).not.toContain('Generate draft');
  });

  it('detects rtl note text direction automatically', () => {
    const html = renderToStaticMarkup(
      <SaveNoteModal
        body="قلبي متعب"
        description="This note will be saved."
        error="حدث خطأ"
        isGenerating={false}
        isOpen
        isSaving={false}
        onBodyChange={() => {}}
        onClose={() => {}}
        onGenerateDraft={() => {}}
        onSave={() => {}}
        placeholder="Write here..."
        title="Save a note"
      />,
    );

    expect(html).toContain('dir="rtl"');
    expect(html).toContain('text-right');
  });
});
