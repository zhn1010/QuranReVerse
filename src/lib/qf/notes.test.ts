import { describe, expect, it } from 'vitest';
import { normalizeQfNote, normalizeQfNotesFromPayload } from '@/lib/qf/notes';

describe('normalizeQfNote', () => {
  it('normalizes reflection entities, ranges, and numeric ids', () => {
    expect(
      normalizeQfNote({
        attachedEntities: [
          {
            entityId: '42',
            entityMetadata: { source: 'quranreflect' },
            entityType: 'reflection',
          },
          {
            entityId: 'ignored',
            entityType: 'other',
          },
        ],
        body: 'A note body',
        createdAt: '2026-05-01T00:00:00.000Z',
        id: 7,
        ranges: ['2:255-2:255', { range: '36:1-36:3' }],
        updatedAt: '2026-05-05T00:00:00.000Z',
      }),
    ).toEqual({
      attachedEntities: [
        {
          entityId: '42',
          entityMetadata: { source: 'quranreflect' },
          entityType: 'reflection',
        },
      ],
      body: 'A note body',
      createdAt: '2026-05-01T00:00:00.000Z',
      id: '7',
      ranges: ['2:255-2:255', '36:1-36:3'],
      updatedAt: '2026-05-05T00:00:00.000Z',
    });
  });

  it('rejects invalid notes', () => {
    expect(normalizeQfNote(null)).toBeNull();
    expect(normalizeQfNote({ body: 'missing id' })).toBeNull();
  });
});

describe('normalizeQfNotesFromPayload', () => {
  it('supports both array and nested notes payload shapes and sorts by update time', () => {
    expect(
      normalizeQfNotesFromPayload({
        data: {
          notes: [
            {
              body: 'Older note',
              createdAt: '2026-05-01T00:00:00.000Z',
              id: '1',
              updatedAt: '2026-05-01T00:00:00.000Z',
            },
            {
              body: 'Newer note',
              createdAt: '2026-05-02T00:00:00.000Z',
              id: '2',
              updatedAt: '2026-05-05T00:00:00.000Z',
            },
          ],
        },
      }).map((note) => note.id),
    ).toEqual(['2', '1']);
  });
});
