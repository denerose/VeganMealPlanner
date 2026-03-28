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
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@integration.test`,
      displayName: `U-${suffix}`,
    },
  });
  await prisma.householdMembership.create({
    data: { userId: user.id, householdId: household.id, role: 'OWNER' },
  });
  return { userId: user.id, householdId: household.id, suffix };
}

/**
 * Deletes day plans, meals, and ingredients for a household so the next test starts clean.
 * Keeps the household, membership, and user (use between tests in a describe block).
 */
export async function resetHouseholdIntegrationData(householdId: string): Promise<void> {
  await prisma.dayPlan.deleteMany({ where: { householdId } });
  await prisma.meal.deleteMany({ where: { householdId } });
  await prisma.ingredient.deleteMany({ where: { householdId } });
}

/** Removes membership, user, and household after optional reset (safe if already empty). */
export async function teardownHouseholdUser(seed: SeedHouseholdUserResult): Promise<void> {
  await resetHouseholdIntegrationData(seed.householdId);
  await prisma.householdMembership.deleteMany({ where: { householdId: seed.householdId } });
  await prisma.user.delete({ where: { id: seed.userId } });
  await prisma.household.delete({ where: { id: seed.householdId } });
}
