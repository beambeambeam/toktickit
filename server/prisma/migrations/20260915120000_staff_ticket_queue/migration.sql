-- Expand Ticket state without replacing existing Ticket rows.
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Open';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'In Progress';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Waiting for Requester';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Resolved';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Closed';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Reopened';
ALTER TYPE "CurrentStatus" ADD VALUE IF NOT EXISTS 'Cancelled';

ALTER TABLE "Ticket"
  ADD COLUMN "itPriority" "RequestedPriority" NOT NULL DEFAULT 'Low',
  ADD COLUMN "ownerId" INTEGER,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolutionIndicatedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionIndicatedByUserId" INTEGER,
  ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);

UPDATE "Ticket"
SET "itPriority" = "requestedPriority",
    "statusChangedAt" = "ticketDate";

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT,
  ADD CONSTRAINT "Ticket_resolutionIndicatedByUserId_fkey"
    FOREIGN KEY ("resolutionIndicatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

CREATE INDEX "Ticket_updatedAt_id_idx" ON "Ticket"("updatedAt", "id");
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");
CREATE INDEX "Ticket_itPriority_idx" ON "Ticket"("itPriority");
CREATE INDEX "Ticket_categoryId_relatedSystemId_idx" ON "Ticket"("categoryId", "relatedSystemId");
