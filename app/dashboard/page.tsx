import { StudyDashboard } from "@/features/study/dashboard/StudyDashboard";
import { loadDashboardStudySets } from "@/features/study/dashboard/summary";
import { getContinueStudyingForUser, getStudyProgress, getStudySets, getDueItems } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [studySets, continueStudying] = await Promise.all([getStudySets(), getContinueStudyingForUser()]);
  const summaries = await loadDashboardStudySets(studySets, getStudyProgress, getDueItems);
  return <StudyDashboard studySets={summaries} continueStudying={continueStudying} />;
}
