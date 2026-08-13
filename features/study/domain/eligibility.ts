import type {
  DebugCodeQuestion,
  FlashcardQuestion,
  MultipleChoiceQuestion,
  StudyQuestion,
  StudyMode,
  WriteQuestion,
} from "./types";

export type StudyPresentationMode = StudyMode | "smart-study" | "weak-areas" | "exam";

type RandomSource = () => number;

interface DistractorCandidate {
  text: string;
  tagOverlap: number;
  score: number;
}

export type MultipleChoiceRejectionReason =
  | "missing question or answer"
  | "code task without explicit choices"
  | "code task without code context"
  | "explicit choices invalid"
  | "insufficient total candidates"
  | "duplicate/near-duplicate candidates removed"
  | "not enough same-topic candidates"
  | "candidate answers unrelated"
  | "answer shape mismatch"
  | "answer length mismatch"
  | "candidate answers too dissimilar";

export interface MultipleChoiceEligibilityDiagnostic {
  questionId: string;
  question: string;
  type: StudyQuestion["type"];
  isDebugCode: boolean;
  hasExplicitChoices: boolean;
  explicitChoicesValid: boolean;
  eligible: boolean;
  source: "explicit" | "generated" | null;
  generatedOptions: string[];
  rejectionReason?: MultipleChoiceRejectionReason;
  candidateCount: number;
  suitableCandidateCount: number;
  duplicateCandidatesRemoved: number;
  sameTopicCandidateCount: number;
}

export interface MultipleChoiceDiagnosticsReport {
  totalItems: number;
  normalItems: number;
  debugCodeItems: number;
  eligibleNormalItems: number;
  eligibleDebugCodeWithExplicitChoices: number;
  itemsWithExplicitChoices: number;
  itemsEligibleUsingGeneratedDistractors: number;
  itemsRejectedForInsufficientDistractors: number;
  eligibleItems: number;
  rejectedItems: MultipleChoiceEligibilityDiagnostic[];
  highQualityGeneratedExamples: MultipleChoiceEligibilityDiagnostic[];
  debugCode: {
    totalItems: number;
    eligibleItems: number;
    rejectedItems: MultipleChoiceEligibilityDiagnostic[];
    examples: MultipleChoiceEligibilityDiagnostic[];
  };
}

export function hasQuestionAndAnswer(question: StudyQuestion): boolean {
  return getQuestionText(question).trim().length > 0 && getAnswerText(question).trim().length > 0;
}

/** Legacy type/task values describe source content, not mode restrictions. */
export function isClearlyCodeExercise(question: StudyQuestion): boolean {
  return question.type === "debug-code" || Boolean(question.task);
}

/** Questions that refer to code context must not be shown without that context. */
export function requiresCodeContext(question: StudyQuestion): boolean {
  if (hasCodeCapability(question)) return true;

  return /\b(this effect|this key|this code|this component|this interval|this closure|what happens here|what is wrong|why does this return|fix (?:this|the)|predict[^\n]*output|code snippet|bug)\b/i.test(
    getQuestionText(question),
  );
}

function hasRequiredCodeContext(question: StudyQuestion): boolean {
  return !requiresCodeContext(question) || Boolean(question.codeSnippet?.trim());
}

function explicitChoiceTexts(question: StudyQuestion): string[] {
  if (question.type === "multiple-choice") {
    return [question.correctAnswer, ...question.distractors];
  }

  return question.choices ?? [];
}

function normalizeForComparison(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areNearIdentical(left: string, right: string): boolean {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftTokens = new Set(normalizedLeft.split(" "));
  const rightTokens = new Set(normalizedRight.split(" "));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const similarity = union > 0 ? intersection / union : 0;
  return similarity >= 0.8 || (
    Math.min(normalizedLeft.length, normalizedRight.length) >= 8 &&
    (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft))
  );
}

function answerShape(answer: string): "code" | "number" | "list" | "short" | "sentence" {
  const normalized = answer.trim();
  if (/```|[{};]|=>/.test(normalized)) return "code";
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) return "number";
  if (/[,;\n]|(?:^|\n)\s*[-*]\s/.test(normalized)) return "list";
  if (normalized.split(/\s+/).filter(Boolean).length <= 5) return "short";
  return "sentence";
}

function tagOverlapFor(left: StudyQuestion, right: StudyQuestion): number {
  const leftTags = new Set((left.concepts ?? []).map(normalizeForComparison).filter(Boolean));
  return (right.concepts ?? []).map(normalizeForComparison).filter(Boolean)
    .filter((tag) => leftTags.has(tag)).length;
}

function candidateScore(item: StudyQuestion, candidate: StudyQuestion): DistractorCandidate {
  const text = getAnswerText(candidate).trim();
  const tagOverlap = tagOverlapFor(item, candidate);
  const sameShape = answerShape(getAnswerText(item)) === answerShape(text);
  const lengthSimilarity = 1 - Math.min(1, Math.abs(getAnswerText(item).length - text.length) / Math.max(getAnswerText(item).length, text.length, 1));
  const codeConceptMatch = hasCodeCapability(item) && hasCodeCapability(candidate) ? 35 : 0;

  return {
    text,
    tagOverlap,
    score: tagOverlap * 100 + codeConceptMatch + (sameShape ? 30 : 0) + Math.round(lengthSimilarity * 20),
  };
}

function getDistractorAnalysis(item: StudyQuestion, allItems: StudyQuestion[]) {
  const correctAnswer = getAnswerText(item).trim();
  const questionText = getQuestionText(item).trim();
  const rawCandidates = allItems
    .filter((candidate) => candidate.id !== item.id)
    .filter((candidate) => candidate.studySetId === item.studySetId)
    .filter((candidate) => normalizeForComparison(getQuestionText(candidate)) !== normalizeForComparison(questionText))
    .filter((candidate) => getAnswerText(candidate).trim().length > 0)
    .map((candidate) => candidateScore(item, candidate));
  const deduplicatedCandidates = rawCandidates
    .filter((candidate, index, values) => values.findIndex((value) => areNearIdentical(value.text, candidate.text)) === index);
  const candidates = deduplicatedCandidates.filter((candidate) => !areNearIdentical(candidate.text, correctAnswer));

  if (candidates.length === 0) {
    return {
      rawCandidates,
      candidates,
      relevant: [],
      highQuality: [],
      sameTopicCandidateCount: 0,
    };
  }
  const sortedRelevant = candidates.sort((left, right) => right.score - left.score);
  const bestScore = sortedRelevant[0]?.score ?? 0;
  const highQuality = sortedRelevant.filter((candidate) => candidate.score >= Math.max(20, bestScore - 80));

  return {
    rawCandidates,
    candidates,
    relevant: sortedRelevant,
    highQuality,
    sameTopicCandidateCount: candidates.filter((candidate) => candidate.tagOverlap > 0).length,
  };
}

function shuffle<T>(values: T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function hasValidChoices(question: StudyQuestion): boolean {
  const correctAnswer = normalizeForComparison(getAnswerText(question));
  const choices = explicitChoiceTexts(question).map((choice) => choice.trim()).filter(Boolean);
  const normalizedChoices = choices.map(normalizeForComparison);
  return Boolean(correctAnswer) && normalizedChoices.includes(correctAnswer) &&
    new Set(normalizedChoices).size === normalizedChoices.length && normalizedChoices.length >= 2;
}

export function buildMultipleChoiceOptions(
  item: StudyQuestion,
  allItems: StudyQuestion[],
  random: RandomSource = Math.random,
): string[] | null {
  if (hasValidChoices(item)) {
    if (!hasRequiredCodeContext(item)) return null;
    return explicitChoiceTexts(item).map((choice) => choice.trim()).filter(Boolean);
  }
  if (!hasQuestionAndAnswer(item) || !hasRequiredCodeContext(item)) return null;

  const analysis = getDistractorAnalysis(item, allItems);
  if (analysis.candidates.length < 3) return null;
  const selectionPool = analysis.highQuality.length >= 3 ? analysis.highQuality : analysis.candidates;

  return [getAnswerText(item).trim(), ...shuffle(selectionPool, random).slice(0, 3).map((candidate) => candidate.text)];
}

function getGeneratedRejectionReason(
  item: StudyQuestion,
  analysis: ReturnType<typeof getDistractorAnalysis>,
): MultipleChoiceRejectionReason {
  if (!hasQuestionAndAnswer(item)) return "missing question or answer";
  if (!hasRequiredCodeContext(item)) return "code task without code context";
  if (analysis.rawCandidates.length < 3) return "insufficient total candidates";
  if (analysis.candidates.length < 3 && analysis.rawCandidates.length > analysis.candidates.length) {
    return "duplicate/near-duplicate candidates removed";
  }
  if (analysis.relevant.length < 3) {
    const answer = getAnswerText(item);
    const sameShapeCount = analysis.candidates.filter((candidate) => answerShape(answer) === answerShape(candidate.text)).length;
    if (sameShapeCount < 3) return "answer shape mismatch";
    const similarLengthCount = analysis.candidates.filter((candidate) => {
      const maxLength = Math.max(answer.length, candidate.text.length, 1);
      return Math.abs(answer.length - candidate.text.length) / maxLength <= 0.5;
    }).length;
    if (similarLengthCount < 3) return "answer length mismatch";
    return analysis.sameTopicCandidateCount === 0 ? "candidate answers unrelated" : "candidate answers too dissimilar";
  }
  if (analysis.highQuality.length < 3) {
    const answer = getAnswerText(item);
    const similarLengthCount = analysis.relevant.filter((candidate) => {
      const maxLength = Math.max(answer.length, candidate.text.length, 1);
      return Math.abs(answer.length - candidate.text.length) / maxLength <= 0.5;
    }).length;
    return similarLengthCount < 3 ? "answer length mismatch" : "candidate answers too dissimilar";
  }
  return "candidate answers too dissimilar";
}

export function getMultipleChoiceEligibilityDiagnostic(
  item: StudyQuestion,
  allItems: StudyQuestion[],
): MultipleChoiceEligibilityDiagnostic {
  const explicitChoices = explicitChoiceTexts(item).filter((choice) => choice.trim().length > 0);
  const hasExplicitChoices = explicitChoices.length > 0;
  const explicitChoicesValid = hasValidChoices(item);
  const analysis = getDistractorAnalysis(item, allItems);
  const generatedEligible = !explicitChoicesValid && hasQuestionAndAnswer(item) && hasRequiredCodeContext(item) && analysis.candidates.length >= 3;
  const eligible = explicitChoicesValid || generatedEligible;

  return {
    questionId: item.id,
    question: getQuestionText(item),
    type: item.type,
    isDebugCode: item.type === "debug-code",
    hasExplicitChoices,
    explicitChoicesValid,
    eligible,
    source: explicitChoicesValid ? "explicit" : generatedEligible ? "generated" : null,
    generatedOptions: generatedEligible
      ? [getAnswerText(item), ...shuffle(analysis.highQuality.length >= 3 ? analysis.highQuality : analysis.candidates, () => 0).slice(0, 3).map((candidate) => candidate.text)]
      : [],
    rejectionReason: eligible
      ? undefined
      : hasExplicitChoices && !explicitChoicesValid
        ? "explicit choices invalid"
        : getGeneratedRejectionReason(item, analysis),
    candidateCount: analysis.rawCandidates.length,
    suitableCandidateCount: analysis.candidates.length,
    duplicateCandidatesRemoved: analysis.rawCandidates.length - analysis.candidates.length,
    sameTopicCandidateCount: analysis.sameTopicCandidateCount,
  };
}

export function getMultipleChoiceDiagnostics(
  items: StudyQuestion[],
): MultipleChoiceDiagnosticsReport {
  const diagnostics = items.map((item) => getMultipleChoiceEligibilityDiagnostic(item, items));
  const generated = diagnostics.filter((diagnostic) => diagnostic.source === "generated");
  const rejected = diagnostics.filter((diagnostic) => !diagnostic.eligible);
  const debugCode = diagnostics.filter((diagnostic) => diagnostic.isDebugCode);
  const normal = diagnostics.filter((diagnostic) => !diagnostic.isDebugCode);

  return {
    totalItems: items.length,
    normalItems: normal.length,
    debugCodeItems: debugCode.length,
    eligibleNormalItems: normal.filter((diagnostic) => diagnostic.eligible).length,
    eligibleDebugCodeWithExplicitChoices: debugCode.filter((diagnostic) => diagnostic.explicitChoicesValid).length,
    itemsWithExplicitChoices: diagnostics.filter((diagnostic) => diagnostic.hasExplicitChoices).length,
    itemsEligibleUsingGeneratedDistractors: generated.length,
    itemsRejectedForInsufficientDistractors: rejected.filter((diagnostic) => !diagnostic.explicitChoicesValid && diagnostic.suitableCandidateCount < 3).length,
    eligibleItems: diagnostics.filter((diagnostic) => diagnostic.eligible).length,
    rejectedItems: rejected,
    highQualityGeneratedExamples: generated.slice(0, 5),
    debugCode: {
      totalItems: debugCode.length,
      eligibleItems: debugCode.filter((diagnostic) => diagnostic.eligible).length,
      rejectedItems: debugCode.filter((diagnostic) => !diagnostic.eligible),
      examples: debugCode.filter((diagnostic) => diagnostic.source === "generated").slice(0, 3),
    },
  };
}

export function canUseInMultipleChoice(item: StudyQuestion, allItems: StudyQuestion[]): boolean {
  return Boolean(buildMultipleChoiceOptions(item, allItems, () => 0));
}

export function hasCodeCapability(question: StudyQuestion): boolean {
  return Boolean(
    question.codeSnippet?.trim() ||
    question.task,
  );
}

export function isDebugCodeQuestion(question: StudyQuestion): question is DebugCodeQuestion {
  return question.type === "debug-code";
}

export function canStudyItemInMode(
  question: StudyQuestion,
  mode: StudyPresentationMode,
  allItems: StudyQuestion[] = [question],
): boolean {
  switch (mode) {
    case "multiple-choice":
      return canUseInMultipleChoice(question, allItems);
    case "debug-code":
      return hasCodeCapability(question) && hasRequiredCodeContext(question);
    case "flashcard":
    case "write":
    case "rapid-recall":
    case "smart-study":
    case "weak-areas":
    case "exam":
      return hasQuestionAndAnswer(question) && hasRequiredCodeContext(question);
  }
}

export function getEligibleModes(question: StudyQuestion, allItems: StudyQuestion[] = [question]): StudyPresentationMode[] {
  const modes: StudyPresentationMode[] = ["flashcard", "write", "rapid-recall", "smart-study", "weak-areas", "exam"];
  if (canUseInMultipleChoice(question, allItems)) modes.push("multiple-choice");
  if (hasCodeCapability(question)) modes.push("debug-code");
  return modes;
}

export function getQuestionText(question: StudyQuestion): string {
  switch (question.type) {
    case "flashcard": return question.prompt;
    case "multiple-choice":
    case "write": return question.question;
    case "debug-code": return question.problemStatement;
  }
}

export function getAnswerText(question: StudyQuestion): string {
  switch (question.type) {
    case "flashcard": return question.answer;
    case "multiple-choice": return question.correctAnswer;
    case "write": return question.expectedAnswer;
    case "debug-code": return question.expectedExplanation;
  }
}

export function toFlashcardQuestion(question: StudyQuestion): FlashcardQuestion {
  return {
    id: question.id,
    studySetId: question.studySetId,
    type: "flashcard",
    prompt: getQuestionText(question),
    answer: getAnswerText(question),
    explanation: question.type === "debug-code" ? question.correctedCode ?? undefined : question.explanation,
    concepts: question.concepts,
    codeSnippet: question.codeSnippet,
    language: question.language,
    task: question.task,
    choices: question.choices,
  };
}

export function toWriteQuestion(question: StudyQuestion): WriteQuestion {
  return {
    id: question.id,
    studySetId: question.studySetId,
    type: "write",
    question: getQuestionText(question),
    expectedAnswer: getAnswerText(question),
    importantKeywords: question.concepts ?? [],
    explanation: question.type === "debug-code" ? question.correctedCode ?? undefined : question.explanation,
    concepts: question.concepts,
    codeSnippet: question.codeSnippet,
    language: question.language,
    task: question.task,
    choices: question.choices,
  };
}

export function toDebugCodeQuestion(question: StudyQuestion): DebugCodeQuestion {
  if (question.type === "debug-code") return question;
  return {
    id: question.id,
    studySetId: question.studySetId,
    type: "debug-code",
    task: question.task ?? "explain-behavior",
    problemStatement: getQuestionText(question),
    language: question.language ?? "text",
    codeSnippet: question.codeSnippet ?? "",
    expectedExplanation: getAnswerText(question),
    concepts: question.concepts,
  };
}

export function toMultipleChoiceQuestion(
  question: StudyQuestion,
  allItems: StudyQuestion[] = [question],
  random: RandomSource = Math.random,
): MultipleChoiceQuestion | null {
  const options = buildMultipleChoiceOptions(question, allItems, random);
  if (!options) return null;
  if (question.type === "multiple-choice" && hasValidChoices(question)) return question;

  return {
    id: question.id,
    studySetId: question.studySetId,
    type: "multiple-choice",
    question: getQuestionText(question),
    correctAnswer: options[0],
    distractors: options.slice(1),
    explanation: question.type === "debug-code" ? question.correctedCode : question.explanation,
    concepts: question.concepts,
    codeSnippet: question.codeSnippet,
    language: question.language,
    task: question.task,
  };
}
