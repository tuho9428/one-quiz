<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# One Quiz project instructions

## Project purpose

One Quiz is an active-recall study application. The product should help users remember material as quickly and effectively as possible.

Prioritize retrieval practice, feedback, and identifying weaknesses over passive reading or content browsing.

## Architecture

- Build around a shared study engine.
- Study modes must reuse the shared scoring, progress, attempt, and session infrastructure.
- Keep business logic separate from UI and presentation code.
- Prefer small, focused, reusable components.
- Prefer strong TypeScript types and explicit domain models.
- Avoid duplicated state. Derive values from a single source of truth where possible.

## Study modes

Support these modes through the shared study engine:

- Flashcards
- Multiple Choice
- Write
- Rapid Recall
- Weak Areas
- Smart Study
- Debug/Code
- Eventually: Mock Interview and Exam

New modes should compose existing attempt, scoring, progress, and session behavior instead of creating parallel implementations.

## UX and visual direction

- Use a mobile-first layout and interaction model; enhance for larger screens progressively.
- Keep the app responsive, keyboard friendly, accessible, and fast to interact with.
- Make progress and feedback clear at the moment they are useful.
- Minimize unnecessary clicks and navigation steps.
- Avoid excessive animation. Respect `prefers-reduced-motion` and use motion only when it clarifies hierarchy, feedback, or state changes.
- Keep controls comfortable for touch, with visible focus states and adequate contrast.
- When changing frontend surfaces, inspect existing patterns first and apply the project's `design-taste-frontend` guidance where relevant without forcing marketing-page patterns onto study workflows.

## Engineering

- Inspect existing patterns before introducing libraries or abstractions.
- Do not rewrite working architecture without a strong reason.
- Do not add dependencies when existing project tools can solve the problem.
- Add tests for algorithms, scoring, scheduling, and other business logic.
- Run typecheck, tests, and lint after substantial changes when the corresponding scripts or tooling exist.
- Fix problems caused by the change before handing it off.
- Keep changes scoped to the requested task.
- Keep domain logic deterministic and easy to test; avoid hiding it in components or event handlers.

## Study data

Study attempts should eventually provide enough structured data to determine:

- Mastery
- Weaknesses
- Review scheduling
- Accuracy
- Study history
- Concept performance

When adding or changing attempt data, preserve the information needed for future analysis and scheduling. Prefer stable identifiers and explicit timestamps over UI-derived labels.

## Decision rule

When requirements are unclear, inspect the existing code and choose the implementation most consistent with the current architecture. Make the smallest change that preserves the shared study model and the mobile-first UX direction.
