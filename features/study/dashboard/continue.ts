export interface ContinueStudyingCandidate {
  studySetId: string;
  studySetTitle: string;
  sessionId: string | null;
  mode: string | null;
  lastStudiedAt: string;
  completedItems: number;
  totalItems: number;
  incomplete: boolean;
  resumable: boolean;
}

/**
 * Selects the dashboard's single continuation target from persisted activity.
 * Incomplete sessions always win; otherwise the latest real activity wins.
 */
export function selectContinueStudying(
  candidates: readonly ContinueStudyingCandidate[],
): ContinueStudyingCandidate | null {
  const incomplete = candidates
    .filter((candidate) => candidate.incomplete)
    .sort(compareByRecentActivity);

  if (incomplete[0]) return incomplete[0];

  const recent = candidates
    .filter((candidate) => Boolean(candidate.lastStudiedAt))
    .sort(compareByRecentActivity);

  return recent[0] ?? null;
}

function compareByRecentActivity(
  left: ContinueStudyingCandidate,
  right: ContinueStudyingCandidate,
): number {
  const timeDifference = Date.parse(right.lastStudiedAt) - Date.parse(left.lastStudiedAt);
  if (timeDifference !== 0) return timeDifference;
  return left.studySetId.localeCompare(right.studySetId);
}
