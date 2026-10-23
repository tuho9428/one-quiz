import type { StudyQuestion } from "../domain/types";
import { portableItemFromStudyQuestion, type PortableQuestionType, type PortableStudyItem } from "../import/portable";

export interface EditableStudyItem {
  type: PortableQuestionType;
  question: string;
  answer: string;
  explanation: string;
  tags: string;
  choices: string;
  codeSnippet: string;
  language: string;
  task: string;
  memoryHook?: string;
  sentences?: string;
}

export function editableItemFromQuestion(question: StudyQuestion): EditableStudyItem {
  const item = portableItemFromStudyQuestion(question);
  return {
    type: item.type === "multiple-choice" ? "multiple_choice" : item.type === "debug-code" ? "debug_code" : item.type ?? "flashcard",
    question: item.question,
    answer: item.answer,
    explanation: item.explanation ?? "",
    tags: (item.tags ?? []).join(", "),
    choices: (item.choices ?? []).join("\n"),
    codeSnippet: item.codeSnippet ?? "",
    language: item.language ?? "",
    task: item.task ?? "",
    memoryHook: item.memoryHook ?? "",
    sentences: JSON.stringify(item.sentences ?? [], null, 2),
  };
}

export function emptyEditableStudyItem(): EditableStudyItem {
  return {
    type: "flashcard",
    question: "",
    answer: "",
    explanation: "",
    tags: "",
    choices: "",
    codeSnippet: "",
    language: "",
    task: "",
  };
}

export function portableItemFromEditable(value: EditableStudyItem): PortableStudyItem {
  const choices = value.choices.split("\n").map((choice) => choice.trim()).filter(Boolean);
  return {
    type: value.type,
    memoryHook: value.type === "verbatim" ? value.memoryHook : undefined,
    sentences: value.type === "verbatim" ? JSON.parse(value.sentences || "[]") : undefined,
    question: value.question,
    answer: value.answer,
    explanation: value.explanation.trim() || undefined,
    tags: value.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    choices: choices.length > 0 ? choices : undefined,
    codeSnippet: value.codeSnippet || undefined,
    language: value.language.trim() || undefined,
    task: value.task ? value.task as PortableStudyItem["task"] : undefined,
  };
}
