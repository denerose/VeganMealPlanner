import { IngredientStorageType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/api/password';
import { normalizeEmail } from '../src/domain/lib/normalize-email';
import { planDateFromYmd } from '../src/domain/lib/plan-date';
import {
  DEV_DAYPLAN_2026_03_28_ID,
  DEV_DAYPLAN_2026_03_29_ID,
  DEV_HOUSEHOLD_ID,
  DEV_INGREDIENT_BABY_SPINACH_ID,
  DEV_INGREDIENT_COCONUT_MILK_ID,
  DEV_INGREDIENT_RED_LENTILS_ID,
  DEV_MEAL_BUDDHA_BOWL_ID,
  DEV_MEAL_LENTIL_CURRY_ID,
  DEV_USER_EMAIL,
  DEV_USER_ID,
} from '../src/dev/dev-ids';

/** Default dev login password (override with `DEV_SEED_PASSWORD`). Min 10 chars for API parity. */
const DEFAULT_DEV_SEED_PASSWORD = 'devseedveg';

async function main() {
  const plain = process.env.DEV_SEED_PASSWORD ?? DEFAULT_DEV_SEED_PASSWORD;
  const passwordHash = await hashPassword(plain);
  const email = normalizeEmail(DEV_USER_EMAIL);

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: {
      id: DEV_USER_ID,
      email,
      passwordHash,
      displayName: 'Dev Cook',
    },
    update: {
      email,
      passwordHash,
      displayName: 'Dev Cook',
    },
  });

  await prisma.household.upsert({
    where: { id: DEV_HOUSEHOLD_ID },
    create: {
      id: DEV_HOUSEHOLD_ID,
      name: 'Plant-Based Dev Home',
    },
    update: { name: 'Plant-Based Dev Home' },
  });

  await prisma.householdMembership.upsert({
    where: {
      userId_householdId: { userId: DEV_USER_ID, householdId: DEV_HOUSEHOLD_ID },
    },
    create: {
      userId: DEV_USER_ID,
      householdId: DEV_HOUSEHOLD_ID,
      role: 'OWNER',
    },
    update: { role: 'OWNER' },
  });

  await prisma.ingredient.upsert({
    where: {
      householdId_name: { householdId: DEV_HOUSEHOLD_ID, name: 'red lentils' },
    },
    create: {
      id: DEV_INGREDIENT_RED_LENTILS_ID,
      householdId: DEV_HOUSEHOLD_ID,
      name: 'red lentils',
      storageType: IngredientStorageType.PANTRY,
      perishable: false,
    },
    update: {
      storageType: IngredientStorageType.PANTRY,
      perishable: false,
    },
  });

  await prisma.ingredient.upsert({
    where: {
      householdId_name: { householdId: DEV_HOUSEHOLD_ID, name: 'baby spinach' },
    },
    create: {
      id: DEV_INGREDIENT_BABY_SPINACH_ID,
      householdId: DEV_HOUSEHOLD_ID,
      name: 'baby spinach',
      storageType: IngredientStorageType.REFRIGERATED,
      perishable: true,
    },
    update: {
      storageType: IngredientStorageType.REFRIGERATED,
      perishable: true,
    },
  });

  await prisma.ingredient.upsert({
    where: {
      householdId_name: { householdId: DEV_HOUSEHOLD_ID, name: 'coconut milk' },
    },
    create: {
      id: DEV_INGREDIENT_COCONUT_MILK_ID,
      householdId: DEV_HOUSEHOLD_ID,
      name: 'coconut milk',
      storageType: IngredientStorageType.PANTRY,
      perishable: false,
    },
    update: {
      storageType: IngredientStorageType.PANTRY,
      perishable: false,
    },
  });

  await prisma.meal.upsert({
    where: { id: DEV_MEAL_LENTIL_CURRY_ID },
    create: {
      id: DEV_MEAL_LENTIL_CURRY_ID,
      householdId: DEV_HOUSEHOLD_ID,
      name: 'Coconut lentil curry',
      description: 'Weeknight vegan curry with tomatoes, spices, and coconut milk.',
    },
    update: {
      name: 'Coconut lentil curry',
      description: 'Weeknight vegan curry with tomatoes, spices, and coconut milk.',
    },
  });

  await prisma.meal.upsert({
    where: { id: DEV_MEAL_BUDDHA_BOWL_ID },
    create: {
      id: DEV_MEAL_BUDDHA_BOWL_ID,
      householdId: DEV_HOUSEHOLD_ID,
      name: 'Rainbow buddha bowl',
      description: 'Grain bowl with greens, roasted vegetables, and tahini lemon dressing.',
    },
    update: {
      name: 'Rainbow buddha bowl',
      description: 'Grain bowl with greens, roasted vegetables, and tahini lemon dressing.',
    },
  });

  await prisma.mealHeroIngredient.upsert({
    where: {
      mealId_ingredientId: {
        mealId: DEV_MEAL_LENTIL_CURRY_ID,
        ingredientId: DEV_INGREDIENT_RED_LENTILS_ID,
      },
    },
    create: {
      mealId: DEV_MEAL_LENTIL_CURRY_ID,
      ingredientId: DEV_INGREDIENT_RED_LENTILS_ID,
      sortOrder: 0,
    },
    update: { sortOrder: 0 },
  });

  await prisma.mealHeroIngredient.upsert({
    where: {
      mealId_ingredientId: {
        mealId: DEV_MEAL_LENTIL_CURRY_ID,
        ingredientId: DEV_INGREDIENT_COCONUT_MILK_ID,
      },
    },
    create: {
      mealId: DEV_MEAL_LENTIL_CURRY_ID,
      ingredientId: DEV_INGREDIENT_COCONUT_MILK_ID,
      sortOrder: 1,
    },
    update: { sortOrder: 1 },
  });

  await prisma.mealHeroIngredient.upsert({
    where: {
      mealId_ingredientId: {
        mealId: DEV_MEAL_BUDDHA_BOWL_ID,
        ingredientId: DEV_INGREDIENT_BABY_SPINACH_ID,
      },
    },
    create: {
      mealId: DEV_MEAL_BUDDHA_BOWL_ID,
      ingredientId: DEV_INGREDIENT_BABY_SPINACH_ID,
      sortOrder: 0,
    },
    update: { sortOrder: 0 },
  });

  const date28 = planDateFromYmd('2026-03-28');
  const date29 = planDateFromYmd('2026-03-29');

  await prisma.dayPlan.upsert({
    where: {
      householdId_date: { householdId: DEV_HOUSEHOLD_ID, date: date28 },
    },
    create: {
      id: DEV_DAYPLAN_2026_03_28_ID,
      householdId: DEV_HOUSEHOLD_ID,
      date: date28,
      lunchMealId: DEV_MEAL_LENTIL_CURRY_ID,
      dinnerMealId: DEV_MEAL_BUDDHA_BOWL_ID,
    },
    update: {
      lunchMealId: DEV_MEAL_LENTIL_CURRY_ID,
      dinnerMealId: DEV_MEAL_BUDDHA_BOWL_ID,
    },
  });

  await prisma.dayPlan.upsert({
    where: {
      householdId_date: { householdId: DEV_HOUSEHOLD_ID, date: date29 },
    },
    create: {
      id: DEV_DAYPLAN_2026_03_29_ID,
      householdId: DEV_HOUSEHOLD_ID,
      date: date29,
      lunchMealId: DEV_MEAL_BUDDHA_BOWL_ID,
      dinnerMealId: DEV_MEAL_LENTIL_CURRY_ID,
    },
    update: {
      lunchMealId: DEV_MEAL_BUDDHA_BOWL_ID,
      dinnerMealId: DEV_MEAL_LENTIL_CURRY_ID,
    },
  });

  console.log(`dev-seed: ok (idempotent). X-Dev-User-Id=${DEV_USER_ID} email=${email}`);
  console.log(
    'Use README / .env.example for default DEV_SEED_PASSWORD; override with env DEV_SEED_PASSWORD.'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
