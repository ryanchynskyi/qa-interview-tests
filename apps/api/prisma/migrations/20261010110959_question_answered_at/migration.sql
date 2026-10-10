/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `QuestionState` table. All the data in the column will be lost.
  - Added the required column `answeredAt` to the `QuestionState` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "QuestionState" DROP COLUMN "updatedAt",
ADD COLUMN     "answeredAt" TIMESTAMP(3) NOT NULL;
