-- CreateTable
CREATE TABLE "public"."machine_event" (
    "id" SERIAL NOT NULL,
    "machineCode" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sensorData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machine_event_machineCode_idx" ON "public"."machine_event"("machineCode");

-- CreateIndex
CREATE INDEX "machine_event_createdAt_idx" ON "public"."machine_event"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."machine_event" ADD CONSTRAINT "machine_event_machineCode_fkey" FOREIGN KEY ("machineCode") REFERENCES "public"."machine"("code") ON DELETE CASCADE ON UPDATE CASCADE;
