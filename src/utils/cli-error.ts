type ErrorLogger = (message?: unknown, ...optionalParams: unknown[]) => void;

/**
 * Keep CLI errors generic by default, but let local operators opt into
 * actionable diagnostics with --verbose.
 */
export function logCliPipelineError(
  err: unknown,
  verbose: boolean,
  logger: ErrorLogger = console.error,
): void {
  if (!verbose) {
    logger("Pipeline error");
    return;
  }

  if (err instanceof Error) {
    logger(`Pipeline error: ${err.message}`);
    if (err.stack) {
      logger(err.stack);
    }
    return;
  }

  logger(`Pipeline error: ${String(err)}`);
}
