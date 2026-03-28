import { Prisma, type PrismaClient } from '@prisma/client';
import { toDayPlanResponseDto } from '../../domain/mappers/day-plan-mapper';
import { planDateFromYmd } from '../../domain/lib/plan-date';
import type { ApiContext } from '../handlers/me-household';
import { readJsonBody, parseDayPlanRange } from '../parse';
import { ApiProblem } from '../api-problem';
import type { DayPlanCreateDto, DayPlanUpdateDto } from '../../domain/dtos/day-plan';
import { rethrowPrisma } from './prisma-map';

async function assertMealsOptional(
  prisma: PrismaClient,
  householdId: string,
  lunchId: string | null | undefined,
  dinnerId: string | null | undefined
): Promise<void> {
  const ids = [...new Set([lunchId, dinnerId].filter((x): x is string => x != null && x !== ''))];
  if (ids.length === 0) return;
  const n = await prisma.meal.count({
    where: { householdId, id: { in: ids } },
  });
  if (n !== ids.length) {
    throw new ApiProblem(422, 'invalid_meal', 'Meal ids must belong to the household');
  }
}

export async function listDayPlans(url: URL, ctx: ApiContext): Promise<Response> {
  const { from, to } = parseDayPlanRange(url);
  const rows = await ctx.prisma.dayPlan.findMany({
    where: {
      householdId: ctx.householdId,
      date: { gte: planDateFromYmd(from), lte: planDateFromYmd(to) },
    },
    orderBy: { date: 'asc' },
  });
  return Response.json(rows.map(toDayPlanResponseDto));
}

export async function createDayPlan(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = await readJsonBody<DayPlanCreateDto>(req);
  try {
    planDateFromYmd(dto.date);
  } catch {
    throw new ApiProblem(422, 'invalid_body', 'date must be YYYY-MM-DD');
  }
  await assertMealsOptional(ctx.prisma, ctx.householdId, dto.lunchMealId, dto.dinnerMealId);
  try {
    const row = await ctx.prisma.dayPlan.create({
      data: {
        householdId: ctx.householdId,
        date: planDateFromYmd(dto.date),
        lunchMealId: dto.lunchMealId !== undefined ? dto.lunchMealId : null,
        dinnerMealId: dto.dinnerMealId !== undefined ? dto.dinnerMealId : null,
      },
    });
    return Response.json(toDayPlanResponseDto(row), { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiProblem(409, 'conflict', 'Day plan already exists for this date');
    }
    rethrowPrisma(e);
  }
}

export async function bulkUpsertDayPlans(req: Request, ctx: ApiContext): Promise<Response> {
  const body = await readJsonBody<DayPlanCreateDto[]>(req);
  if (!Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_body', 'Body must be a JSON array');
  }
  const mealIds = new Set<string>();
  const seenDates = new Set<string>();
  for (const item of body) {
    try {
      planDateFromYmd(item.date);
    } catch {
      throw new ApiProblem(422, 'invalid_body', `Invalid date: ${item.date}`);
    }
    if (seenDates.has(item.date)) {
      throw new ApiProblem(422, 'invalid_body', 'Duplicate date in bulk request');
    }
    seenDates.add(item.date);
    if (item.lunchMealId) mealIds.add(item.lunchMealId);
    if (item.dinnerMealId) mealIds.add(item.dinnerMealId);
  }
  const mealIdList = [...mealIds];
  if (mealIdList.length > 0) {
    const n = await ctx.prisma.meal.count({
      where: { householdId: ctx.householdId, id: { in: mealIdList } },
    });
    if (n !== mealIdList.length) {
      throw new ApiProblem(422, 'invalid_meal', 'Meal ids must belong to the household');
    }
  }
  try {
    const rows = await ctx.prisma.$transaction(
      body.map((item) => {
        const update: Prisma.DayPlanUncheckedUpdateInput = {};
        if (item.lunchMealId !== undefined) {
          update.lunchMealId = item.lunchMealId;
        }
        if (item.dinnerMealId !== undefined) {
          update.dinnerMealId = item.dinnerMealId;
        }
        if (Object.keys(update).length === 0) {
          update.updatedAt = new Date();
        }
        return ctx.prisma.dayPlan.upsert({
          where: {
            householdId_date: {
              householdId: ctx.householdId,
              date: planDateFromYmd(item.date),
            },
          },
          create: {
            householdId: ctx.householdId,
            date: planDateFromYmd(item.date),
            lunchMealId: item.lunchMealId !== undefined ? item.lunchMealId : null,
            dinnerMealId: item.dinnerMealId !== undefined ? item.dinnerMealId : null,
          },
          update,
        });
      })
    );
    return Response.json(rows.map(toDayPlanResponseDto));
  } catch (e) {
    rethrowPrisma(e);
  }
}

export async function getDayPlan(id: string, ctx: ApiContext): Promise<Response> {
  const row = await ctx.prisma.dayPlan.findFirst({
    where: { id, householdId: ctx.householdId },
  });
  if (!row) throw new ApiProblem(404, 'not_found', 'Day plan not found');
  return Response.json(toDayPlanResponseDto(row));
}

export async function patchDayPlan(id: string, req: Request, ctx: ApiContext): Promise<Response> {
  const dto = await readJsonBody<DayPlanUpdateDto>(req);
  const existing = await ctx.prisma.dayPlan.findFirst({
    where: { id, householdId: ctx.householdId },
  });
  if (!existing) throw new ApiProblem(404, 'not_found', 'Day plan not found');
  await assertMealsOptional(ctx.prisma, ctx.householdId, dto.lunchMealId, dto.dinnerMealId);
  const row = await ctx.prisma.dayPlan.update({
    where: { id },
    data: {
      lunchMealId: dto.lunchMealId === undefined ? undefined : dto.lunchMealId,
      dinnerMealId: dto.dinnerMealId === undefined ? undefined : dto.dinnerMealId,
    },
  });
  return Response.json(toDayPlanResponseDto(row));
}

export async function deleteDayPlan(id: string, ctx: ApiContext): Promise<Response> {
  const existing = await ctx.prisma.dayPlan.findFirst({
    where: { id, householdId: ctx.householdId },
  });
  if (!existing) throw new ApiProblem(404, 'not_found', 'Day plan not found');
  await ctx.prisma.dayPlan.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
