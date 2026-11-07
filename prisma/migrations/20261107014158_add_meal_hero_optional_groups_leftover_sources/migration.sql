-- AlterTable
ALTER TABLE "MealHeroIngredient" ADD COLUMN     "optional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "substitutionGroup" TEXT;

-- CreateTable
CREATE TABLE "MealLeftoverSource" (
    "consumerMealId" TEXT NOT NULL,
    "sourceMealId" TEXT NOT NULL,

    CONSTRAINT "MealLeftoverSource_pkey" PRIMARY KEY ("consumerMealId","sourceMealId")
);

-- CreateIndex
CREATE INDEX "MealLeftoverSource_consumerMealId_idx" ON "MealLeftoverSource"("consumerMealId");

-- AddForeignKey
ALTER TABLE "MealLeftoverSource" ADD CONSTRAINT "MealLeftoverSource_consumerMealId_fkey" FOREIGN KEY ("consumerMealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLeftoverSource" ADD CONSTRAINT "MealLeftoverSource_sourceMealId_fkey" FOREIGN KEY ("sourceMealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
