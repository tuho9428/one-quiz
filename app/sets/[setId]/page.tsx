import { notFound } from "next/navigation";

import { StudySetOverview } from "@/features/study/sets/StudySetOverview";
import { getStudySetById } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

export default async function StudySetPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;

  const studySet = await getStudySetById(setId);
  if (!studySet) notFound();

  return (
    <StudySetOverview
      setId={studySet.id}
      title={studySet.title}
      description={studySet.description ?? ""}
      questions={studySet.questions}
    />
  );
}
