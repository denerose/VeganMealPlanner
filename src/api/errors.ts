export function jsonError(status: number, code: string, message?: string): Response {
  return Response.json(
    { code, ...(message ? { message } : {}) },
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
