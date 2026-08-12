import type { AttemptOutcome, GradeResult } from "../domain/types";

export interface TextScoreDetails extends GradeResult {
  includedConcepts: string[];
  missedConcepts: string[];
}

export function normalizeAnswer(answer: string): string {
  return answer
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(value: string): Set<string> {
  return new Set(normalizeAnswer(value).split(" ").filter(Boolean));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function outcomeForScore(score: number): AttemptOutcome {
  if (score >= 90) return "correct";
  if (score >= 60) return "partial";
  return "incorrect";
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = previous[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = current;
    }
  }

  return previous[right.length];
}

function tokensAreSimilar(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected.length < 4 || actual.length < 4) return false;
  if (expected.startsWith(actual) || actual.startsWith(expected)) return true;

  const maximumDistance = Math.max(1, Math.floor(Math.min(expected.length, actual.length) * 0.2));
  return levenshteinDistance(expected, actual) <= maximumDistance;
}

function conceptIsIncluded(concept: string, actualAnswer: string, actualTokens: Set<string>): boolean {
  const normalizedConcept = normalizeAnswer(concept);
  if (!normalizedConcept) return false;
  if (actualAnswer.includes(normalizedConcept)) return true;

  return normalizedConcept
    .split(" ")
    .every((conceptToken) =>
      [...actualTokens].some((actualToken) =>
        tokensAreSimilar(conceptToken, actualToken),
      ),
    );
}

export function scoreTextAnswerDetailed(
  expectedAnswer: string,
  userAnswer: string,
  importantConcepts: string[] = [],
): TextScoreDetails {
  const normalizedExpected = normalizeAnswer(expectedAnswer);
  const normalizedActual = normalizeAnswer(userAnswer);
  const expectedTokens = getTokens(normalizedExpected);
  const actualTokens = getTokens(normalizedActual);

  const includedConcepts = importantConcepts.filter((concept) =>
    conceptIsIncluded(concept, normalizedActual, actualTokens),
  );
  const missedConcepts = importantConcepts.filter(
    (concept) => !includedConcepts.includes(concept),
  );

  if (!normalizedExpected || !normalizedActual) {
    return {
      outcome: "incorrect",
      score: 0,
      includedConcepts,
      missedConcepts,
    };
  }

  if (normalizedExpected === normalizedActual) {
    return {
      outcome: "correct",
      score: 100,
      includedConcepts,
      missedConcepts,
    };
  }

  const matchedTokens = [...expectedTokens].filter((expectedToken) =>
    [...actualTokens].some((actualToken) =>
      tokensAreSimilar(expectedToken, actualToken),
    ),
  ).length;
  const tokenCoverage = expectedTokens.size
    ? matchedTokens / expectedTokens.size
    : 0;
  const conceptCoverage = importantConcepts.length
    ? includedConcepts.length / importantConcepts.length
    : tokenCoverage;
  const score = clampScore(
    importantConcepts.length
      ? conceptCoverage === 1
        ? 90 + tokenCoverage * 10
        : conceptCoverage * 70 + tokenCoverage * 50
      : tokenCoverage * 100,
  );

  return {
    outcome: outcomeForScore(score),
    score,
    includedConcepts,
    missedConcepts,
  };
}

export function scoreTextAnswer(
  expectedAnswer: string,
  userAnswer: string,
  importantConcepts: string[] = [],
): GradeResult {
  const { outcome, score } = scoreTextAnswerDetailed(
    expectedAnswer,
    userAnswer,
    importantConcepts,
  );

  return { outcome, score };
}
