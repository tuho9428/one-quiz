import { RapidRecallStudy } from "@/features/study/modes/rapid-recall/RapidRecallStudy";
import { sampleRapidRecallQuestions } from "@/features/study/modes/rapid-recall/sample-questions";

export default function RapidRecallPage() {
  return <RapidRecallStudy questions={sampleRapidRecallQuestions} />;
}
