# TokTickit Server

## Local PostgreSQL and Prisma

Create the server environment file:

```sh
cp .env.example .env
```

The `.env` file configures PostgreSQL and supplies the validated `DATABASE_URL` used by Prisma at runtime. It is ignored by Git; keep real credentials out of committed files.

Start PostgreSQL:

```sh
pnpm db:start
pnpm db:status
```

Initialize and validate Prisma:

```sh
pnpm db:generate
pnpm db:validate
```

Apply the committed migrations:

```sh
pnpm db:migrate
```

Seed the canonical reference data and local demonstration Users:

```sh
pnpm db:seed
```

The seed is safe to run repeatedly. It uses immutable `seedKey` values and preserves edited, deactivated and credentialed rows. It creates reference data, active Requester/IT Staff/Administrator fixtures, and inactive fixtures for each role. Seeded Users intentionally have no usable credential until the explicit bootstrap step:

```sh
BOOTSTRAP_PASSWORD='use a local 15+ character passphrase' pnpm db:bootstrap -- --email ada@example.test
```

Bootstrap hashes the supplied password with Argon2id and fills only the selected User's missing hash. Omit `--email` to bootstrap every credential-less User. It never changes an existing password or account state; reruns report skipped Users. Keep the password out of shell history when possible and never commit it.

Ticket Attachments are stored outside the public application bundle under `ATTACHMENT_STORAGE_DIR`. The default is `server/.data/attachments`; override it for local/test storage. Files use generated opaque storage keys and are removed on failed persistence attempts.

When a data model is changed, create and apply a named development migration:

```sh
pnpm db:migrate -- --name describe-change
```

Run the server after PostgreSQL is healthy. Startup calls `prisma.$connect()` before opening the HTTP listener, so a successful start verifies the database connection:

```sh
pnpm dev
```

Open Prisma Studio with:

```sh
pnpm db:studio
```

Regenerate the client after changing `prisma/schema.prisma`:

```sh
pnpm db:generate
```

Stop PostgreSQL while preserving its volume:

```sh
pnpm db:stop
```

To remove the local database volume as well, run:

```sh
pnpm db:stop -- --volumes
```

The same database commands are exposed from repository root:

```sh
pnpm db:start
pnpm db:stop
pnpm db:studio
```
