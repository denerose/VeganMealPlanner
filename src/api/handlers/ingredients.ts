import { Prisma, type IngredientStorageType } from '@prisma/client';
import type { IngredientCreateDto, IngredientUpdateDto } from '../../domain/dtos/ingredient';
import type { ApiContext } from './me-household';
import { readJsonBody, parseLimitOffset } from '../parse';
import { normalizeIngredientName } from '../../domain/lib/normalize-ingredient-name';
import { ApiProblem } from '../api-problem';
import { rethrowPrisma } from '../services/prisma-map';

function toResponse(row: {
  id: string;
  householdId: string;
  name: string;
  storageType: IngredientStorageType;
  perishable: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    storageType: row.storageType,
    perishable: row.perishable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function handleListIngredients(url: URL, ctx: ApiContext): Promise<Response> {
  const { limit, offset } = parseLimitOffset(url);
  const rows = await ctx.prisma.ingredient.findMany({
    where: { householdId: ctx.householdId },
    orderBy: { name: 'asc' },
    take: limit,
    skip: offset,
  });
  return Response.json(rows.map(toResponse));
}

export async function handlePostIngredient(req: Request, ctx: ApiContext): Promise<Response> {
  const dto = await readJsonBody<IngredientCreateDto>(req);
  if (!dto.name?.trim()) {
    throw new ApiProblem(422, 'invalid_body', 'name is required');
  }
  if (!dto.storageType) {
    throw new ApiProblem(422, 'invalid_body', 'storageType is required');
  }
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
    return Response.json(toResponse(row), { status: 201 });
  } catch (e) {
    rethrowPrisma(e);
  }
}

export async function handleGetIngredient(
  ingredientId: string,
  ctx: ApiContext
): Promise<Response> {
  const row = await ctx.prisma.ingredient.findFirst({
    where: { id: ingredientId, householdId: ctx.householdId },
  });
  if (!row) {
    throw new ApiProblem(404, 'not_found', 'Ingredient not found');
  }
  return Response.json(toResponse(row));
}

export async function handlePatchIngredient(
  ingredientId: string,
  req: Request,
  ctx: ApiContext
): Promise<Response> {
  const dto = await readJsonBody<IngredientUpdateDto>(req);
  const existing = await ctx.prisma.ingredient.findFirst({
    where: { id: ingredientId, householdId: ctx.householdId },
  });
  if (!existing) {
    throw new ApiProblem(404, 'not_found', 'Ingredient not found');
  }
  const data: {
    name?: string;
    storageType?: IngredientStorageType;
    perishable?: boolean;
  } = {};
  if (dto.name !== undefined) {
    if (!dto.name.trim()) throw new ApiProblem(422, 'invalid_body', 'name must not be empty');
    data.name = normalizeIngredientName(dto.name);
  }
  if (dto.storageType !== undefined) data.storageType = dto.storageType;
  if (dto.perishable !== undefined) data.perishable = dto.perishable;
  try {
    const row = await ctx.prisma.ingredient.update({
      where: { id: ingredientId },
      data,
    });
    return Response.json(toResponse(row));
  } catch (e) {
    rethrowPrisma(e);
  }
}

export async function handleDeleteIngredient(
  ingredientId: string,
  ctx: ApiContext
): Promise<Response> {
  const existing = await ctx.prisma.ingredient.findFirst({
    where: { id: ingredientId, householdId: ctx.householdId },
  });
  if (!existing) {
    throw new ApiProblem(404, 'not_found', 'Ingredient not found');
  }
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
