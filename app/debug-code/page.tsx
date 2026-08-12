import { DebugCodeStudy } from "@/features/study/modes/debug-code/DebugCodeStudy";
import { sampleDebugCodeQuestions } from "@/features/study/modes/debug-code/sample-questions";

export default function DebugCodePage() {
  return <DebugCodeStudy questions={sampleDebugCodeQuestions} />;
}

