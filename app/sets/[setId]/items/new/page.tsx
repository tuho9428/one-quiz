import { notFound } from "next/navigation";

import { ManualStudyItem } from "@/features/study/import/ManualStudyItem";
import { getStudySetById } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function NewStudyItemPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const studySet = await getStudySetById(setId);
  if (!studySet) notFound();
  return <ManualStudyItem studySetId={studySet.id} title={studySet.title} />;
}
