export class RunflowError extends Error {
  constructor(
    message: string,
    readonly opts: { status?: number; code?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "RunflowError";
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
  get status(): number | undefined {
    return this.opts.status;
  }
  get code(): string | undefined {
    return this.opts.code;
  }
}

export class RunFailedError extends RunflowError {
  constructor(
    message: string,
    readonly run: { id: string; status: string; error?: unknown },
  ) {
    super(message, { code: "run_failed" });
    this.name = "RunFailedError";
  }
}

export class RunTimeoutError extends RunflowError {
  constructor(
    message: string,
    readonly runId: string,
    readonly elapsedMs: number,
  ) {
    super(message, { code: "run_timeout" });
    this.name = "RunTimeoutError";
  }
}
