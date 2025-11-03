/*
  Warnings:

  - You are about to drop the column `name` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `machine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `machine_event` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `firstname` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastname` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."machine_event" DROP CONSTRAINT "machine_event_machineCode_fkey";

-- AlterTable
ALTER TABLE "public"."user" DROP COLUMN "name",
ADD COLUMN     "firstname" TEXT NOT NULL,
ADD COLUMN     "lastname" TEXT NOT NULL,
ADD COLUMN     "password" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."machine";

-- DropTable
DROP TABLE "public"."machine_event";
