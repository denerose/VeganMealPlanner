import { describe, expect, test } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { handlePostLogout } from '../../../src/api/handlers/auth';
import { ApiProblem } from '../../../src/api/api-problem';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

function logoutRequest(body: string): Request {
  return new Request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/** Minimal prisma mock recording `user.update` calls. */
function prismaRecordingUpdates(updates: unknown[]): PrismaClient {
  return {
    user: {
      update: async (args: unknown) => {
        updates.push(args);
      },
    },
  } as unknown as PrismaClient;
}

describe('handlePostLogout', () => {
  test('empty JSON object body bumps tokensValidAfter to now and returns 204', async () => {
    const updates: unknown[] = [];
    const before = Date.now();
    const res = await handlePostLogout(
      logoutRequest('{}'),
      prismaRecordingUpdates(updates),
      USER_ID
    );
    const after = Date.now();

    expect(res.status).toBe(204);
    expect(updates).toHaveLength(1);
    const update = updates[0] as {
      where: { id: string };
      data: { tokensValidAfter: Date };
    };
    expect(update.where).toEqual({ id: USER_ID });
    expect(update.data.tokensValidAfter).toBeInstanceOf(Date);
    expect(update.data.tokensValidAfter.getTime()).toBeGreaterThanOrEqual(before);
    expect(update.data.tokensValidAfter.getTime()).toBeLessThanOrEqual(after);
  });

  test('no body at all also bumps tokensValidAfter and returns 204', async () => {
    const updates: unknown[] = [];
    const res = await handlePostLogout(logoutRequest(''), prismaRecordingUpdates(updates), USER_ID);
    expect(res.status).toBe(204);
    expect(updates).toHaveLength(1);
  });

  test('JSON array body throws 422 invalid_body and does not bump the epoch', async () => {
    const updates: unknown[] = [];
    let err: unknown;
    try {
      await handlePostLogout(logoutRequest('[]'), prismaRecordingUpdates(updates), USER_ID);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiProblem);
    expect((err as ApiProblem).status).toBe(422);
    expect((err as ApiProblem).code).toBe('invalid_body');
    expect(updates).toHaveLength(0);
  });

  test('body with unexpected keys throws 422 invalid_body and does not bump the epoch', async () => {
    const updates: unknown[] = [];
    let err: unknown;
    try {
      await handlePostLogout(
        logoutRequest('{"extra":true}'),
        prismaRecordingUpdates(updates),
        USER_ID
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiProblem);
    expect((err as ApiProblem).status).toBe(422);
    expect((err as ApiProblem).code).toBe('invalid_body');
    expect(updates).toHaveLength(0);
  });

  test('non-JSON body throws 422 invalid_json and does not bump the epoch', async () => {
    const updates: unknown[] = [];
    let err: unknown;
    try {
      await handlePostLogout(logoutRequest('not json'), prismaRecordingUpdates(updates), USER_ID);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ApiProblem);
    expect((err as ApiProblem).status).toBe(422);
    expect((err as ApiProblem).code).toBe('invalid_json');
    expect(updates).toHaveLength(0);
  });
});
