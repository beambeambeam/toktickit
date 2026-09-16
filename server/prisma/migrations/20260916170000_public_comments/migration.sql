-- Store the shared, append-only Ticket conversation separately from public Ticket projections.
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seedKey" TEXT,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicComment_seedKey_key" ON "PublicComment"("seedKey");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx"
ON "PublicComment"("ticketId", "createdAt", "id");

ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "PublicComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
