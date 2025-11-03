-- CreateTable
CREATE TABLE "public"."game" (
    "id" SERIAL NOT NULL,
    "roomId" TEXT NOT NULL,
    "player1Id" INTEGER NOT NULL,
    "player2Id" INTEGER,
    "winnerId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "duration" INTEGER,
    "player1FinalHP" INTEGER,
    "player2FinalHP" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_roomId_key" ON "public"."game"("roomId");

-- AddForeignKey
ALTER TABLE "public"."game" ADD CONSTRAINT "game_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."game" ADD CONSTRAINT "game_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
