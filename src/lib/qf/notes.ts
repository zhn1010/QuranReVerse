import type { QfNoteAttachedEntity, QfSavedNote } from '@/lib/qf/types';

export function normalizeQfNote(raw: unknown): QfSavedNote | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const id =
    typeof record.id === 'string'
      ? record.id
      : typeof record.id === 'number'
        ? String(record.id)
        : null;
  const body = typeof record.body === 'string' ? record.body : '';

  if (!id) {
    return null;
  }

  const attachedEntities = Array.isArray(record.attachedEntities)
    ? record.attachedEntities
        .map((entity) => {
          if (!entity || typeof entity !== 'object') {
            return null;
          }

          const entityRecord = entity as Record<string, unknown>;
          if (
            typeof entityRecord.entityId !== 'string' ||
            entityRecord.entityType !== 'reflection'
          ) {
            return null;
          }

          const normalizedEntity: QfNoteAttachedEntity = {
            entityId: entityRecord.entityId,
            entityMetadata:
              entityRecord.entityMetadata && typeof entityRecord.entityMetadata === 'object'
                ? (entityRecord.entityMetadata as Record<string, unknown>)
                : undefined,
            entityType: 'reflection',
          };

          return normalizedEntity;
        })
        .filter((entity): entity is QfNoteAttachedEntity => Boolean(entity))
    : [];

  const ranges = Array.isArray(record.ranges)
    ? record.ranges
        .map((range) => {
          if (typeof range === 'string') {
            return range;
          }

          if (range && typeof range === 'object') {
            const rangeRecord = range as Record<string, unknown>;
            if (typeof rangeRecord.range === 'string') {
              return rangeRecord.range;
            }
          }

          return null;
        })
        .filter((range): range is string => Boolean(range))
    : [];

  return {
    attachedEntities,
    body,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : null,
    id,
    ranges,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
}

export function normalizeQfNotesFromPayload(payload: { data?: unknown[] | { notes?: unknown[] } }) {
  const rawNotes = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.data?.notes)
      ? payload.data.notes
      : [];

  return rawNotes
    .map((note) => normalizeQfNote(note))
    .filter((note): note is QfSavedNote => Boolean(note))
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt ?? right.createdAt ?? '') -
        Date.parse(left.updatedAt ?? left.createdAt ?? ''),
    );
}
