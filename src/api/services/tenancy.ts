import type { PrismaClient } from '@prisma/client';
import { ApiProblem } from '../api-problem';

/** Throws 403 `not_household_owner` unless the user is an OWNER of the household. */
export async function requireHouseholdOwner(
  prisma: PrismaClient,
  userId: string,
  householdId: string
): Promise<void> {
  const membership = await prisma.householdMembership.findFirst({
    where: { userId, householdId },
    select: { role: true },
  });
  if (!membership || membership.role !== 'OWNER') {
    throw new ApiProblem(
      403,
      'not_household_owner',
      'Only household owners can perform this action'
    );
  }
}

export async function getHouseholdForUser(
  prisma: PrismaClient,
  userId: string
): Promise<{ householdId: string }> {
  const rows = await prisma.householdMembership.findMany({
    where: { userId },
    select: { householdId: true },
  });
  if (rows.length === 0) {
    throw new ApiProblem(403, 'user_not_in_household', 'User has no household membership');
  }
  if (rows.length > 1) {
    throw new ApiProblem(
      409,
      'multiple_memberships',
      'User has more than one household membership'
    );
  }
  return { householdId: rows[0]!.householdId };
}
