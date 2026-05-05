export type AyahSelection = {
  from: number;
  to: number;
};

export type AyahReference = {
  chapterId: number;
  from: number;
  id?: string;
  to: number;
};

type SelectedReflectionLike = {
  ayah_no: string;
  reflection: {
    references: AyahReference[];
  } | null;
  surah_no: number;
};

function buildFallbackAyahReference(
  selectedReflection: SelectedReflectionLike,
): AyahReference | null {
  const selection = parseAyahSelection(selectedReflection.ayah_no);

  if (!selection) {
    return null;
  }

  return {
    chapterId: selectedReflection.surah_no,
    from: selection.from,
    id: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
    to: selection.to,
  };
}

export function parseAyahSelection(ayahNo: string): AyahSelection | null {
  const match = /^(\d+)(?:-(\d+))?$/u.exec(ayahNo.trim());

  if (!match) {
    return null;
  }

  const from = Number.parseInt(match[1], 10);
  const to = match[2] ? Number.parseInt(match[2], 10) : from;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    return null;
  }

  return { from, to };
}

export function buildAyahReferenceLabel(reference: AyahReference) {
  if (reference.from < 1 || reference.to < 1) {
    return null;
  }

  return reference.from === reference.to
    ? `${reference.chapterId}:${reference.from}`
    : `${reference.chapterId}:${reference.from}-${reference.to}`;
}

export function getSelectedReflectionEmbeds(selectedReflection: SelectedReflectionLike) {
  const explicitReferences =
    selectedReflection.reflection?.references
      .map((reference) => ({
        label: buildAyahReferenceLabel(reference),
        reference,
      }))
      .filter((item): item is { label: string; reference: AyahReference } => Boolean(item.label))
      .filter(
        (item, index, items) =>
          items.findIndex((candidate) => candidate.label === item.label) === index,
      ) ?? [];

  if (explicitReferences.length > 0) {
    return explicitReferences;
  }

  const fallbackReference = buildFallbackAyahReference(selectedReflection);

  if (!fallbackReference) {
    return [];
  }

  return [
    {
      label: `${selectedReflection.surah_no}:${selectedReflection.ayah_no}`,
      reference: fallbackReference,
    },
  ];
}

export function buildNoteRangesFromSelectedReflection(
  selectedReflection: SelectedReflectionLike | null,
) {
  if (!selectedReflection) {
    return [];
  }

  return getSelectedReflectionEmbeds(selectedReflection)
    .map(
      ({ reference }) =>
        `${reference.chapterId}:${reference.from}-${reference.chapterId}:${reference.to}`,
    )
    .filter((range, index, items) => items.indexOf(range) === index);
}
