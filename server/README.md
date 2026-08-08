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

Seed the canonical request categories:

```sh
pnpm db:seed
```

The seed is safe to run repeatedly. It uses category names as the idempotency key and preserves unrelated categories.

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
