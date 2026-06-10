/**
 * Known SDK error codes (open union — backend/proxy codes pass through
 * verbatim, so any string remains assignable).
 */
export type RunflowErrorCode =
  | "missing_config"
  | "invalid_api_key"
  | "request_timeout"
  | "network_error"
  | "missing_filename"
  | "file_too_large"
  | "bad_upload_session"
  | "insecure_upload_url"
  | "storage_put_failed"
  | "bad_upload_confirmation"
  | "invalid_asset_id"
  | "bad_asset_response"
  | "invalid_model_id"
  | "invalid_run_id"
  | "aborted"
  | "no_status"
  | "run_failed"
  | "run_timeout"
  | (string & {});

export class RunflowError extends Error {
  constructor(
    message: string,
    readonly opts: { status?: number; code?: RunflowErrorCode; cause?: unknown } = {},
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
  get code(): RunflowErrorCode | undefined {
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
