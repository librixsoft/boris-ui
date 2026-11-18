export interface BrowserErrorDetail {
  operation: string;
  url?: string;
  originalMessage: string;
  stack?: string;
  cause?: string;
}

class BrowserError extends Error {
  readonly name = "BrowserError";
  readonly operation: string;
  readonly url?: string;
  readonly originalMessage: string;
  readonly causeMessage?: string;

  constructor(detail: BrowserErrorDetail, options?: { cause?: unknown }) {
    super(detail.originalMessage, options);
    this.operation = detail.operation;
    this.url = detail.url;
    this.originalMessage = detail.originalMessage;
    this.causeMessage = options?.cause instanceof Error ? options.cause.message : undefined;
    if (options?.cause instanceof Error && options.cause.stack) {
      this.stack = `${this.name} [${detail.operation}]${detail.url ? ` (${detail.url})` : ""}: ${detail.originalMessage}\n\nCausa original:\n${options.cause.stack}`;
    }
  }

  toDetail(): BrowserErrorDetail {
    return {
      operation: this.operation,
      url: this.url,
      originalMessage: this.originalMessage,
      stack: this.stack,
      cause: this.causeMessage
    };
  }
}

function toBrowserError(operation: string, url: string | undefined, error: unknown): BrowserError {
  if (error instanceof BrowserError) {
    return error;
  }
  const originalMessage = error instanceof Error ? error.message : String(error);
  return new BrowserError(
    {
      operation,
      url,
      originalMessage: originalMessage || "Error desconocido en el navegador"
    },
    { cause: error }
  );
}

export { BrowserError, toBrowserError };
export default BrowserError;
