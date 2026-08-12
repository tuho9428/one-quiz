import type { WriteQuestion } from "../../domain/types";

export const sampleWriteQuestions: WriteQuestion[] = [
  {
    id: "write-1",
    studySetId: "active-recall-foundations",
    type: "write",
    concepts: ["Retrieval practice"],
    question: "In your own words, explain retrieval practice.",
    expectedAnswer:
      "Retrieval practice is actively recalling information from memory before checking the answer.",
    importantKeywords: ["actively recalling", "memory", "before checking"],
    explanation:
      "The learner must produce an answer before looking at the source or feedback.",
  },
  {
    id: "write-2",
    studySetId: "active-recall-foundations",
    type: "write",
    concepts: ["Spaced repetition"],
    question: "Why does spaced repetition help information last longer?",
    expectedAnswer:
      "It schedules repeated retrieval across increasing intervals as the information becomes more familiar.",
    importantKeywords: ["repeated retrieval", "increasing intervals"],
    explanation:
      "Spacing makes each successful retrieval effortful enough to strengthen long-term access.",
  },
  {
    id: "write-3",
    studySetId: "active-recall-foundations",
    type: "write",
    concepts: ["Feedback"],
    question: "What makes feedback useful after an answer attempt?",
    expectedAnswer:
      "Feedback confirms correct parts, corrects errors, and guides the next attempt.",
    importantKeywords: ["confirms", "corrects errors", "next attempt"],
    explanation:
      "Feedback should improve the next retrieval instead of replacing the attempt.",
  },
  {
    id: "write-4",
    studySetId: "active-recall-foundations",
    type: "write",
    concepts: ["Weak areas"],
    question: "How should a study session use an incorrect answer?",
    expectedAnswer:
      "It should treat the miss as a signal to review the concept and schedule another retrieval attempt.",
    importantKeywords: ["miss", "review", "another retrieval attempt"],
    explanation:
      "An incorrect answer is useful data for targeting future practice.",
  },
];
