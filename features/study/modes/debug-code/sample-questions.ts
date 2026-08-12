import type { DebugCodeQuestion } from "../../domain/types";

const studySetId = "software-engineering-foundations";

export const sampleDebugCodeQuestions: DebugCodeQuestion[] = [
  {
    id: "debug-use-effect-loop",
    studySetId,
    type: "debug-code",
    task: "identify-bug",
    problemStatement: "What is wrong with this React code?",
    language: "tsx",
    codeSnippet: `const [count, setCount] = useState(0);

useEffect(() => {
  setCount(count + 1);
}, [count]);`,
    expectedExplanation:
      "The effect updates the state that it depends on, so it runs again after every update and creates a render loop.",
    concepts: ["React useEffect", "state mutation", "render loop"],
  },
  {
    id: "debug-closure-output",
    studySetId,
    type: "debug-code",
    task: "predict-output",
    problemStatement: "What does this code print?",
    language: "javascript",
    codeSnippet: `let count = 0;
const next = () => ++count;

console.log(next());
console.log(next());`,
    expectedOutput: "1 followed by 2",
    expectedExplanation:
      "The closure keeps access to the same count variable, so each call increments the shared value.",
    concepts: ["closures", "state mutation"],
  },
  {
    id: "debug-reducer-fix",
    studySetId,
    type: "debug-code",
    task: "fix-code",
    problemStatement: "Fix the reducer so it returns the total price.",
    language: "javascript",
    codeSnippet: `function total(items) {
  return items.reduce((sum, item) => item.price, 0);
}`,
    expectedCode: "return items.reduce((sum, item) => sum + item.price, 0);",
    expectedExplanation:
      "The reducer returns the current price instead of adding it to the running sum. Return sum plus item.price.",
    correctedCode: `function total(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`,
    concepts: ["JavaScript", "array reduce"],
  },
  {
    id: "debug-async-order",
    studySetId,
    type: "debug-code",
    task: "explain-behavior",
    problemStatement: "Why can this log happen before the fetch result?",
    language: "typescript",
    codeSnippet: `const response = fetch("/api/user");
console.log("done");`,
    expectedExplanation:
      "fetch is asynchronous and returns a promise immediately, so the synchronous log runs before the network request resolves.",
    concepts: ["async", "promises"],
  },
  {
    id: "debug-typescript-complete",
    studySetId,
    type: "debug-code",
    task: "complete-code",
    problemStatement: "Complete the function so it accepts a string and returns its length.",
    language: "typescript",
    codeSnippet: `function lengthOf(value: ______): number {
  return value.length;
}`,
    expectedCode: "function lengthOf(value: string): number",
    expectedExplanation:
      "The parameter should be typed as string because the function reads the string length property.",
    correctedCode: `function lengthOf(value: string): number {
  return value.length;
}`,
    concepts: ["TypeScript", "type annotations"],
  },
];

