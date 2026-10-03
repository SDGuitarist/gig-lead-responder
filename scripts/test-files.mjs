// The one list of test files (plan §0.1). `npm test` and `npm run test:match`
// both read it, so a file can't be in one run and missing from the other.
// Node expands these globs itself; they must stay quoted, never shell-expanded.
export const TEST_FILES = ["src/**/*.test.ts", "scripts/**/*.test.ts", "tests/**/*.test.ts"];
