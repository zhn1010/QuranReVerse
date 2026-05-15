import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReflectionResultActions } from '@/components/chat-result-view/reflection-result-actions';

function buildProps() {
  return {
    description: 'This note will be saved.',
    existingNoteBody: '',
    handleConnectClick: () => {},
    handleNoteDraftGenerate: () => {},
    handleNoteSave: () => {},
    isAuthenticated: true,
    loginHref: '/api/qf/auth/login',
    noteState: {
      body: '',
      error: null,
      isGenerating: false,
      isSaving: false,
      open: false,
    },
    saveLabel: 'Save note',
    setNoteState: () => {},
    title: 'Save a note',
    triggerLabel: 'Save a note',
  };
}

describe('ReflectionResultActions', () => {
  it('renders the save action when no matching note exists', () => {
    const html = renderToStaticMarkup(<ReflectionResultActions {...buildProps()} />);

    expect(html).toContain('Save a note');
    expect(html).not.toContain('Edit note');
  });

  it('renders the edit action when a matching note already exists', () => {
    const html = renderToStaticMarkup(
      <ReflectionResultActions
        {...buildProps()}
        description="This note will be updated."
        existingNoteBody="Saved body"
        saveLabel="Save changes"
        title="Edit note"
        triggerLabel="Edit note"
      />,
    );

    expect(html).toContain('Edit note');
    expect(html).not.toContain('Save a note');
  });
});
