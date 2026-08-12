export interface DashboardStudySet {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  mastery?: number;
  dueCount?: number;
  lastStudiedAt?: string;
}

export interface DashboardSourceSet {
  id: string;
  title: string;
  description?: string | null;
  questions: readonly unknown[];
}

export interface DashboardProgressSummary {
  mastery: number;
  lastReviewedAt: string | null;
}

export async function loadDashboardStudySets(
  studySets: readonly DashboardSourceSet[],
  getProgress: (studySetId: string) => Promise<readonly DashboardProgressSummary[]>,
  getDueItems: (studySetId: string) => Promise<readonly unknown[]>,
): Promise<DashboardStudySet[]> {
  return Promise.all(studySets.map(async (studySet) => {
    const progress = await getProgress(studySet.id);
    const base = {
      id: studySet.id,
      title: studySet.title,
      description: studySet.description ?? "",
      itemCount: studySet.questions.length,
    };

    if (progress.length === 0) return base;

    const dueItems = await getDueItems(studySet.id);
    const mastery = studySet.questions.length === 0
      ? 0
      : Math.round(progress.reduce((total, item) => total + item.mastery, 0) / studySet.questions.length);
    const lastStudiedAt = progress
      .map((item) => item.lastReviewedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);

    return { ...base, mastery, dueCount: dueItems.length, lastStudiedAt };
  }));
}
