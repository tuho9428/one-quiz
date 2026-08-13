import { notFound } from "next/navigation";

import { EditStudySet } from "@/features/study/edit/EditStudySet";
import { getStudySetById } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function EditStudySetPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = await params;
  const studySet = await getStudySetById(setId);
  if (!studySet) notFound();
  return <EditStudySet studySet={studySet} />;
}
