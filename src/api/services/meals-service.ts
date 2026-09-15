import { Prisma, type PrismaClient } from '@prisma/client';
import { type MealMapperMealRow, toMealResponseDto } from '../../domain/mappers/meal-mapper';
import type { ApiContext } from '../handlers/me-household';
import {
  collectHeroIngredientIds,
  parseBoolQuery,
  parseLimitOffset,
  parseYmdParam,
} from '../parse';
import { ApiProblem } from '../api-problem';
import { rethrowPrisma } from './prisma-map';
import { requireScoped } from './require-scoped';
import { isUuid } from '../uuid';
import type { MealCreateDto, MealQualitiesDto, MealUpdateDto } from '../../domain/dtos/meal';
import { readJsonBody } from '../parse';
import { previousPlanYmd, nextPlanYmd } from '../../domain/lib/adjacent-plan-dates';
import { planDateFromYmd } from '../../domain/lib/plan-date';
import { toIngredientId, toUserId, type IngredientId } from '../../domain/types/ids';
import {
  asObject,
  optionalNullableString,
  optionalString,
  optionalStringArray,
  requiredString,
  type JsonBody,
} from '../validate';

const HERO_SPECS_MESSAGE =
  'heroIngredientIds must be an array of { ingredientId, sortOrder? } objects';

function parseHeroSpecs(v: unknown): { ingredientId: IngredientId; sortOrder?: number }[] {
  if (!Array.isArray(v)) {
    throw new ApiProblem(422, 'invalid_body', HERO_SPECS_MESSAGE);
  }
  return v.map((h) => {
    if (h === null || typeof h !== 'object' || Array.isArray(h)) {
      throw new ApiProblem(422, 'invalid_body', HERO_SPECS_MESSAGE);
    }
    const o = h as JsonBody;
    const ingredientId = o.ingredientId;
    const sortOrder = o.sortOrder;
    if (
      typeof ingredientId !== 'string' ||
      (sortOrder !== undefined && typeof sortOrder !== 'number')
    ) {
      throw new ApiProblem(422, 'invalid_body', HERO_SPECS_MESSAGE);
    }
    return sortOrder === undefined
      ? { ingredientId: toIngredientId(ingredientId) }
      : { ingredientId: toIngredientId(ingredientId), sortOrder };
  });
}

function parseQualities(v: unknown): Partial<MealQualitiesDto> | undefined {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw new ApiProblem(422, 'invalid_body', 'qualities must be an object');
  }
  const o = v as JsonBody;
  const flag = (name: keyof MealQualitiesDto): boolean | undefined => {
    const raw = o[name];
    if (raw === undefined) return undefined;
    if (typeof raw !== 'boolean') {
      throw new ApiProblem(422, 'invalid_body', `qualities.${name} must be a boolean`);
    }
    return raw;
  };
  return {
    makesLeftovers: flag('makesLeftovers'),
    isGreasy: flag('isGreasy'),
    isCreamy: flag('isCreamy'),
    isAcidic: flag('isAcidic'),
  };
}

/** Validates meal create JSON; @throws ApiProblem(422) on bad bodies. */
export function parseMealCreate(body: unknown): MealCreateDto {
  const o = asObject(body);
  return {
    name: requiredString(o, 'name'),
    description: optionalString(o, 'description'),
    recipeUrl: optionalNullableString(o, 'recipeUrl'),
    imageId: optionalNullableString(o, 'imageId'),
    qualities: parseQualities(o.qualities),
    heroIngredientIds:
      o.heroIngredientIds === undefined ? undefined : parseHeroSpecs(o.heroIngredientIds),
    cookedByUserIds: optionalStringArray(o, 'cookedByUserIds')?.map(toUserId),
  };
}

/** Validates meal update JSON; @throws ApiProblem(422) on bad bodies. */
export function parseMealUpdate(body: unknown): MealUpdateDto {
  const o = asObject(body);
  return {
    name: optionalString(o, 'name'),
    description: optionalString(o, 'description'),
    recipeUrl: optionalNullableString(o, 'recipeUrl'),
    imageId: optionalNullableString(o, 'imageId'),
    qualities: parseQualities(o.qualities),
    heroIngredientIds:
      o.heroIngredientIds === undefined ? undefined : parseHeroSpecs(o.heroIngredientIds),
    cookedByUserIds: optionalStringArray(o, 'cookedByUserIds')?.map(toUserId),
  };
}

function toMealMapperRow(m: {
  id: string;
  householdId: string;
  name: string;
  description: string;
  recipeUrl: string | null;
  imageId: string | null;
  makesLeftovers: boolean;
  isGreasy: boolean;
  isCreamy: boolean;
  isAcidic: boolean;
  createdAt: Date;
  updatedAt: Date;
}): MealMapperMealRow {
  return {
    id: m.id,
    householdId: m.householdId,
    name: m.name,
    description: m.description,
    recipeUrl: m.recipeUrl,
    imageId: m.imageId,
    makesLeftovers: m.makesLeftovers,
    isGreasy: m.isGreasy,
    isCreamy: m.isCreamy,
    isAcidic: m.isAcidic,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

async function assertUsersInHousehold(
  prisma: PrismaClient,
  householdId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  const unique = [...new Set(userIds)];
  const n = await prisma.householdMembership.count({
    where: { householdId, userId: { in: unique } },
  });
  if (n !== unique.length) {
    throw new ApiProblem(422, 'cooked_by_invalid', 'cookedByUserIds must be household members');
  }
}

async function assertIngredientsInHousehold(
  prisma: PrismaClient,
  householdId: string,
  ingredientIds: string[]
): Promise<void> {
  if (ingredientIds.length === 0) return;
  const unique = [...new Set(ingredientIds)];
  const n = await prisma.ingredient.count({
    where: { householdId, id: { in: unique } },
  });
  if (n !== unique.length) {
    throw new ApiProblem(
      422,
      'invalid_hero_ingredient',
      'heroIngredientIds must belong to household'
    );
  }
}

async function loadMealBundle(prisma: PrismaClient, householdId: string, mealId: string) {
  const meal = await prisma.meal.findFirst({
    where: { id: mealId, householdId },
    include: {
      heroIngredients: {
        include: { ingredient: true },
      },
      cookedBy: true,
    },
  });
  if (!meal) return null;
  return {
    meal,
    heroRows: meal.heroIngredients.map((h) => ({
      sortOrder: h.sortOrder,
      ingredient: h.ingredient,
    })),
    cookedByUserIds: meal.cookedBy.map((c) => c.userId),
  };
}

function mealWhereFromUrl(url: URL, householdId: string): Prisma.MealWhereInput {
  const where: Prisma.MealWhereInput = { householdId };
  const flags = ['makesLeftovers', 'isGreasy', 'isCreamy', 'isAcidic'] as const;
  for (const f of flags) {
    const v = parseBoolQuery(url.searchParams.get(f));
    if (v === true || v === false) {
      where[f] = v;
    }
  }
  const heroIds = collectHeroIngredientIds(url.searchParams);
  for (const id of heroIds) {
    if (!isUuid(id)) {
      throw new ApiProblem(422, 'invalid_query', `heroIngredientId must be a valid UUID: ${id}`);
    }
  }
  if (heroIds.length > 0) {
    where.AND = heroIds.map((id) => ({
      heroIngredients: { some: { ingredientId: id } },
    }));
  }
  return where;
}

export async function listMeals(url: URL, ctx: ApiContext): Promise<Response> {
  const { limit, offset } = parseLimitOffset(url);
  const where = mealWhereFromUrl(url, ctx.householdId);
  const meals = await ctx.prisma.meal.findMany({
    where,
    orderBy: { name: 'asc' },
    take: limit,
    skip: offset,
    include: {
      heroIngredients: { include: { ingredient: true } },
      cookedBy: true,
    },
  });
  const body = meals.map((m) => {
    const { heroIngredients: hh, cookedBy: cb } = m;
    return toMealResponseDto({
      meal: toMealMapperRow(m),
      heroRows: hh.map((h) => ({
        sortOrder: h.sortOrder,
        ingredient: h.ingredient,
      })),
      cookedByUserIds: cb.map((c) => c.userId),
    });
  });
  return Response.json(body);
}

export async function getMeal(mealId: string, ctx: ApiContext): Promise<Response> {
  const bundle = await loadMealBundle(ctx.prisma, ctx.householdId, mealId);
  if (!bundle) {
    throw new ApiProblem(404, 'not_found', 'Meal not found');
  }
  return Response.json(
    toMealResponseDto({
      meal: toMealMapperRow(bundle.meal),
      heroRows: bundle.heroRows,
      cookedByUserIds: bundle.cookedByUserIds,
    })
  );
}

export async function createMeal(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = parseMealCreate(await readJsonBody<unknown>(req));
  const heroSpecs = dto.heroIngredientIds ?? [];
  const cooked = dto.cookedByUserIds ?? [];
  await assertIngredientsInHousehold(
    ctx.prisma,
    ctx.householdId,
    heroSpecs.map((h) => h.ingredientId)
  );
  await assertUsersInHousehold(ctx.prisma, ctx.householdId, cooked);
  const q = dto.qualities ?? {};
  try {
    const meal = await ctx.prisma.$transaction(async (tx) => {
      const m = await tx.meal.create({
        data: {
          householdId: ctx.householdId,
          name: dto.name.trim(),
          description: dto.description ?? '',
          recipeUrl: dto.recipeUrl ?? undefined,
          imageId: dto.imageId ?? undefined,
          makesLeftovers: q.makesLeftovers ?? false,
          isGreasy: q.isGreasy ?? false,
          isCreamy: q.isCreamy ?? false,
          isAcidic: q.isAcidic ?? false,
        },
      });
      for (const h of heroSpecs) {
        await tx.mealHeroIngredient.create({
          data: {
            mealId: m.id,
            ingredientId: h.ingredientId,
            sortOrder: h.sortOrder ?? 0,
          },
        });
      }
      for (const uid of cooked) {
        await tx.mealCookedBy.create({
          data: { mealId: m.id, userId: uid },
        });
      }
      return m;
    });
    const bundle = await loadMealBundle(ctx.prisma, ctx.householdId, meal.id);
    if (!bundle) throw new Error('meal missing after create');
    return Response.json(
      toMealResponseDto({
        meal: toMealMapperRow(bundle.meal),
        heroRows: bundle.heroRows,
        cookedByUserIds: bundle.cookedByUserIds,
      }),
      { status: 201 }
    );
  } catch (e) {
    rethrowPrisma(e);
  }
}

export async function updateMeal(mealId: string, req: Request, ctx: ApiContext): Promise<Response> {
  const dto = parseMealUpdate(await readJsonBody<unknown>(req));
  await requireScoped('Meal', () =>
    ctx.prisma.meal.findFirst({
      where: { id: mealId, householdId: ctx.householdId },
    })
  );
  if (dto.cookedByUserIds) {
    await assertUsersInHousehold(ctx.prisma, ctx.householdId, dto.cookedByUserIds);
  }
  if (dto.heroIngredientIds) {
    await assertIngredientsInHousehold(
      ctx.prisma,
      ctx.householdId,
      dto.heroIngredientIds.map((h) => h.ingredientId)
    );
  }
  const q = dto.qualities;
  const data: Prisma.MealUpdateInput = {};
  if (dto.name !== undefined) data.name = dto.name.trim();
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.recipeUrl !== undefined) data.recipeUrl = dto.recipeUrl;
  if (dto.imageId !== undefined) data.imageId = dto.imageId;
  if (q?.makesLeftovers !== undefined) data.makesLeftovers = q.makesLeftovers;
  if (q?.isGreasy !== undefined) data.isGreasy = q.isGreasy;
  if (q?.isCreamy !== undefined) data.isCreamy = q.isCreamy;
  if (q?.isAcidic !== undefined) data.isAcidic = q.isAcidic;
  try {
    await ctx.prisma.$transaction(async (tx) => {
      await tx.meal.update({
        where: { id: mealId },
        data,
      });
      if (dto.heroIngredientIds) {
        await tx.mealHeroIngredient.deleteMany({ where: { mealId } });
        for (const h of dto.heroIngredientIds) {
          await tx.mealHeroIngredient.create({
            data: {
              mealId,
              ingredientId: h.ingredientId,
              sortOrder: h.sortOrder ?? 0,
            },
          });
        }
      }
      if (dto.cookedByUserIds) {
        await tx.mealCookedBy.deleteMany({ where: { mealId } });
        for (const uid of dto.cookedByUserIds) {
          await tx.mealCookedBy.create({ data: { mealId, userId: uid } });
        }
      }
    });
    const bundle = await loadMealBundle(ctx.prisma, ctx.householdId, mealId);
    if (!bundle) throw new Error('meal missing after update');
    return Response.json(
      toMealResponseDto({
        meal: toMealMapperRow(bundle.meal),
        heroRows: bundle.heroRows,
        cookedByUserIds: bundle.cookedByUserIds,
      })
    );
  } catch (e) {
    rethrowPrisma(e);
  }
}

export async function deleteMeal(mealId: string, ctx: ApiContext): Promise<Response> {
  await requireScoped('Meal', () =>
    ctx.prisma.meal.findFirst({
      where: { id: mealId, householdId: ctx.householdId },
    })
  );
  try {
    await ctx.prisma.meal.delete({ where: { id: mealId } });
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiProblem(409, 'meal_in_use', 'Meal is referenced by a day plan');
    }
    rethrowPrisma(e);
  }
}

export async function randomMeal(url: URL, ctx: ApiContext): Promise<Response> {
  const date = parseYmdParam('date', url.searchParams.get('date'));
  const prev = previousPlanYmd(date);
  const next = nextPlanYmd(date);
  const adj = await ctx.prisma.dayPlan.findMany({
    where: {
      householdId: ctx.householdId,
      date: { in: [planDateFromYmd(prev), planDateFromYmd(next)] },
    },
  });
  const exclude = new Set<string>();
  for (const p of adj) {
    if (p.dinnerMealId) exclude.add(p.dinnerMealId);
  }
  const filterWhere = mealWhereFromUrl(url, ctx.householdId);
  const where: Prisma.MealWhereInput =
    exclude.size > 0 ? { AND: [filterWhere, { id: { notIn: [...exclude] } }] } : filterWhere;
  const candidates = await ctx.prisma.meal.findMany({
    where,
    select: { id: true },
  });
  if (candidates.length === 0) {
    throw new ApiProblem(404, 'no_eligible_meals', 'No meals available after exclusions');
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!.id;
  return getMeal(pick, ctx);
}
