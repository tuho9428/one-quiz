import { StudyDashboard } from "@/features/study/dashboard/StudyDashboard";
import { loadDashboardStudySets } from "@/features/study/dashboard/summary";
import { getStudyProgress, getStudySets, getDueItems } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const studySets = await getStudySets();
  const summaries = await loadDashboardStudySets(studySets, getStudyProgress, getDueItems);
  return <StudyDashboard studySets={summaries} />;
}
