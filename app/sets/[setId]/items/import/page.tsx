import { notFound } from "next/navigation";

import { JsonStudySetImport } from "@/features/study/import/JsonStudySetImport";
import { getStudySetById } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function ImportStudyItemsPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const studySet = await getStudySetById(setId);
  if (!studySet) notFound();
  return <JsonStudySetImport studySetId={studySet.id} title={studySet.title} />;
}
