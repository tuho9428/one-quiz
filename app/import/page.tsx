import { ImportStudyMaterial } from "@/features/study/import/ImportStudyMaterial";
import { getStudySets } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ setId?: string; format?: string }> }) {
  const [studySets, params] = await Promise.all([getStudySets(), searchParams]);
  return <ImportStudyMaterial studySets={studySets.map((studySet) => ({ id: studySet.id, title: studySet.title }))} initialStudySetId={params.setId} initialFormat={params.format === "text" || params.format === "markdown" || params.format === "json" ? params.format : undefined} />;
}
