import type {
  MultipleChoiceQuestion,
} from "../../domain/types";

export interface MultipleChoiceOption {
  id: string;
  text: string;
}

export interface MultipleChoiceSessionQuestion {
  question: MultipleChoiceQuestion;
  options: MultipleChoiceOption[];
}

type RandomSource = () => number;

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function prepareMultipleChoiceSession(
  questions: MultipleChoiceQuestion[],
  random: RandomSource = Math.random,
): MultipleChoiceSessionQuestion[] {
  return shuffle(questions, random).map((question) => {
    const answerTexts = [question.correctAnswer, ...question.distractors];

    if (answerTexts.length !== 4) {
      throw new Error(
        `Multiple choice question ${question.id} must have exactly 4 answers`,
      );
    }

    return {
      question,
      options: shuffle(
        answerTexts.map((text, index) => ({
          id: `${question.id}-option-${index}`,
          text,
        })),
        random,
      ),
    };
  });
}
