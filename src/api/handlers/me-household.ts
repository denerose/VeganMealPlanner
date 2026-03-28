import type { PrismaClient } from '@prisma/client';
import type { HouseholdPatchDto, MeResponseDto, UserPatchDto } from '../../domain/dtos/user';
import { toHouseholdId, toUserId } from '../../domain/types/ids';
import { readJsonBody } from '../parse';
import { ApiProblem } from '../api-problem';

export interface ApiContext {
  prisma: PrismaClient;
  userId: string;
  householdId: string;
}

export async function handleGetMe(ctx: ApiContext): Promise<Response> {
  const row = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
    include: {
      memberships: {
        where: { householdId: ctx.householdId },
        include: { household: true },
      },
    },
  });
  if (!row) {
    throw new ApiProblem(404, 'not_found', 'User not found');
  }
  const m = row.memberships[0];
  if (!m?.household) {
    throw new ApiProblem(403, 'user_not_in_household', 'User has no household membership');
  }
  const h = m.household;
  const body: MeResponseDto = {
    user: {
      id: toUserId(row.id),
      displayName: row.displayName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    household: {
      id: toHouseholdId(h.id),
      name: h.name,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    },
  };
  return Response.json(body);
}

export async function handlePatchMe(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = await readJsonBody<UserPatchDto>(req);
  const updated = await ctx.prisma.user.update({
    where: { id: ctx.userId },
    data: {
      displayName: dto.displayName === undefined ? undefined : dto.displayName,
    },
  });
  return Response.json({
    id: updated.id,
    displayName: updated.displayName,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function handleGetHousehold(ctx: ApiContext): Promise<Response> {
  const h = await ctx.prisma.household.findUniqueOrThrow({
    where: { id: ctx.householdId },
  });
  return Response.json({
    id: h.id,
    name: h.name,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  });
}

export async function handlePatchHousehold(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = await readJsonBody<HouseholdPatchDto>(req);
  const h = await ctx.prisma.household.update({
    where: { id: ctx.householdId },
    data: {
      name: dto.name === undefined ? undefined : dto.name,
    },
  });
  return Response.json({
    id: h.id,
    name: h.name,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  });
}

export async function handleGetHouseholdMembers(ctx: ApiContext): Promise<Response> {
  const members = await ctx.prisma.householdMembership.findMany({
    where: { householdId: ctx.householdId },
    include: { user: true },
  });
  return Response.json(
    members.map((m) => ({
      userId: m.userId,
      displayName: m.user.displayName,
    }))
  );
}
