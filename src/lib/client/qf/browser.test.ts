import { describe, expect, it, vi } from 'vitest';
import {
  buildQfLoginHref,
  buildQfNoteDraftPayload,
  deleteQfNote,
  fetchQfBookmarkStates,
  saveQfNote,
  streamQfNoteDraft,
  toggleQfBookmark,
  updateQfNote,
} from '@/lib/client/qf/browser';
import type { ApiResponse } from '@/lib/shared/antidotes/api-types';

function createJsonResponse(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function createTextResponse(chunks: string[], init?: ResponseInit) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
    },
    status: 200,
    ...init,
  });
}

const sampleResult: Pick<ApiResponse, 'diagnosis' | 'reflection_guide' | 'selected_reflection'> = {
  diagnosis: {
    god_centric_reframe: 'Allah is enough.',
    materialistic_narrative: 'I need control.',
    spiritual_drift: 'Fear',
  },
  reflection_guide: {
    conclusion_text: 'Steady.',
    intro_text: 'Breathe.',
  },
  selected_reflection: {
    ayah_no: '255',
    reflection: {
      authorName: 'Amina',
      body: 'A grounded reflection.',
      commentsCount: 2,
      createdAt: '2025-01-01T00:00:00.000Z',
      id: 9,
      languageName: 'English',
      likesCount: 5,
      postTypeName: 'reflection',
      references: [{ chapterId: 2, from: 255, id: '2:255', to: 255 }],
    },
    reflection_is_translated: false,
    reflection_original_body: 'A grounded reflection.',
    reflection_source_language_code: 'en',
    selected_reflection_id: 9,
    selection_reason: 'Best fit.',
    surah_name: 'Al-Baqarah',
    surah_no: 2,
  },
};

describe('buildQfLoginHref', () => {
  it('creates a canonical login redirect url', () => {
    expect(buildQfLoginHref('/chat/abc?scrollTo=25')).toContain(
      '/api/qf/auth/login?next=%2Fchat%2Fabc%3FscrollTo%3D25',
    );
  });
});

describe('buildQfNoteDraftPayload', () => {
  it('maps the selected reflection into the note-draft request shape', () => {
    expect(
      buildQfNoteDraftPayload({
        eventContent: 'event',
        result: sampleResult,
        userFeeling: 'feeling',
      }),
    ).toMatchObject({
      diagnosis: sampleResult.diagnosis,
      reflectionBody: 'A grounded reflection.',
      selectedReflection: {
        authorName: 'Amina',
        ayahNo: '255',
        selectionReason: 'Best fit.',
        surahName: 'Al-Baqarah',
        surahNo: 2,
      },
    });
  });
});

describe('fetchQfBookmarkStates', () => {
  it('hydrates bookmark booleans from bookmark id payloads', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          bookmarkIdsByVerseNumber: {
            255: 'bookmark-1',
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          bookmarkIdsByVerseNumber: {},
        }),
      );

    await expect(
      fetchQfBookmarkStates(
        [
          { label: '2:255', reference: { chapterId: 2 } },
          { label: '3:7', reference: { chapterId: 3 } },
        ],
        fetchImpl,
      ),
    ).resolves.toEqual({
      '2:255': true,
      '3:7': false,
    });
  });
});

describe('toggleQfBookmark', () => {
  it('uses POST for new bookmarks and returns the server payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      createJsonResponse({
        collectionName: 'Sakinah.now',
        savedCount: 1,
      }),
    );

    await expect(
      toggleQfBookmark(
        {
          ayahNo: '255',
          isBookmarked: false,
          surahNo: 2,
        },
        fetchImpl,
      ),
    ).resolves.toEqual({
      collectionName: 'Sakinah.now',
      savedCount: 1,
    });

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
    });
  });
});

describe('streamQfNoteDraft', () => {
  it('returns the aggregated streamed draft and reports incremental updates', async () => {
    const chunks: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async () => createTextResponse(['Draft ', 'note']));

    await expect(
      streamQfNoteDraft(
        buildQfNoteDraftPayload({
          eventContent: 'event',
          result: sampleResult,
          userFeeling: 'feeling',
        }),
        {
          fetchImpl,
          onChunk: (text) => {
            chunks.push(text);
          },
        },
      ),
    ).resolves.toBe('Draft note');

    expect(chunks).toEqual(['Draft ', 'Draft note']);
  });
});

describe('saveQfNote', () => {
  it('sends the canonical note payload with attached reflection entities and ranges', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => createJsonResponse({ success: true }));

    await saveQfNote(
      {
        body: 'A saved note.',
        selectedReflection: sampleResult.selected_reflection,
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      attachedEntities: [
        {
          entityId: '9',
          entityType: 'reflection',
        },
      ],
      body: 'A saved note.',
      ranges: ['2:255-2:255'],
    });
  });
});

describe('updateQfNote', () => {
  it('patches an existing note with the canonical payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => createJsonResponse({ success: true }));

    await updateQfNote(
      {
        body: 'Updated note.',
        id: 'note-1',
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/qf/note',
      expect.objectContaining({
        method: 'PATCH',
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      body: 'Updated note.',
      id: 'note-1',
    });
  });
});

describe('deleteQfNote', () => {
  it('deletes an existing note through the canonical endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => createJsonResponse({ success: true }));

    await deleteQfNote(
      {
        id: 'note-9',
      },
      fetchImpl,
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/qf/note',
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      id: 'note-9',
    });
  });
});
