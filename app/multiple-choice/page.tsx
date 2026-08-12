import { MultipleChoiceStudy } from "@/features/study/modes/multiple-choice/MultipleChoiceStudy";
import { sampleMultipleChoiceQuestions } from "@/features/study/modes/multiple-choice/sample-questions";

export default function MultipleChoicePage() {
  return <MultipleChoiceStudy questions={sampleMultipleChoiceQuestions} />;
}
