CREATE TABLE "InternalNote" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seedKey" TEXT,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalNote_seedKey_key" ON "InternalNote"("seedKey");
CREATE INDEX "InternalNote_ticketId_createdAt_id_idx"
  ON "InternalNote"("ticketId", "createdAt", "id");

ALTER TABLE "InternalNote"
  ADD CONSTRAINT "InternalNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "InternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;
