/**
 * Shared Vitest setup for client tests.
 *
 * Filters two known-benign dev warnings so test output stays readable:
 * - TanStack Router's code-splitting notice, fired when tests import page
 *   components from route modules (bundle size is irrelevant under Vitest).
 * - `useRouter` outside `<RouterProvider>`, fired when tests render pages
 *   that call `useNavigate` without a router wrapper; navigation never
 *   fires on the covered paths and route params are passed as props.
 *
 * Everything else passes through untouched. If a new warning appears,
 * it will still be visible here.
 */
const IGNORED_WARNING_PATTERNS = [
  "will increase your bundle size",
  "useRouter must be used inside",
];

const shouldIgnore = (args: readonly unknown[]): boolean =>
  args.some(
    (arg) =>
      typeof arg === "string" &&
      IGNORED_WARNING_PATTERNS.some((pattern) => arg.includes(pattern))
  );

for (const method of ["warn", "error"] as const) {
  const original: (...args: Parameters<typeof console.warn>) => void =
    console[method].bind(console);
  console[method] = (...args: Parameters<typeof console.warn>) => {
    if (!shouldIgnore(args)) {
      // oxlint-disable-next-line typescript/no-unsafe-argument -- console passthrough; args are only forwarded, never inspected.
      original(...args);
    }
  };
}
