/** Extract a human-readable error message from an unknown catch value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Return BASE_URL with trailing slashes stripped. */
export function baseUrl(): string {
  return (process.env.BASE_URL || "").replace(/\/+$/, "");
}
