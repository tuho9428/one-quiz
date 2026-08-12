import type { WriteQuestion } from "../../domain/types";

export const RAPID_RECALL_DURATIONS = [30, 60, 120, 300] as const;
export type RapidRecallDuration = (typeof RAPID_RECALL_DURATIONS)[number];

export function shuffleRapidRecallQuestions(
  questions: WriteQuestion[],
  random: () => number = Math.random,
): WriteQuestion[] {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function formatRapidRecallDuration(seconds: RapidRecallDuration): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds === 60) return "60 seconds";
  if (seconds === 120) return "2 minutes";
  return "5 minutes";
}
