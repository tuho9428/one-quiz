import { WriteStudy } from "@/features/study/modes/write/WriteStudy";
import { sampleWriteQuestions } from "@/features/study/modes/write/sample-questions";

export default function WritePage() {
  return <WriteStudy questions={sampleWriteQuestions} />;
}
