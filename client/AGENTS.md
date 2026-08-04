# Client Project Rules

## TypeScript and React

- Keep TypeScript strict and prefer `unknown` plus narrowing over `any`.
- Use meaningful names and explicit types where they clarify intent.
- Prefer `const`, `for...of`, optional chaining, nullish coalescing, and early returns.
- Await promises in async functions and handle errors with useful context.
- Use function components and call hooks only at the top level.
- Include complete hook dependencies and stable keys for rendered collections.
- Keep components and functions focused; extract complex conditions into named values.
- Remove `console.log`, `debugger`, and `alert` from production code.

## Accessibility and UI

- Use semantic HTML, correct heading hierarchy, labels, meaningful image alt text, keyboard handlers, and ARIA only where needed.
- Use existing project primitives before adding new ones. Use `cn` for class logic.
- Prefer Tailwind defaults for spacing, radius, shadows, colors, and typography.
- Add `aria-label` to icon-only buttons.
- Use `AlertDialog` for destructive or irreversible actions.
- Use `h-dvh`, respect safe-area insets for fixed elements, and show errors beside the action or field that caused them.
- Never block paste in inputs or textareas.
- Do not add animation unless requested. Animate only `transform` and `opacity`, keep interaction feedback under 200ms, pause off-screen loops, and respect `prefers-reduced-motion`.
- Avoid gradients, glow effects, large blur/backdrop surfaces, and custom easing unless explicitly requested.
- Use text balancing for headings, text prettifying for body copy, tabular numbers for data, a fixed z-index scale, and square size utilities where appropriate.
