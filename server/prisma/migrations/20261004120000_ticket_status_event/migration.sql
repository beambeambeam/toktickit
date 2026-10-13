-- CreateTable
CREATE TABLE "TicketStatusEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "fromStatus" "CurrentStatus" NOT NULL,
  "toStatus" "CurrentStatus" NOT NULL,
  "ticketVersion" INTEGER NOT NULL,
  "confirmed" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketStatusEvent_ticketId_ticketVersion_key" ON "TicketStatusEvent"("ticketId", "ticketVersion");

-- CreateIndex
CREATE INDEX "TicketStatusEvent_ticketId_createdAt_id_idx" ON "TicketStatusEvent"("ticketId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "TicketStatusEvent" ADD CONSTRAINT "TicketStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
