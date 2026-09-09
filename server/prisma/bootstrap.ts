import "dotenv/config";
import argon2 from "argon2";

import { prisma } from "../src/db/client.js";
import {
  isValidPasswordLength,
  isValidEmail,
  MAX_PASSWORD_CODE_POINTS,
  MIN_PASSWORD_CODE_POINTS,
  normalizeEmail,
} from "../src/services/auth-rules.js";

const password = process.env.BOOTSTRAP_PASSWORD;
const commandArguments = process.argv.slice(2);
let targetEmail: string | undefined;

for (let index = 0; index < commandArguments.length; index += 1) {
  const argument = commandArguments[index];

  if (argument !== "--email" || targetEmail !== undefined) {
    throw new Error(
      "Usage: db:bootstrap [--email <credential-less-user-email>]"
    );
  }

  const emailArgument = commandArguments[index + 1];
  if (emailArgument === undefined) {
    throw new Error(
      "Usage: db:bootstrap [--email <credential-less-user-email>]"
    );
  }

  const email = normalizeEmail(emailArgument);
  if (!isValidEmail(email)) {
    throw new Error("--email must be a valid email address.");
  }

  targetEmail = email;
  index += 1;
}

if (password === undefined) {
  throw new Error(
    "BOOTSTRAP_PASSWORD is required. Set it only for this explicit local command."
  );
}

if (!isValidPasswordLength(password)) {
  throw new Error(
    `BOOTSTRAP_PASSWORD must contain ${MIN_PASSWORD_CODE_POINTS}–${MAX_PASSWORD_CODE_POINTS} Unicode characters.`
  );
}

try {
  const users = await prisma.user.findMany({
    select: { id: true, passwordHash: true },
    where: targetEmail === undefined ? {} : { email: targetEmail },
  });

  if (targetEmail !== undefined && users.length === 0) {
    throw new Error("No User exists for the requested email address.");
  }

  const usersWithoutCredentials = users.filter(
    (user) => user.passwordHash === null
  );
  const results = await Promise.all(
    usersWithoutCredentials.map(async (user) => {
      const passwordHash = await argon2.hash(password, {
        hashLength: 32,
        memoryCost: 19_456,
        parallelism: 1,
        timeCost: 2,
        type: argon2.argon2id,
      });

      const result = await prisma.user.updateMany({
        data: { mustChangePassword: true, passwordHash },
        where: { id: user.id, passwordHash: null },
      });

      return result.count;
    })
  );

  const bootstrappedCount = results.reduce((total, count) => total + count, 0);
  const skippedCount = users.length - bootstrappedCount;
  console.info(
    `Bootstrapped ${bootstrappedCount} User(s); skipped ${skippedCount} with existing credentials.`
  );
} finally {
  await prisma.$disconnect();
}
