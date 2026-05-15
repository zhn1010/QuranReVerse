import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReflectionResultActions } from '@/components/chat-result-view/reflection-result-actions';

function buildProps() {
  return {
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
    setNoteState: () => {},
  };
}

describe('ReflectionResultActions', () => {
  it('renders the save action when no matching note exists', () => {
    const html = renderToStaticMarkup(
      <ReflectionResultActions existingNote={null} {...buildProps()} />,
    );

    expect(html).toContain('Save a note');
    expect(html).not.toContain('Edit note');
  });

  it('renders the edit action when a matching note already exists', () => {
    const html = renderToStaticMarkup(
      <ReflectionResultActions
        existingNote={{
          attachedEntities: [
            {
              entityId: '9',
              entityType: 'reflection',
            },
          ],
          body: 'Saved body',
          createdAt: null,
          id: 'note-1',
          ranges: ['2:255-2:255'],
          updatedAt: null,
        }}
        {...buildProps()}
      />,
    );

    expect(html).toContain('Edit note');
    expect(html).not.toContain('Save a note');
  });
});
