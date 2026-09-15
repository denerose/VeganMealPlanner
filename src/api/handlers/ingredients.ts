import { Prisma, type IngredientStorageType } from '@prisma/client';
import type { IngredientCreateDto, IngredientUpdateDto } from '../../domain/dtos/ingredient';
import { toIngredientResponseDto } from '../../domain/mappers/ingredient-mapper';
import type { ApiContext } from './me-household';
import { readJsonBody, parseLimitOffset } from '../parse';
import { normalizeIngredientName } from '../../domain/lib/normalize-ingredient-name';
import { INGREDIENT_STORAGE_TYPES } from '../../domain/types/enums';
import { ApiProblem } from '../api-problem';
import {
  asObject,
  optionalBoolean,
  optionalEnum,
  optionalString,
  requiredEnum,
  requiredString,
} from '../validate';
import { rethrowPrisma } from '../services/prisma-map';
import { requireScoped } from '../services/require-scoped';

/** Validates ingredient create JSON; @throws ApiProblem(422) on bad bodies. */
export function parseIngredientCreate(body: unknown): IngredientCreateDto {
  const o = asObject(body);
  return {
    name: requiredString(o, 'name'),
    storageType: requiredEnum(o, 'storageType', INGREDIENT_STORAGE_TYPES),
    perishable: optionalBoolean(o, 'perishable'),
  };
}

/** Validates ingredient update JSON; @throws ApiProblem(422) on bad bodies. */
export function parseIngredientUpdate(body: unknown): IngredientUpdateDto {
  const o = asObject(body);
  const dto: IngredientUpdateDto = {};
  const name = optionalString(o, 'name');
  if (name !== undefined) {
    if (name.trim() === '') throw new ApiProblem(422, 'invalid_body', 'name must not be empty');
    dto.name = name;
  }
  const storageType = optionalEnum(o, 'storageType', INGREDIENT_STORAGE_TYPES);
  if (storageType !== undefined) dto.storageType = storageType;
  const perishable = optionalBoolean(o, 'perishable');
  if (perishable !== undefined) dto.perishable = perishable;
  return dto;
}

export async function handleListIngredients(url: URL, ctx: ApiContext): Promise<Response> {
  const { limit, offset } = parseLimitOffset(url);
  const rows = await ctx.prisma.ingredient.findMany({
    where: { householdId: ctx.householdId },
    orderBy: { name: 'asc' },
    take: limit,
    skip: offset,
  });
  return Response.json(rows.map(toIngredientResponseDto));
}

export async function handlePostIngredient(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = parseIngredientCreate(await readJsonBody<unknown>(req));
  const normalized = normalizeIngredientName(dto.name);
  try {
    const row = await ctx.prisma.ingredient.create({
      data: {
        householdId: ctx.householdId,
        name: normalized,
        storageType: dto.storageType,
        perishable: dto.perishable ?? false,
      },
    });
    return Response.json(toIngredientResponseDto(row), { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiProblem(
        409,
        'ingredient_name_conflict',
        'An ingredient with this name already exists in the household'
      );
    }
    rethrowPrisma(e);
  }
}

export async function handleGetIngredient(
  ingredientId: string,
  ctx: ApiContext
): Promise<Response> {
  const row = await requireScoped('Ingredient', () =>
    ctx.prisma.ingredient.findFirst({
      where: { id: ingredientId, householdId: ctx.householdId },
    })
  );
  return Response.json(toIngredientResponseDto(row));
}

export async function handlePatchIngredient(
  ingredientId: string,
  req: Request,
  ctx: ApiContext
): Promise<Response> {
  const dto = parseIngredientUpdate(await readJsonBody<unknown>(req));
  await requireScoped('Ingredient', () =>
    ctx.prisma.ingredient.findFirst({
      where: { id: ingredientId, householdId: ctx.householdId },
    })
  );
  const data: {
    name?: string;
    storageType?: IngredientStorageType;
    perishable?: boolean;
  } = {};
  if (dto.name !== undefined) data.name = normalizeIngredientName(dto.name);
  if (dto.storageType !== undefined) data.storageType = dto.storageType;
  if (dto.perishable !== undefined) data.perishable = dto.perishable;
  try {
    const row = await ctx.prisma.ingredient.update({
      where: { id: ingredientId },
      data,
    });
    return Response.json(toIngredientResponseDto(row));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiProblem(
        409,
        'ingredient_name_conflict',
        'An ingredient with this name already exists in the household'
      );
    }
    rethrowPrisma(e);
  }
}

export async function handleDeleteIngredient(
  ingredientId: string,
  ctx: ApiContext
): Promise<Response> {
  await requireScoped('Ingredient', () =>
    ctx.prisma.ingredient.findFirst({
      where: { id: ingredientId, householdId: ctx.householdId },
    })
  );
  try {
    await ctx.prisma.ingredient.delete({ where: { id: ingredientId } });
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
      throw new ApiProblem(409, 'ingredient_in_use', 'Ingredient is used as a meal hero');
    }
    rethrowPrisma(e);
  }
}
