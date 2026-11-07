/*
  Warnings:

  - You are about to drop the column `makesLeftovers` on the `Meal` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MealLeftovers" AS ENUM ('ALWAYS', 'NEVER', 'OPTIONALLY');

-- AlterTable
ALTER TABLE "Meal" DROP COLUMN "makesLeftovers",
ADD COLUMN     "isEasyToMake" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leftovers" "MealLeftovers" NOT NULL DEFAULT 'OPTIONALLY';
