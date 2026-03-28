import { prisma } from '../../../src/lib/prisma';

export interface SeedHouseholdUserResult {
  userId: string;
  householdId: string;
  suffix: string;
}

/** Creates an isolated household + user + single membership (cleanup via returned ids). */
export async function seedHouseholdUser(): Promise<SeedHouseholdUserResult> {
  const suffix = crypto.randomUUID();
  const household = await prisma.household.create({ data: { name: `H-${suffix}` } });
  const user = await prisma.user.create({ data: { displayName: `U-${suffix}` } });
  await prisma.householdMembership.create({
    data: { userId: user.id, householdId: household.id },
  });
  return { userId: user.id, householdId: household.id, suffix };
}
