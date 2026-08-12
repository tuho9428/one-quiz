import type { FlashcardQuestion } from "../../domain/types";

export const sampleFlashcards: FlashcardQuestion[] = [
  {
    id: "recall-1",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Retrieval practice"],
    prompt: "What is retrieval practice?",
    answer:
      "Actively recalling information from memory instead of rereading it.",
    explanation:
      "The effort to retrieve an idea strengthens access to it later.",
  },
  {
    id: "recall-2",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Retrieval practice"],
    prompt: "What should you do before looking at an answer?",
    answer: "Make a genuine attempt to retrieve the answer from memory.",
    explanation:
      "Even an incomplete attempt creates useful retrieval practice.",
  },
  {
    id: "recall-3",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Spaced repetition"],
    prompt: "Why does spaced repetition improve long-term memory?",
    answer:
      "It brings information back for retrieval just as it starts to become difficult to remember.",
    explanation:
      "Reviews are distributed over time instead of being packed into one session.",
  },
  {
    id: "recall-4",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Weak areas"],
    prompt: "What does a difficult recall tell you?",
    answer: "It identifies a weak area that needs more targeted practice.",
    explanation:
      "Difficulty is useful feedback when it guides the next review.",
  },
  {
    id: "recall-5",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Feedback"],
    prompt: "What is the purpose of feedback after an attempt?",
    answer:
      "To show what was correct, correct mistakes, and refine the next attempt.",
    explanation:
      "Feedback is most useful after a real attempt, not before one.",
  },
  {
    id: "recall-6",
    studySetId: "active-recall-foundations",
    type: "flashcard",
    concepts: ["Interleaving"],
    prompt: "What is interleaving?",
    answer:
      "Practicing related topics in a mixed order instead of blocking one topic at a time.",
    explanation:
      "Mixed practice makes you retrieve the right method or concept for each problem.",
  },
];
