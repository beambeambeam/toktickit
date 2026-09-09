-- Preflight must finish before the identity table is changed. Normalized email
-- collisions cannot be resolved safely by an automatic migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DevelopmentRequester"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot migrate DevelopmentRequester rows with conflicting normalized emails.'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "DevelopmentRequester"
    WHERE char_length(btrim("displayName")) NOT BETWEEN 1 AND 100
       OR char_length(btrim("email")) NOT BETWEEN 1 AND 254
       OR btrim("email") !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'
  ) THEN
    RAISE EXCEPTION 'Cannot migrate DevelopmentRequester rows with invalid name or email data.'
      USING ERRCODE = '23514';
  END IF;
END
$$;

ALTER TABLE "DevelopmentRequester" RENAME TO "User";
ALTER INDEX "DevelopmentRequester_email_key" RENAME TO "User_email_key";
ALTER INDEX "DevelopmentRequester_isActive_displayName_idx" RENAME TO "User_isActive_displayName_idx";
ALTER TABLE "User" RENAME CONSTRAINT "DevelopmentRequester_pkey" TO "User_pkey";

CREATE TYPE "UserRole" AS ENUM ('Requester', 'ITStaff', 'Administrator');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'Requester',
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "seedKey" TEXT;

UPDATE "User"
SET "displayName" = btrim("displayName"),
    "email" = lower(btrim("email"));

CREATE UNIQUE INDEX "User_seedKey_key" ON "User"("seedKey");

ALTER TABLE "Category" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "RelatedSystem" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "seedKey" TEXT;
CREATE UNIQUE INDEX "Category_seedKey_key" ON "Category"("seedKey");
CREATE UNIQUE INDEX "RelatedSystem_seedKey_key" ON "RelatedSystem"("seedKey");
CREATE UNIQUE INDEX "Ticket_seedKey_key" ON "Ticket"("seedKey");

ALTER TABLE "Attachment" RENAME COLUMN "removedByRequesterId" TO "removedByUserId";
ALTER TABLE "Attachment"
  RENAME CONSTRAINT "Attachment_removedByRequesterId_fkey" TO "Attachment_removedByUserId_fkey";

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "csrfSecret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "restricted" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_absoluteExpiresAt_idx" ON "Session"("userId", "absoluteExpiresAt");
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");

CREATE TABLE "LoginAttempt" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginAttempt_key_failedAt_idx" ON "LoginAttempt"("key", "failedAt");

ALTER TABLE "Ticket"
  DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "Attachment"
  DROP CONSTRAINT "Attachment_removedByUserId_fkey";
ALTER TABLE "Attachment"
  ADD CONSTRAINT "Attachment_removedByUserId_fkey"
  FOREIGN KEY ("removedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- Tag only canonical rows known before this migration. Later seed runs use
-- immutable keys rather than editable names or email addresses.
UPDATE "Category" SET "seedKey" = CASE "name"
  WHEN 'Account and Access' THEN 'lab3:category:account-access'
  WHEN 'Hardware' THEN 'lab3:category:hardware'
  WHEN 'Software' THEN 'lab3:category:software'
  WHEN 'Network' THEN 'lab3:category:network'
  ELSE "seedKey" END
WHERE "name" IN ('Account and Access', 'Hardware', 'Software', 'Network');

UPDATE "RelatedSystem" SET "seedKey" = CASE "name"
  WHEN 'Email' THEN 'lab3:system:email'
  WHEN 'Campus Wi-Fi' THEN 'lab3:system:campus-wifi'
  WHEN 'VPN' THEN 'lab3:system:vpn'
  WHEN 'LEB2 App' THEN 'lab3:system:leb2-app'
  WHEN 'Grade Submission App' THEN 'lab3:system:grade-submission-app'
  WHEN 'Printer' THEN 'lab3:system:printer'
  WHEN 'Corporate Laptop' THEN 'lab3:system:corporate-laptop'
  ELSE "seedKey" END
WHERE "name" IN ('Email', 'Campus Wi-Fi', 'VPN', 'LEB2 App', 'Grade Submission App', 'Printer', 'Corporate Laptop');

UPDATE "User" SET "seedKey" = CASE "email"
  WHEN 'ada@example.test' THEN 'lab3:user:requester-1'
  WHEN 'ben@example.test' THEN 'lab3:user:requester-2'
  WHEN 'chai@example.test' THEN 'lab3:user:requester-3'
  WHEN 'dara@example.test' THEN 'lab3:user:requester-4'
  WHEN 'inactive@example.test' THEN 'lab3:user:inactive-requester'
  ELSE "seedKey" END
WHERE "email" IN ('ada@example.test', 'ben@example.test', 'chai@example.test', 'dara@example.test', 'inactive@example.test');
