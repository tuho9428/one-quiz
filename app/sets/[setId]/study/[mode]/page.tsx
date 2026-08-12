import { notFound } from "next/navigation";
import Link from "next/link";

import { DebugCodeStudy } from "@/features/study/modes/debug-code/DebugCodeStudy";
import { FlashcardStudy } from "@/features/study/modes/flashcards/FlashcardStudy";
import { MultipleChoiceStudy } from "@/features/study/modes/multiple-choice/MultipleChoiceStudy";
import { RapidRecallStudy } from "@/features/study/modes/rapid-recall/RapidRecallStudy";
import { SmartStudy } from "@/features/study/modes/smart-study/SmartStudy";
import { WriteStudy } from "@/features/study/modes/write/WriteStudy";
import { getStudySetById } from "@/lib/study/repository";

export const dynamic = "force-dynamic";

const supportedModes = ["flashcards", "multiple-choice", "write", "rapid-recall", "smart-study", "debug-code"] as const;
type SupportedMode = (typeof supportedModes)[number];

export default async function StudyModePage({ params }: { params: Promise<{ setId: string; mode: string }> }) {
  const { setId, mode } = await params;
  if (!supportedModes.includes(mode as SupportedMode)) notFound();

  const studySet = await getStudySetById(setId);
  if (!studySet) notFound();

  const flashcards = studySet.questions.filter((question) => question.type === "flashcard");
  const multipleChoice = studySet.questions.filter((question) => question.type === "multiple-choice");
  const writeQuestions = studySet.questions.filter((question) => question.type === "write");
  const debugQuestions = studySet.questions.filter((question) => question.type === "debug-code");

  const modeLabel = mode === "flashcards" ? "Flashcards" : mode === "multiple-choice" ? "Multiple Choice" : mode === "rapid-recall" ? "Rapid Recall" : mode === "smart-study" ? "Smart Study" : mode === "debug-code" ? "Debug / Code" : "Write";
  let studyContent;
  switch (mode as SupportedMode) {
    case "flashcards":
      studyContent = <FlashcardStudy cards={flashcards} title={studySet.title} />;
      break;
    case "multiple-choice":
      studyContent = <MultipleChoiceStudy questions={multipleChoice} title={studySet.title} />;
      break;
    case "write":
      studyContent = <WriteStudy questions={writeQuestions} title={studySet.title} />;
      break;
    case "rapid-recall":
      studyContent = <RapidRecallStudy questions={writeQuestions} title={studySet.title} />;
      break;
    case "smart-study":
      studyContent = <SmartStudy questions={studySet.questions} title={studySet.title} />;
      break;
    case "debug-code":
      studyContent = <DebugCodeStudy questions={debugQuestions} title={studySet.title} />;
      break;
  }

  return <div><div className="border-b border-[#d5e2df] bg-[#fbfdfc] px-4 py-3 text-sm text-[#55716a] dark:border-[#2d4440] dark:bg-[#182320] dark:text-[#a8bdb7]"><div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2"><Link href="/" className="font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">Dashboard</Link><span aria-hidden="true">/</span><Link href={`/sets/${setId}`} className="font-semibold text-[#0f766e] hover:underline dark:text-[#5eead4]">{studySet.title}</Link><span aria-hidden="true">/</span><span>{modeLabel}</span></div></div>{studyContent}</div>;
}
