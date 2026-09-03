/**
 * Removes tickets created by the Lab 2 browser E2E flow so repeated
 * `pnpm test:e2e` runs start from the same empty-ticket state.
 * Only E2E-pattern summaries are touched; reference data is left alone.
 */
import { prisma } from "../src/db/client.js";
import { removeAttachmentFiles } from "../src/services/attachment-storage.js";

const E2E_SUMMARY_PREFIXES = [
  "E2E requester flow ",
  "Seeded isolation ticket ",
];

const tickets = await prisma.ticket.findMany({
  select: { id: true },
  where: {
    OR: E2E_SUMMARY_PREFIXES.map((startsWith) => ({
      summary: { startsWith },
    })),
  },
});
const ticketIds = tickets.map((ticket) => ticket.id);

if (ticketIds.length > 0) {
  const attachments = await prisma.attachment.findMany({
    select: { storageKey: true },
    where: { ticketId: { in: ticketIds } },
  });
  await removeAttachmentFiles(
    attachments.map((attachment) => attachment.storageKey)
  );
  await prisma.attachment.deleteMany({
    where: { ticketId: { in: ticketIds } },
  });
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
}

console.info(`Reset ${ticketIds.length} E2E tickets.`);
await prisma.$disconnect();
