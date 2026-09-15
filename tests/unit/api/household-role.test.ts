import { describe, expect, it } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { ApiProblem } from '../../../src/api/api-problem';
import { requireHouseholdOwner } from '../../../src/api/services/tenancy';
import { handlePatchHousehold, type ApiContext } from '../../../src/api/handlers/me-household';
import { handlePostHouseholdInvitation } from '../../../src/api/handlers/household-invitations';

type MembershipRoleRow = { role: 'OWNER' | 'MEMBER' } | null;

interface MockContext {
  ctx: ApiContext;
  householdUpdates: { where: { id: string }; data: { name?: string } }[];
  invitationCreates: {
    data: { householdId: string; email: string; createdByUserId: string };
  }[];
}

function makeContext(roleRow: MembershipRoleRow): MockContext {
  const householdUpdates: MockContext['householdUpdates'] = [];
  const invitationCreates: MockContext['invitationCreates'] = [];
  const prisma = {
    householdMembership: {
      findFirst: async () => roleRow,
    },
    household: {
      update: async (args: MockContext['householdUpdates'][number]) => {
        householdUpdates.push(args);
        return {
          id: 'hh-1',
          name: 'Sprout Collective',
          createdAt: new Date('2024-01-01T00:00:00Z'),
          updatedAt: new Date('2024-01-02T00:00:00Z'),
        };
      },
    },
    householdInvitation: {
      create: async (args: MockContext['invitationCreates'][number]) => {
        invitationCreates.push(args);
        return {};
      },
    },
  } as unknown as PrismaClient;
  return {
    ctx: { prisma, userId: 'user-1', householdId: 'hh-1' },
    householdUpdates,
    invitationCreates,
  };
}

async function captureProblem(fn: () => Promise<unknown>): Promise<ApiProblem> {
  try {
    await fn();
  } catch (e) {
    return e as ApiProblem;
  }
  throw new Error('expected the call to reject');
}

describe('requireHouseholdOwner', () => {
  it('passes silently when the membership role is OWNER', async () => {
    const { ctx } = makeContext({ role: 'OWNER' });
    await expect(
      requireHouseholdOwner(ctx.prisma, ctx.userId, ctx.householdId)
    ).resolves.toBeUndefined();
  });

  it('throws 403 not_household_owner when the membership role is MEMBER', async () => {
    const { ctx } = makeContext({ role: 'MEMBER' });
    const problem = await captureProblem(() =>
      requireHouseholdOwner(ctx.prisma, ctx.userId, ctx.householdId)
    );
    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.status).toBe(403);
    expect(problem.code).toBe('not_household_owner');
    expect(problem.message).toBe('Only household owners can perform this action');
  });

  it('throws 403 not_household_owner when there is no membership row', async () => {
    const { ctx } = makeContext(null);
    const problem = await captureProblem(() =>
      requireHouseholdOwner(ctx.prisma, ctx.userId, ctx.householdId)
    );
    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.status).toBe(403);
    expect(problem.code).toBe('not_household_owner');
  });
});

describe('handlePatchHousehold role guard', () => {
  it('rejects a MEMBER with 403 not_household_owner and never updates the household', async () => {
    const { ctx, householdUpdates } = makeContext({ role: 'MEMBER' });
    const req = new Request('http://localhost/api/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Member Renamed Kitchen' }),
    });
    const problem = await captureProblem(() => handlePatchHousehold(req, ctx));
    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.status).toBe(403);
    expect(problem.code).toBe('not_household_owner');
    expect(householdUpdates).toHaveLength(0);
  });

  it('lets an OWNER rename the household and returns 200', async () => {
    const { ctx, householdUpdates } = makeContext({ role: 'OWNER' });
    const req = new Request('http://localhost/api/household', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Plant Pantry' }),
    });
    const res = await handlePatchHousehold(req, ctx);
    expect(res.status).toBe(200);
    expect(householdUpdates).toHaveLength(1);
    expect(householdUpdates[0]!.data.name).toBe('Plant Pantry');
  });
});

describe('handlePostHouseholdInvitation role guard', () => {
  it('rejects a MEMBER with 403 before reading the body (403 wins over invalid JSON 422)', async () => {
    const { ctx, invitationCreates } = makeContext({ role: 'MEMBER' });
    const req = new Request('http://localhost/api/household/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": not-valid-json',
    });
    const problem = await captureProblem(() => handlePostHouseholdInvitation(req, ctx));
    expect(problem).toBeInstanceOf(ApiProblem);
    expect(problem.status).toBe(403);
    expect(problem.code).toBe('not_household_owner');
    expect(invitationCreates).toHaveLength(0);
  });

  it('returns 201 for an OWNER posting a valid body', async () => {
    const { ctx, invitationCreates } = makeContext({ role: 'OWNER' });
    const req = new Request('http://localhost/api/household/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Friend@Integration.Test' }),
    });
    const res = await handlePostHouseholdInvitation(req, ctx);
    expect(res.status).toBe(201);
    expect(invitationCreates).toHaveLength(1);
    expect(invitationCreates[0]!.data.email).toBe('friend@integration.test');
    expect(invitationCreates[0]!.data.householdId).toBe(ctx.householdId);
    const body = (await res.json()) as { token: string; householdId: string };
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.householdId).toBe(ctx.householdId);
  });
});
