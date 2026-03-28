import type { PrismaClient } from '@prisma/client';
import { ApiProblem } from '../api-problem';

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
