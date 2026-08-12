import type { MultipleChoiceQuestion } from "../../domain/types";

export const sampleMultipleChoiceQuestions: MultipleChoiceQuestion[] = [
  {
    id: "mc-1",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Retrieval practice"],
    question: "Which activity is the clearest example of retrieval practice?",
    correctAnswer: "Answering a question from memory",
    distractors: [
      "Rereading the chapter",
      "Highlighting every definition",
      "Copying the notes word for word",
    ],
    explanation:
      "Retrieval practice asks you to produce an answer before checking the source.",
  },
  {
    id: "mc-2",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Spaced repetition"],
    question: "What is the main purpose of spacing study sessions?",
    correctAnswer: "To practice recall across increasing intervals",
    distractors: [
      "To avoid testing yourself",
      "To finish one long study block faster",
      "To replace feedback with repetition",
    ],
    explanation:
      "Spacing brings material back after some forgetting has begun, which makes retrieval more effortful and useful.",
  },
  {
    id: "mc-3",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Feedback"],
    question: "When is feedback most useful during active recall?",
    correctAnswer: "After you make a genuine attempt",
    distractors: [
      "Before you read the question",
      "Only after you finish the entire course",
      "Instead of making an attempt",
    ],
    explanation:
      "Feedback corrects the memory after retrieval has done its work.",
  },
  {
    id: "mc-4",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Weak areas"],
    question: "What should happen after you miss a question?",
    correctAnswer: "Review the mistake and schedule another attempt",
    distractors: [
      "Skip the concept permanently",
      "Read the answer once and move on forever",
      "Lower the difficulty of every question",
    ],
    explanation:
      "A miss is useful when it identifies a concept for focused follow-up practice.",
  },
  {
    id: "mc-5",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Interleaving"],
    question: "What does interleaving change about practice?",
    correctAnswer: "It mixes related topics so you must choose what applies",
    distractors: [
      "It removes all repetition",
      "It shows the answer before each question",
      "It limits practice to one easy topic",
    ],
    explanation:
      "Interleaving adds a useful identification step before you apply knowledge.",
  },
  {
    id: "mc-6",
    studySetId: "active-recall-foundations",
    type: "multiple-choice",
    concepts: ["Mastery"],
    question: "Which signal best suggests a concept is becoming durable?",
    correctAnswer: "Correct recall after a longer delay",
    distractors: [
      "Recognizing the answer while rereading",
      "Remembering it only immediately after studying",
      "Feeling familiar with the page layout",
    ],
    explanation:
      "Delayed successful retrieval is stronger evidence than familiarity during review.",
  },
];
