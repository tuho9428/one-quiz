import { SmartStudy } from "@/features/study/modes/smart-study/SmartStudy";
import { sampleSmartStudyQuestions } from "@/features/study/modes/smart-study/sample-questions";

export default function SmartStudyPage() {
  return <SmartStudy questions={sampleSmartStudyQuestions} />;
}

