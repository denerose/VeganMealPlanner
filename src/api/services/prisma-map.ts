import { Prisma } from '@prisma/client';
import { ApiProblem } from '../api-problem';

export function rethrowPrisma(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      throw new ApiProblem(409, 'conflict', 'Unique constraint violated');
    }
    if (e.code === 'P2003') {
      throw new ApiProblem(409, 'in_use', 'Operation blocked by an existing reference');
    }
    if (e.code === 'P2025') {
      throw new ApiProblem(404, 'not_found', 'Record not found');
    }
  }
  throw e;
}
