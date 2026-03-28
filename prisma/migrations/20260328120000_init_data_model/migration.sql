-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IngredientStorageType" AS ENUM ('PANTRY', 'REFRIGERATED', 'FROZEN', 'FRESH');

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMembership" (
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,

    CONSTRAINT "HouseholdMembership_pkey" PRIMARY KEY ("userId","householdId")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "recipeUrl" TEXT,
    "imageId" TEXT,
    "makesLeftovers" BOOLEAN NOT NULL DEFAULT false,
    "isGreasy" BOOLEAN NOT NULL DEFAULT false,
    "isCreamy" BOOLEAN NOT NULL DEFAULT false,
    "isAcidic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageType" "IngredientStorageType" NOT NULL,
    "perishable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealHeroIngredient" (
    "mealId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MealHeroIngredient_pkey" PRIMARY KEY ("mealId","ingredientId")
);

-- CreateTable
CREATE TABLE "MealCookedBy" (
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MealCookedBy_pkey" PRIMARY KEY ("mealId","userId")
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lunchMealId" TEXT,
    "dinnerMealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdMembership_householdId_idx" ON "HouseholdMembership"("householdId");

-- CreateIndex
CREATE INDEX "Meal_householdId_idx" ON "Meal"("householdId");

-- CreateIndex
CREATE INDEX "Ingredient_householdId_idx" ON "Ingredient"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_householdId_name_key" ON "Ingredient"("householdId", "name");

-- CreateIndex
CREATE INDEX "MealHeroIngredient_mealId_idx" ON "MealHeroIngredient"("mealId");

-- CreateIndex
CREATE INDEX "MealCookedBy_mealId_idx" ON "MealCookedBy"("mealId");

-- CreateIndex
CREATE INDEX "DayPlan_householdId_idx" ON "DayPlan"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_householdId_date_key" ON "DayPlan"("householdId", "date");

-- AddForeignKey
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMembership" ADD CONSTRAINT "HouseholdMembership_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealHeroIngredient" ADD CONSTRAINT "MealHeroIngredient_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealHeroIngredient" ADD CONSTRAINT "MealHeroIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCookedBy" ADD CONSTRAINT "MealCookedBy_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCookedBy" ADD CONSTRAINT "MealCookedBy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_lunchMealId_fkey" FOREIGN KEY ("lunchMealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_dinnerMealId_fkey" FOREIGN KEY ("dinnerMealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

