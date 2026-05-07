import { getLanguageCodeFromReflectionLanguageName } from '@/lib/server/antidotes/language';
import type {
  CuratedReflectionCandidate,
  CuratedReflectionResponse,
  EnrichedAntidote,
  SelectedReflection,
} from '@/lib/shared/antidotes/types';

export function buildReflectionCandidates(antidotes: EnrichedAntidote[]) {
  return antidotes.flatMap((antidote) =>
    antidote.related_reflections.map(
      (reflection): CuratedReflectionCandidate => ({
        ...reflection,
        ayah_no: antidote.ayah_no,
        surah_name: antidote.surah_name,
        surah_no: antidote.surah_no,
      }),
    ),
  );
}

export function serializeReflectionCandidates(candidates: CuratedReflectionCandidate[]) {
  return candidates
    .map(
      (candidate) =>
        `[ID: ${candidate.id}] [Ayah: ${candidate.surah_no}:${candidate.ayah_no}] "${candidate.body}"`,
    )
    .join('\n\n');
}

export function createSelectedReflection(
  selection: CuratedReflectionResponse,
  candidates: CuratedReflectionCandidate[],
): SelectedReflection {
  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selection.selected_reflection_id) ?? null;

  return {
    ayah_no: selectedCandidate?.ayah_no ?? '',
    reflection_is_translated: false,
    reflection_original_body: selectedCandidate?.body ?? null,
    reflection_source_language_code: getLanguageCodeFromReflectionLanguageName(
      selectedCandidate?.languageName ?? null,
    ),
    reflection: selectedCandidate
      ? {
          authorName: selectedCandidate.authorName,
          body: selectedCandidate.body,
          commentsCount: selectedCandidate.commentsCount,
          createdAt: selectedCandidate.createdAt,
          id: selectedCandidate.id,
          languageName: selectedCandidate.languageName,
          likesCount: selectedCandidate.likesCount,
          postTypeName: selectedCandidate.postTypeName,
          references: selectedCandidate.references,
        }
      : null,
    selected_reflection_id: selection.selected_reflection_id,
    selection_reason: selection.selection_reason,
    surah_name: selectedCandidate?.surah_name ?? '',
    surah_no: selectedCandidate?.surah_no ?? 0,
  };
}
