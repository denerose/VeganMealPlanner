import { describe, expect, test } from 'bun:test';
import { withRequestLogging, type RequestLogEntry } from '../../../src/api/request-logging';

describe('withRequestLogging', () => {
  test('logs exact method/path/status for a GET 200 response', async () => {
    const entries: RequestLogEntry[] = [];
    const handler = async (req: Request) => new Response(`body:${req.method}`, { status: 200 });
    const wrapped = withRequestLogging(handler, (entry) => entries.push(entry));

    const res = await wrapped(new Request('http://localhost:3000/api/meals', { method: 'GET' }));

    expect(res.status).toBe(200);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/api/meals');
    expect(entry.status).toBe(200);
    expect(Number.isFinite(entry.durationMs)).toBe(true);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('returns the original response unchanged (body still readable)', async () => {
    const entries: RequestLogEntry[] = [];
    const handler = async () => new Response('tempeh stir-fry', { status: 200 });
    const wrapped = withRequestLogging(handler, (entry) => entries.push(entry));

    const res = await wrapped(new Request('http://localhost:3000/api/meals', { method: 'GET' }));

    expect(await res.text()).toBe('tempeh stir-fry');
    expect(entries).toHaveLength(1);
  });

  test('logs a distinct POST 422 combination using pathname only', async () => {
    const entries: RequestLogEntry[] = [];
    const handler = async () => new Response('invalid body', { status: 422 });
    const wrapped = withRequestLogging(handler, (entry) => entries.push(entry));

    const res = await wrapped(
      new Request('http://localhost:3000/api/day-plans?date=2026-01-01', { method: 'POST' })
    );

    expect(res.status).toBe(422);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('/api/day-plans');
    expect(entry.status).toBe(422);
  });

  test('logs status 500 and re-throws when the handler throws', async () => {
    const entries: RequestLogEntry[] = [];
    const boom = new Error('lentil soup overflow');
    const handler = async () => {
      throw boom;
    };
    const wrapped = withRequestLogging(handler, (entry) => entries.push(entry));

    let caught: unknown = null;
    try {
      await wrapped(new Request('http://localhost:3000/api/ingredients', { method: 'DELETE' }));
    } catch (e) {
      caught = e;
    }

    expect(caught).toBe(boom);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.method).toBe('DELETE');
    expect(entry.path).toBe('/api/ingredients');
    expect(entry.status).toBe(500);
    expect(Number.isFinite(entry.durationMs)).toBe(true);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });
});
