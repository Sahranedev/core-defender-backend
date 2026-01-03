-- AlterTable: Ajout du système de parties privées
ALTER TABLE "game" ADD COLUMN IF NOT EXISTS "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "game" ADD COLUMN IF NOT EXISTS "privateCode" TEXT;

-- CreateIndex: Index unique sur privateCode
CREATE UNIQUE INDEX IF NOT EXISTS "game_privateCode_key" ON "game"("privateCode");

