-- Add Actions Taken without rewriting existing Users, Tickets, Attachments,
-- Public Comments, Internal Notes, or Sessions. Legacy Tickets receive no
-- synthetic actions or events.
CREATE TYPE "ActionStatus" AS ENUM (
  'Planned',
  'In Progress',
  'Completed',
  'Cancelled'
);

CREATE TYPE "ActionEventType" AS ENUM (
  'ActionCreated',
  'ActionEdited',
  'ActionStarted',
  'ActionCompleted',
  'ActionCancelled'
);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "assigneeId" INTEGER NOT NULL,
  "performedByUserId" INTEGER,
  "completedByUserId" INTEGER,
  "cancelledByUserId" INTEGER,
  "description" TEXT NOT NULL,
  "result" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "status" "ActionStatus" NOT NULL DEFAULT 'Planned',
  "version" INTEGER NOT NULL DEFAULT 1,
  "requestId" UUID NOT NULL,
  "payloadHash" CHAR(64) NOT NULL,
  "seedKey" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "startedAt" TIMESTAMPTZ(3),
  "completedAt" TIMESTAMPTZ(3),
  "cancelledAt" TIMESTAMPTZ(3),

  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionTaken_seedKey_key"
ON "ActionTaken"("seedKey");
CREATE UNIQUE INDEX "ActionTaken_ticketId_createdByUserId_requestId_key"
ON "ActionTaken"("ticketId", "createdByUserId", "requestId");
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx"
ON "ActionTaken"("ticketId", "createdAt", "id");
CREATE INDEX "ActionTaken_ticketId_status_idx"
ON "ActionTaken"("ticketId", "status");
CREATE INDEX "ActionTaken_assigneeId_status_ticketId_idx"
ON "ActionTaken"("assigneeId", "status", "ticketId");

CREATE TABLE "ActionEvent" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "ActionEventType" NOT NULL,
  "actionVersion" INTEGER NOT NULL,
  "fromStatus" "ActionStatus",
  "toStatus" "ActionStatus",
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB,

  CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionEvent_actionId_actionVersion_key"
ON "ActionEvent"("actionId", "actionVersion");
CREATE INDEX "ActionEvent_actionId_createdAt_id_idx"
ON "ActionEvent"("actionId", "createdAt", "id");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionTaken_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionTaken_performedByUserId_fkey"
    FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionTaken_completedByUserId_fkey"
    FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionTaken_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ActionEvent"
  ADD CONSTRAINT "ActionEvent_actionId_fkey"
    FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "ActionEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
