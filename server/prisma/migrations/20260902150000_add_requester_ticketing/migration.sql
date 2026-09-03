-- Add active/display metadata to the existing Category table without removing rows.
ALTER TABLE "Category"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Category"
SET "displayOrder" = "id"
WHERE "displayOrder" = 0;

CREATE INDEX "Category_isActive_displayOrder_idx"
ON "Category"("isActive", "displayOrder");

-- Create enums used by requester-owned Tickets.
CREATE TYPE "RequestedPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');
CREATE TYPE "CurrentStatus" AS ENUM ('New');

-- Create reference and requester tables.
CREATE TABLE "RelatedSystem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RelatedSystem_name_key" ON "RelatedSystem"("name");
CREATE INDEX "RelatedSystem_isActive_displayOrder_idx"
ON "RelatedSystem"("isActive", "displayOrder");

CREATE TABLE "DevelopmentRequester" (
    "id" SERIAL NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevelopmentRequester_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DevelopmentRequester_email_key" ON "DevelopmentRequester"("email");
CREATE INDEX "DevelopmentRequester_isActive_displayName_idx"
ON "DevelopmentRequester"("isActive", "displayName");

CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "ticketDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requestedPriority" "RequestedPriority" NOT NULL,
    "currentStatus" "CurrentStatus" NOT NULL DEFAULT 'New',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");
CREATE INDEX "Ticket_requesterId_updatedAt_idx" ON "Ticket"("requesterId", "updatedAt");
CREATE INDEX "Ticket_requesterId_currentStatus_idx" ON "Ticket"("requesterId", "currentStatus");
CREATE INDEX "Ticket_requesterId_requestedPriority_idx" ON "Ticket"("requesterId", "requestedPriority");
CREATE INDEX "Ticket_requesterId_categoryId_idx" ON "Ticket"("requesterId", "categoryId");
CREATE INDEX "Ticket_requesterId_relatedSystemId_idx" ON "Ticket"("requesterId", "relatedSystemId");

CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removalReason" TEXT,
    "removedByRequesterId" INTEGER,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");
CREATE INDEX "Attachment_ticketId_removedAt_idx" ON "Attachment"("ticketId", "removedAt");

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "DevelopmentRequester"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_relatedSystemId_fkey"
FOREIGN KEY ("relatedSystemId") REFERENCES "RelatedSystem"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_removedByRequesterId_fkey"
FOREIGN KEY ("removedByRequesterId") REFERENCES "DevelopmentRequester"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
