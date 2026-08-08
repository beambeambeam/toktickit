# TokTickit

TokTickit is a pnpm workspace containing the client and server applications.

## Requirements

- Node.js `>=22.18.0`
- pnpm `11.13.0`

Check installed versions:

```sh
node --version
pnpm --version
```

## Installation

Install workspace dependencies from repository root:

```sh
pnpm install
```

Create local environment files. These files are ignored by Git and must not contain committed secrets:

```sh
cp client/.env.example client/.env
cp server/.env.example server/.env
```

The server environment file contains PostgreSQL credentials and `DATABASE_URL`. Use local development values or your own uncommitted values.

## Database setup

Start and initialize PostgreSQL through root database scripts:

```sh
pnpm db:start
pnpm db:status
pnpm db:generate
pnpm db:validate
pnpm db:push
pnpm db:seed
```

Open Prisma Studio with `pnpm db:studio`. Stop PostgreSQL with `pnpm db:stop`. For full database and Prisma instructions, see [server/README.md](server/README.md).

## Development

Start client and server together:

```sh
pnpm dev
```

Start one application independently:

```sh
pnpm --filter @toktickit/client dev
pnpm --filter @toktickit/server dev
```

Other useful commands:

```sh
pnpm --filter @toktickit/client preview
pnpm db:studio
pnpm db:stop
```

Start PostgreSQL before starting the server. The server verifies its Prisma connection before opening the HTTP listener.

## Verification

Format and autofix lint issues:

```sh
pnpm run fix
```

Check formatting and lint without changing files:

```sh
pnpm run check
```

Run type checks, tests, and production builds:

```sh
pnpm run typecheck
pnpm run test
pnpm run build
```
