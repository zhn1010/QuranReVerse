import type { QfProfile, QfSessionSummary } from '@/lib/shared/qf/types';

type ProfileCandidate = {
  label: string;
  record: Record<string, unknown>;
};

export type QfProfileSummaryResolution = {
  diagnostics: {
    avatarFromRecordLabel: string | null;
    avatarSource: string | null;
    payloadDataKeys: string[] | null;
    payloadKeys: string[];
    selectedProfileKeys: string[];
  };
  summary: QfSessionSummary;
};

export function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function readAvatarFromProfile(profileRecord: Record<string, unknown>) {
  const profile = profileRecord as QfProfile;
  const avatarUrlsRecord = getRecord(profile.avatarUrls);
  const medium = typeof avatarUrlsRecord?.medium === 'string' ? avatarUrlsRecord.medium : null;
  const small = typeof avatarUrlsRecord?.small === 'string' ? avatarUrlsRecord.small : null;
  const large = typeof avatarUrlsRecord?.large === 'string' ? avatarUrlsRecord.large : null;
  const directAvatar = typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null;
  const snakeCaseAvatar =
    typeof profileRecord.avatar_url === 'string' ? (profileRecord.avatar_url as string) : null;

  const avatarUrl = medium ?? small ?? large ?? directAvatar ?? snakeCaseAvatar;
  const avatarSource = medium
    ? 'avatarUrls.medium'
    : small
      ? 'avatarUrls.small'
      : large
        ? 'avatarUrls.large'
        : directAvatar
          ? 'avatarUrl'
          : snakeCaseAvatar
            ? 'avatar_url'
            : null;

  return {
    avatarSource,
    avatarUrl: avatarUrl ?? null,
    avatarUrlsKeys: avatarUrlsRecord ? Object.keys(avatarUrlsRecord) : [],
  };
}

function getProfileCandidateRecords(payload: Record<string, unknown>) {
  const payloadDataRecord = getRecord(payload.data);
  const profileCandidateRecords: ProfileCandidate[] = [];

  if (payloadDataRecord) {
    profileCandidateRecords.push({ label: 'payload.data', record: payloadDataRecord });
  }

  profileCandidateRecords.push({ label: 'payload', record: payload });

  const nestedKeys = ['profile', 'user', 'account'] as const;

  for (const key of nestedKeys) {
    const nestedRecord = getRecord(payloadDataRecord?.[key]);

    if (nestedRecord) {
      profileCandidateRecords.push({ label: `payload.data.${key}`, record: nestedRecord });
    }
  }

  return {
    payloadDataRecord,
    profileCandidateRecords,
  };
}

export function deriveQfSessionSummaryFromProfilePayload(
  payload: Record<string, unknown>,
  collectionName: string,
): QfProfileSummaryResolution {
  const { payloadDataRecord, profileCandidateRecords } = getProfileCandidateRecords(payload);

  let avatarUrl: string | null = null;
  let avatarSource: string | null = null;
  let avatarFromRecordLabel: string | null = null;
  let selectedProfileRecord: Record<string, unknown> = payloadDataRecord ?? payload;

  for (const candidate of profileCandidateRecords) {
    const avatar = readAvatarFromProfile(candidate.record);

    if (avatar.avatarUrl) {
      avatarUrl = avatar.avatarUrl;
      avatarSource = avatar.avatarSource;
      avatarFromRecordLabel = candidate.label;
      selectedProfileRecord = candidate.record;
      break;
    }
  }

  const selectedProfile = selectedProfileRecord as QfProfile;
  const displayName = [selectedProfile.firstName, selectedProfile.lastName]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return {
    diagnostics: {
      avatarFromRecordLabel,
      avatarSource,
      payloadDataKeys: payloadDataRecord ? Object.keys(payloadDataRecord) : null,
      payloadKeys: Object.keys(payload),
      selectedProfileKeys: Object.keys(selectedProfileRecord),
    },
    summary: {
      avatarUrl,
      collectionName,
      displayName: displayName || selectedProfile.username || null,
      isAuthenticated: true,
    },
  };
}
