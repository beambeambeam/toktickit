import argon2 from "argon2";

import { prisma } from "../src/db/client.js";

const password = "correct horse battery staple";
const users = [
  {
    displayName: "E2E Desktop Requester",
    email: "e2e-desktop@example.test",
    mustChangePassword: false,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Tablet Requester",
    email: "e2e-tablet@example.test",
    mustChangePassword: false,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Mobile Requester",
    email: "e2e-mobile@example.test",
    mustChangePassword: false,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Isolation Requester",
    email: "e2e-isolation@example.test",
    mustChangePassword: false,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Desktop First Login",
    email: "e2e-first-login-desktop@example.test",
    mustChangePassword: true,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Tablet First Login",
    email: "e2e-first-login-tablet@example.test",
    mustChangePassword: true,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Mobile First Login",
    email: "e2e-first-login-mobile@example.test",
    mustChangePassword: true,
    role: "Requester" as const,
  },
  {
    displayName: "E2E Administrator",
    email: "e2e-admin@example.test",
    mustChangePassword: false,
    role: "Administrator" as const,
  },
  {
    displayName: "E2E IT Staff",
    email: "e2e-staff@example.test",
    mustChangePassword: false,
    role: "ITStaff" as const,
  },
] as const;

try {
  await prisma.loginAttempt.deleteMany();

  await Promise.all(
    users.map(async (user) => {
      const passwordHash = await argon2.hash(password, {
        memoryCost: 19_456,
        parallelism: 1,
        timeCost: 2,
        type: argon2.argon2id,
      });
      const existing = await prisma.user.findUnique({
        select: { id: true },
        where: { email: user.email },
      });

      if (existing === null) {
        await prisma.user.create({
          data: {
            ...user,
            isActive: true,
            passwordHash,
          },
        });
        return;
      }

      await prisma.user.update({
        data: {
          displayName: user.displayName,
          isActive: true,
          mustChangePassword: user.mustChangePassword,
          passwordHash,
          role: user.role,
        },
        where: { id: existing.id },
      });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
    })
  );
} finally {
  await prisma.$disconnect();
}
