import type {
  DebugCodeQuestion,
  FlashcardQuestion,
  MultipleChoiceQuestion,
  StudyQuestion,
  WriteQuestion,
} from "../domain/types";

export type PortableQuestionType =
  | "flashcard"
  | "write"
  | "multiple_choice"
  | "debug_code";

export interface PortableStudyItem {
  type?: PortableQuestionType | "multiple-choice" | "debug-code";
  question: string;
  answer: string;
  explanation?: string;
  tags?: string[];
  choices?: string[];
  codeSnippet?: string;
  language?: string;
  task?: DebugCodeQuestion["task"];
}

export interface NormalizedPortableStudyItem {
  type: "flashcard" | "write" | "multiple-choice" | "debug-code";
  question: string;
  answer: string;
  explanation?: string;
  tags: string[];
  choices?: string[];
  codeSnippet?: string;
  language?: string;
  task?: DebugCodeQuestion["task"];
}

export interface PortableValidationError {
  index: number;
  message: string;
}

export interface PortableParseResult {
  syntaxError?: string;
  items: Array<{
    index: number;
    value: unknown;
    normalized?: NormalizedPortableStudyItem;
    errors: string[];
    selected: boolean;
  }>;
  validItems: NormalizedPortableStudyItem[];
  errors: PortableValidationError[];
}

const TYPE_ALIASES: Record<string, NormalizedPortableStudyItem["type"]> = {
  flashcard: "flashcard",
  write: "write",
  multiple_choice: "multiple-choice",
  "multiple-choice": "multiple-choice",
  debug_code: "debug-code",
  "debug-code": "debug-code",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requiresCodeContext(question: string): boolean {
  return /\b(this effect|this key|this code|this component|this interval|this closure|what happens here|what is wrong|why does this return|fix (?:this|the)|predict[^\n]*output|code snippet|bug)\b/i.test(question);
}

function cleanTags(value: unknown): { tags: string[]; error?: string } {
  if (value === undefined) return { tags: [] };
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
    return { tags: [], error: '"tags" must be an array of strings' };
  }

  return {
    tags: [...new Set(value.map((tag) => tag.trim()).filter(Boolean))],
  };
}

function cleanJsonInput(input: string): string {
  const lines = input.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const firstLine = lines[0]?.trim() ?? "";
  const lastLine = lines.at(-1)?.trim() ?? "";

  if (/^```(?:json)?$/i.test(firstLine) && lastLine === "```") {
    return lines.slice(1, -1).join("\n").trim();
  }

  return lines.join("\n");
}

function validateItem(value: unknown): { normalized?: NormalizedPortableStudyItem; errors: string[] } {
  if (!isRecord(value)) return { errors: ["item must be an object"] };

  const errors: string[] = [];
  if (!nonEmptyString(value.question)) errors.push('missing "question"');
  if (!nonEmptyString(value.answer)) errors.push('missing "answer"');

  const rawType = value.type === undefined ? "flashcard" : value.type;
  const type = typeof rawType === "string" ? TYPE_ALIASES[rawType] : undefined;
  if (!type) errors.push("invalid question type");

  const tags = cleanTags(value.tags);
  if (tags.error) errors.push(tags.error);

  if (value.explanation !== undefined && typeof value.explanation !== "string") {
    errors.push('"explanation" must be a string');
  }

  let choices: string[] | undefined;
  if (type === "multiple-choice" || value.choices !== undefined) {
    if (!Array.isArray(value.choices) || value.choices.some((choice) => typeof choice !== "string" || !choice.trim())) {
      errors.push("multiple_choice requires a non-empty choices array of strings");
    } else {
      choices = [...new Set(value.choices.map((choice) => choice.trim()))];
      if (choices.length < 2) errors.push("multiple_choice requires at least 2 choices");
      if (nonEmptyString(value.answer) && !choices.includes(value.answer.trim())) {
        errors.push('multiple_choice "answer" must match one choice');
      }
    }
  }

  let codeSnippet: string | undefined;
  let language: string | undefined;
  if (value.codeSnippet !== undefined && typeof value.codeSnippet !== "string") {
    errors.push('"codeSnippet" must be a string');
  } else if (typeof value.codeSnippet === "string") {
    codeSnippet = value.codeSnippet;
  }
  if (value.language !== undefined && typeof value.language !== "string") {
    errors.push('"language" must be a string');
  } else if (typeof value.language === "string" && value.language.trim()) {
    language = value.language.trim();
  }
  const hasValidExplicitChoices = Boolean(
    choices &&
    choices.length >= 2 &&
    nonEmptyString(value.answer) &&
    choices.includes(value.answer.trim()),
  );
  if (type === "debug-code" && !codeSnippet?.trim() && !hasValidExplicitChoices) {
    errors.push("debug_code requires codeSnippet");
  }
  if (nonEmptyString(value.question) && requiresCodeContext(value.question) && !codeSnippet?.trim() && !(type === "debug-code" && hasValidExplicitChoices)) {
    errors.push("this question appears to require codeSnippet");
  }

  if (value.task !== undefined && (typeof value.task !== "string" || ![
    "identify-bug",
    "explain-behavior",
    "predict-output",
    "fix-code",
    "complete-code",
  ].includes(value.task))) {
    errors.push('"task" is invalid');
  }

  if (errors.length > 0 || !type || !nonEmptyString(value.question) || !nonEmptyString(value.answer)) {
    return { errors };
  }

  return {
    errors: [],
    normalized: {
      type,
      question: value.question.trim(),
      answer: value.answer.trim(),
      explanation: typeof value.explanation === "string" && value.explanation.trim()
        ? value.explanation.trim()
        : undefined,
      tags: tags.tags,
      choices,
      codeSnippet,
      language: type === "debug-code" ? language ?? "text" : language,
      task: typeof value.task === "string"
        ? value.task as DebugCodeQuestion["task"]
        : undefined,
    },
  };
}

export function parsePortableStudyJson(input: string): PortableParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonInput(input));
  } catch {
    return { syntaxError: "JSON syntax error: check commas, quotes, and brackets.", items: [], validItems: [], errors: [] };
  }

  if (isRecord(parsed) && ("question" in parsed || "answer" in parsed)) {
    parsed = [parsed];
  }

  if (!Array.isArray(parsed)) {
    return {
      items: [],
      validItems: [],
      errors: [{ index: 0, message: "root JSON value must be an array" }],
    };
  }

  const items = parsed.map((value, index) => {
    const result = validateItem(value);
    return { index, value, normalized: result.normalized, errors: result.errors, selected: Boolean(result.normalized) };
  });

  return {
    items,
    validItems: items.flatMap((item) => item.normalized ? [item.normalized] : []),
    errors: items.flatMap((item) => item.errors.map((message) => ({ index: item.index, message }))),
  };
}

export function portableItemFromStudyQuestion(question: StudyQuestion): PortableStudyItem {
  switch (question.type) {
    case "flashcard":
      return { type: "flashcard", question: question.prompt, answer: question.answer, explanation: question.explanation, tags: question.concepts, choices: question.choices, codeSnippet: question.codeSnippet, language: question.language, task: question.task };
    case "write":
      return { type: "write", question: question.question, answer: question.expectedAnswer, explanation: question.explanation, tags: question.concepts, choices: question.choices, codeSnippet: question.codeSnippet, language: question.language, task: question.task };
    case "multiple-choice":
      return { type: "multiple_choice", question: question.question, answer: question.correctAnswer, explanation: question.explanation, tags: question.concepts, choices: [question.correctAnswer, ...question.distractors], codeSnippet: question.codeSnippet, language: question.language, task: question.task };
    case "debug-code":
      return { type: "debug_code", question: question.problemStatement, answer: question.expectedExplanation, tags: question.concepts, choices: question.choices, codeSnippet: question.codeSnippet, language: question.language, task: question.task };
  }
}

export function portableTemplate(): string {
  return JSON.stringify([
    {
      type: "flashcard",
      question: "What is React?",
      answer: "React is a JavaScript library for building user interfaces.",
      explanation: "React uses reusable components and declarative rendering.",
      tags: ["React", "Core"],
    },
    {
      type: "multiple_choice",
      question: "Which hook stores a mutable value without causing a render?",
      answer: "useRef",
      choices: ["useState", "useRef", "useEffect", "useMemo"],
      tags: ["React", "Hooks"],
    },
  ], null, 2);
}

export function portableAiInstructions(): string {
  return `Convert my study material into a JSON array that can be imported into my study app.

Return ONLY valid JSON. Do not use Markdown code fences. Do not include explanations outside the JSON.

Each item may use:
{
  "type": "flashcard | multiple_choice | write | debug_code",
  "question": "string",
  "answer": "string",
  "explanation": "optional string",
  "tags": ["optional", "tags"],
  "choices": ["required for multiple choice"],
  "codeSnippet": "optional code",
  "language": "optional language"
}

Rules:
- type is the original/preferred content presentation and is not exclusive; items with question and answer can be reused in Flashcards, Write, Rapid Recall, Smart Study, Weak Areas, and Exam
- question and answer are required
- use flashcard for basic recall
- use multiple_choice when useful
- use write for active recall and explanation
- use debug_code when the material contains code debugging
- generate useful tags
- explanations should be concise
- do not generate database IDs, user IDs, timestamps, mastery, or progress fields
- every question should be independently understandable`;
}

export function toStudyQuestion(
  item: NormalizedPortableStudyItem,
  id: string,
  studySetId: string,
): StudyQuestion {
  switch (item.type) {
    case "flashcard":
      return { id, studySetId, type: "flashcard", prompt: item.question, answer: item.answer, explanation: item.explanation, concepts: item.tags, choices: item.choices, codeSnippet: item.codeSnippet, language: item.language, task: item.task } satisfies FlashcardQuestion;
    case "write":
      return { id, studySetId, type: "write", question: item.question, expectedAnswer: item.answer, explanation: item.explanation, importantKeywords: item.tags, concepts: item.tags, choices: item.choices, codeSnippet: item.codeSnippet, language: item.language, task: item.task } satisfies WriteQuestion;
    case "multiple-choice":
      return { id, studySetId, type: "multiple-choice", question: item.question, correctAnswer: item.answer, distractors: (item.choices ?? []).filter((choice) => choice !== item.answer), explanation: item.explanation, concepts: item.tags, codeSnippet: item.codeSnippet, language: item.language, task: item.task } satisfies MultipleChoiceQuestion;
    case "debug-code":
      return { id, studySetId, type: "debug-code", task: item.task ?? "explain-behavior", problemStatement: item.question, language: item.language ?? "text", codeSnippet: item.codeSnippet ?? "", expectedExplanation: item.answer, concepts: item.tags, choices: item.choices } satisfies DebugCodeQuestion;
  }
}
