export type RequestLogEntry = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

export function logRequest(entry: RequestLogEntry): void {
  console.log(JSON.stringify(entry));
}

/**
 * Wraps a fetch handler so every request logs one `{method, path, status, durationMs}` line.
 * The response object is returned unchanged (its body is never read), and errors from the
 * handler are logged with status 500 and re-thrown as-is (Bun.serve turns them into 500s).
 */
export function withRequestLogging(
  handler: (req: Request) => Promise<Response>,
  log: (entry: RequestLogEntry) => void = logRequest
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const start = performance.now();
    let status = 500;
    try {
      const response = await handler(req);
      status = response.status;
      return response;
    } finally {
      log({
        method: req.method,
        path: new URL(req.url).pathname,
        status,
        durationMs: performance.now() - start,
      });
    }
  };
}
