import type { ApiResponse } from '@/lib/shared/antidotes/api-types';
import { buildNoteRangesFromSelectedReflection } from '@/lib/shared/quran/ayah';
import { APP_CANONICAL_ORIGIN } from '@/lib/shared/constants/app';
import { readTextStream } from '@/lib/shared/stream/stream-utils';

type SelectedReflectionLike = ApiResponse['selected_reflection'];

type BookmarkEmbed = {
  label: string;
  reference: {
    chapterId: number;
  };
};

type ToggleBookmarkResponse = {
  collectionName?: string;
  removedCount?: number;
  savedCount?: number;
};

export function buildQfLoginHref(nextPath: string) {
  return `${APP_CANONICAL_ORIGIN}/api/qf/auth/login?next=${encodeURIComponent(nextPath)}`;
}

export function buildQfNoteDraftPayload({
  eventContent,
  result,
  userFeeling,
}: {
  eventContent: string;
  result: Pick<
    ApiResponse,
    'diagnosis' | 'reflection_guide' | 'selected_reflection'
  >;
  userFeeling: string;
}) {
  return {
    diagnosis: result.diagnosis,
    eventContent,
    reflectionBody: result.selected_reflection?.reflection?.body ?? null,
    reflectionGuide: result.reflection_guide,
    selectedReflection: result.selected_reflection
      ? {
          authorName: result.selected_reflection.reflection?.authorName ?? null,
          ayahNo: result.selected_reflection.ayah_no,
          selectionReason: result.selected_reflection.selection_reason,
          surahName: result.selected_reflection.surah_name,
          surahNo: result.selected_reflection.surah_no,
        }
      : null,
    userFeeling,
  };
}

export async function fetchQfBookmarkStates(
  embeds: BookmarkEmbed[],
  fetchImpl: typeof fetch = fetch,
) {
  const updates: Record<string, boolean> = {};

  await Promise.all(
    embeds.map(async (embed) => {
      const ayahNo = embed.label.split(':')[1] ?? '';
      const response = await fetchImpl(
        `/api/qf/bookmark?surahNo=${encodeURIComponent(embed.reference.chapterId)}&ayahNo=${encodeURIComponent(ayahNo)}`,
        {
          credentials: 'include',
        },
      );
      const payload = (await response.json()) as {
        bookmarkIdsByVerseNumber?: Record<number, string>;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not load bookmark state.');
      }

      updates[embed.label] =
        Boolean(payload.bookmarkIdsByVerseNumber) &&
        Object.keys(payload.bookmarkIdsByVerseNumber ?? {}).length > 0;
    }),
  );

  return updates;
}

export async function toggleQfBookmark(
  {
    ayahNo,
    isBookmarked,
    surahNo,
  }: {
    ayahNo: string;
    isBookmarked: boolean;
    surahNo: number;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl('/api/qf/bookmark', {
    body: JSON.stringify({
      ayahNo,
      surahNo,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: isBookmarked ? 'DELETE' : 'POST',
  });
  const payload = (await response.json()) as ToggleBookmarkResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Could not update the ayah bookmark.');
  }

  return payload;
}

export async function streamQfNoteDraft(
  payload: ReturnType<typeof buildQfNoteDraftPayload>,
  {
    fetchImpl = fetch,
    onChunk,
  }: {
    fetchImpl?: typeof fetch;
    onChunk?: (text: string) => void;
  } = {},
) {
  const response = await fetchImpl('/api/qf/note/draft', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok || !response.body) {
    const errorPayload = (await response.json().catch(() => ({ error: 'Could not generate draft.' }))) as {
      error?: string;
    };
    throw new Error(errorPayload.error || 'Could not generate draft.');
  }

  return readTextStream(response.body, {
    onChunk: (_chunk, aggregatedText) => {
      onChunk?.(aggregatedText);
    },
  });
}

export async function saveQfNote(
  {
    body,
    selectedReflection,
  }: {
    body: string;
    selectedReflection: SelectedReflectionLike;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const attachedEntities = selectedReflection?.reflection
    ? [
        {
          entityId: String(selectedReflection.reflection.id),
          entityType: 'reflection' as const,
        },
      ]
    : [];

  const response = await fetchImpl('/api/qf/note', {
    body: JSON.stringify({
      attachedEntities,
      body,
      ranges: buildNoteRangesFromSelectedReflection(selectedReflection),
    }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Could not save the note.');
  }
}

export async function updateQfNote(
  {
    body,
    id,
  }: {
    body: string;
    id: string;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl('/api/qf/note', {
    body: JSON.stringify({
      body,
      id,
    }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Could not update the note.');
  }
}

export async function deleteQfNote(
  {
    id,
  }: {
    id: string;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl('/api/qf/note', {
    body: JSON.stringify({
      id,
    }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
  });
  const payload = (await response.json()) as { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Could not delete the note.');
  }
}
