import { Prisma, type PrismaClient } from '@prisma/client';
import { toDayPlanResponseDto } from '../../domain/mappers/day-plan-mapper';
import { planDateFromYmd } from '../../domain/lib/plan-date';
import type { ApiContext } from '../handlers/me-household';
import { readJsonBody, parseDayPlanRange } from '../parse';
import { ApiProblem } from '../api-problem';
import type { DayPlanCreateDto, DayPlanUpdateDto } from '../../domain/dtos/day-plan';
import { rethrowPrisma } from './prisma-map';
import { requireScoped } from './require-scoped';
import { toMealId } from '../../domain/types/ids';
import { asObject, optionalNullableString, type JsonBody } from '../validate';

const DATE_MESSAGE = 'date must be YYYY-MM-DD';

function isValidYmd(value: string): boolean {
  try {
    planDateFromYmd(value);
    return true;
  } catch {
    return false;
  }
}

function parseMealIdField(o: JsonBody, field: string) {
  const v = optionalNullableString(o, field);
  return v === undefined || v === null ? v : toMealId(v);
}

/** Validates day-plan create JSON; @throws ApiProblem(422) on bad bodies. */
export function parseDayPlanCreate(body: unknown): DayPlanCreateDto {
  const o = asObject(body);
  const date = o.date;
  if (typeof date !== 'string' || !isValidYmd(date)) {
    throw new ApiProblem(422, 'invalid_body', DATE_MESSAGE);
  }
  return {
    date,
    lunchMealId: parseMealIdField(o, 'lunchMealId'),
    dinnerMealId: parseMealIdField(o, 'dinnerMealId'),
  };
}

/** Validates day-plan update JSON; @throws ApiProblem(422) on bad bodies. */
export function parseDayPlanUpdate(body: unknown): DayPlanUpdateDto {
  const o = asObject(body);
  return {
    lunchMealId: parseMealIdField(o, 'lunchMealId'),
    dinnerMealId: parseMealIdField(o, 'dinnerMealId'),
  };
}

/** Validates day-plan bulk JSON; @throws ApiProblem(422) on bad bodies. */
export function parseDayPlanBulk(body: unknown): DayPlanCreateDto[] {
  if (!Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_body', 'Body must be a JSON array');
  }
  return body.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiProblem(422, 'invalid_body', 'each item must be a JSON object');
    }
    const o = item as JsonBody;
    const date = o.date;
    if (typeof date !== 'string' || !isValidYmd(date)) {
      throw new ApiProblem(422, 'invalid_body', `Invalid date: ${date}`);
    }
    return {
      date,
      lunchMealId: parseMealIdField(o, 'lunchMealId'),
      dinnerMealId: parseMealIdField(o, 'dinnerMealId'),
    };
  });
}

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
  const dto = parseDayPlanCreate(await readJsonBody<unknown>(req));
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
  const body = parseDayPlanBulk(await readJsonBody<unknown>(req));
  const mealIds = new Set<string>();
  const seenDates = new Set<string>();
  for (const item of body) {
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
  const row = await requireScoped('Day plan', () =>
    ctx.prisma.dayPlan.findFirst({
      where: { id, householdId: ctx.householdId },
    })
  );
  return Response.json(toDayPlanResponseDto(row));
}

export async function patchDayPlan(id: string, req: Request, ctx: ApiContext): Promise<Response> {
  const dto = parseDayPlanUpdate(await readJsonBody<unknown>(req));
  await requireScoped('Day plan', () =>
    ctx.prisma.dayPlan.findFirst({
      where: { id, householdId: ctx.householdId },
    })
  );
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
  await requireScoped('Day plan', () =>
    ctx.prisma.dayPlan.findFirst({
      where: { id, householdId: ctx.householdId },
    })
  );
  await ctx.prisma.dayPlan.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
