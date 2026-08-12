import type {
  ImportDraftCard,
  ImportParseResult,
  UnparsedImportSection,
} from "./types";

interface ParsedContent {
  text: string;
  codeSnippet?: string;
  language?: string;
}

const QUESTION_LABEL = /^\s*(?:question|q)\s*:\s*(.*)$/i;
const ANSWER_LABEL = /^\s*(?:answer|a)\s*:\s*(.*)$/i;
const TAG_LABEL = /^\s*(?:tags?|topics?)\s*:\s*(.*)$/i;
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;
const FENCE = /^\s*```\s*([\w+#-]*)\s*$/;

function createId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

function splitLines(content: string): string[] {
  return content.replace(/\r\n?/g, "\n").split("\n");
}

function cleanText(lines: string[]): string {
  return lines
    .filter((line) => !FENCE.test(line) && !/^\s*```\s*$/.test(line))
    .join("\n")
    .replace(/^\s*[-*]\s+/, "")
    .trim();
}

function extractTags(lines: string[]): string[] {
  return lines
    .flatMap((line) => {
      const match = line.match(TAG_LABEL);
      return match
        ? match[1].split(/[,|]/).map((tag) => tag.trim()).filter(Boolean)
        : [];
    })
    .filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function parseContent(lines: string[]): ParsedContent {
  const textLines: string[] = [];
  const codeBlocks: string[] = [];
  let language: string | undefined;
  let inCode = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    const fence = line.match(FENCE);

    if (fence && !inCode) {
      inCode = true;
      language = fence[1] || language;
      codeLines = [];
      continue;
    }

    if (inCode && /^\s*```\s*$/.test(line)) {
      codeBlocks.push(codeLines.join("\n").trim());
      inCode = false;
      continue;
    }

    if (inCode) codeLines.push(line);
    else if (!TAG_LABEL.test(line)) textLines.push(line);
  }

  if (inCode && codeLines.length > 0) codeBlocks.push(codeLines.join("\n").trim());

  return {
    text: cleanText(textLines),
    codeSnippet: codeBlocks.filter(Boolean).join("\n\n") || undefined,
    language,
  };
}

function makeDraftCard(
  index: number,
  question: string,
  answer: string,
  sourceLines: string[],
  options: { forceCode?: boolean; explanation?: string } = {},
): ImportDraftCard {
  const parsedQuestion = parseContent([question]);
  const parsedAnswer = parseContent([answer]);
  const parsedSource = parseContent(sourceLines);
  const codeSnippet = parsedQuestion.codeSnippet ?? parsedAnswer.codeSnippet ?? parsedSource.codeSnippet;
  const isCode = Boolean(options.forceCode || codeSnippet);
  const reviewReasons: string[] = [];

  if (!question.trim()) reviewReasons.push("Question is missing");
  if (!answer.trim() && !codeSnippet) reviewReasons.push("Answer is missing");
  if (isCode && !parsedAnswer.text && !options.explanation) {
    reviewReasons.push("Code question needs an explanation");
  }

  return {
    id: createId("draft", index),
    question: parsedQuestion.text || question.trim(),
    answer: parsedAnswer.text || answer.trim(),
    explanation: options.explanation,
    tags: extractTags(sourceLines),
    type: isCode ? "debug-code" : "flashcard",
    isCode,
    codeSnippet,
    language: parsedQuestion.language ?? parsedAnswer.language ?? parsedSource.language,
    sourceText: sourceLines.join("\n").trim(),
    needsReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

function findNextBoundary(lines: string[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    if (QUESTION_LABEL.test(lines[index]) || NUMBERED.test(lines[index]) || HEADING.test(lines[index])) {
      return index;
    }
  }

  return lines.length;
}

function parseQuestionAnswerBlocks(
  lines: string[],
  consumed: boolean[],
  cards: ImportDraftCard[],
): void {
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed[index]) continue;
    const questionMatch = lines[index].match(QUESTION_LABEL);
    if (!questionMatch) continue;

    const answerIndex = lines.findIndex(
      (line, lineIndex) =>
        lineIndex > index && !consumed[lineIndex] && ANSWER_LABEL.test(line),
    );
    const boundary = answerIndex === -1
      ? findNextBoundary(lines, index + 1)
      : findNextBoundary(lines, answerIndex + 1);
    const end = answerIndex === -1 ? boundary : boundary;
    const questionLines = [questionMatch[1], ...lines.slice(index + 1, answerIndex === -1 ? boundary : answerIndex)];
    const answerLines = answerIndex === -1
      ? []
      : [lines[answerIndex].match(ANSWER_LABEL)?.[1] ?? "", ...lines.slice(answerIndex + 1, end)];
    const sourceLines = lines.slice(index, end);
    const card = makeDraftCard(cards.length, cleanText(questionLines), cleanText(answerLines), sourceLines);

    cards.push(card);
    for (let consumedIndex = index; consumedIndex < end; consumedIndex += 1) consumed[consumedIndex] = true;
    index = Math.max(index, end - 1);
  }
}

function parseNumberedBlocks(
  lines: string[],
  consumed: boolean[],
  cards: ImportDraftCard[],
): void {
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed[index]) continue;
    const questionMatch = lines[index].match(NUMBERED);
    if (!questionMatch) continue;

    let end = index + 1;
    while (end < lines.length && !NUMBERED.test(lines[end]) && !HEADING.test(lines[end])) end += 1;
    const answerLines = lines.slice(index + 1, end);
    const card = makeDraftCard(
      cards.length,
      questionMatch[1],
      cleanText(answerLines),
      lines.slice(index, end),
    );

    cards.push(card);
    for (let consumedIndex = index; consumedIndex < end; consumedIndex += 1) consumed[consumedIndex] = true;
    index = end - 1;
  }
}

function parseHeadingBlocks(
  lines: string[],
  consumed: boolean[],
  cards: ImportDraftCard[],
): void {
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed[index]) continue;
    const headingMatch = lines[index].match(HEADING);
    if (!headingMatch) continue;

    let end = index + 1;
    while (end < lines.length && !HEADING.test(lines[end])) end += 1;
    const contentLines = lines.slice(index + 1, end);
    const parsed = parseContent(contentLines);
    const card = makeDraftCard(
      cards.length,
      headingMatch[1],
      parsed.text,
      lines.slice(index, end),
      { forceCode: Boolean(parsed.codeSnippet) },
    );

    cards.push(card);
    for (let consumedIndex = index; consumedIndex < end; consumedIndex += 1) consumed[consumedIndex] = true;
    index = end - 1;
  }
}

function parseDefinitionLines(
  lines: string[],
  consumed: boolean[],
  cards: ImportDraftCard[],
): void {
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed[index]) continue;
    const match = lines[index].match(/^\s*(?:\*\*)?([^:*\n]{2,60})(?:\*\*)?\s*(?::|\s+-\s+)\s*(.+)$/);
    if (!match || QUESTION_LABEL.test(lines[index]) || ANSWER_LABEL.test(lines[index])) continue;

    const term = match[1].trim();
    const definition = match[2].trim();
    cards.push(
      makeDraftCard(cards.length, `What is ${term}?`, definition, [lines[index]]),
    );
    consumed[index] = true;
  }
}

function parseStandaloneCodeBlocks(
  lines: string[],
  consumed: boolean[],
  cards: ImportDraftCard[],
): void {
  for (let index = 0; index < lines.length; index += 1) {
    if (consumed[index] || !FENCE.test(lines[index])) continue;
    let end = index + 1;
    while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end += 1;
    const card = makeDraftCard(
      cards.length,
      "Explain or fix this code",
      "",
      lines.slice(index, Math.min(lines.length, end + 1)),
      { forceCode: true },
    );
    cards.push(card);
    for (let consumedIndex = index; consumedIndex <= Math.min(end, lines.length - 1); consumedIndex += 1) consumed[consumedIndex] = true;
    index = end;
  }
}

function collectUnparsedSections(
  lines: string[],
  consumed: boolean[],
): UnparsedImportSection[] {
  const sections: UnparsedImportSection[] = [];
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && (consumed[index] || !lines[index].trim())) index += 1;
    if (index >= lines.length) break;
    const start = index;
    while (index < lines.length && !consumed[index]) index += 1;
    const content = lines.slice(start, index).join("\n").trim();
    if (content) {
      sections.push({
        id: createId("unparsed", sections.length),
        content,
        reason: "This content did not match a supported study-card structure.",
      });
    }
  }

  return sections;
}

export function parseStudyMaterial(content: string): ImportParseResult {
  const lines = splitLines(content);
  const consumed = lines.map(() => false);
  const draftCards: ImportDraftCard[] = [];

  parseQuestionAnswerBlocks(lines, consumed, draftCards);
  parseNumberedBlocks(lines, consumed, draftCards);
  parseHeadingBlocks(lines, consumed, draftCards);
  parseDefinitionLines(lines, consumed, draftCards);
  parseStandaloneCodeBlocks(lines, consumed, draftCards);

  const normalizedContent = lines.join("\n");
  draftCards.sort((left, right) => {
    const leftPosition = normalizedContent.indexOf(left.sourceText);
    const rightPosition = normalizedContent.indexOf(right.sourceText);
    return (leftPosition < 0 ? Number.MAX_SAFE_INTEGER : leftPosition) -
      (rightPosition < 0 ? Number.MAX_SAFE_INTEGER : rightPosition);
  });

  const unparsedSections = collectUnparsedSections(lines, consumed);
  const needsReviewCount =
    draftCards.filter((card) => card.needsReview).length + unparsedSections.length;

  return {
    draftCards,
    unparsedSections,
    recognizedCount: draftCards.filter((card) => !card.needsReview).length,
    needsReviewCount,
  };
}
