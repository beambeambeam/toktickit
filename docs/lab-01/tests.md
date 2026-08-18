# Lab 1 Test Evidence

This document maps the Lab 1 requirements to the automated tests in the repository.

The lab sheet uses both `server/tests/lab-01/` in its repository tree and `tests/lab-01/` in its submission examples. API tests are kept in `server/tests/lab-01/`; UI tests are kept in `client/tests/lab-01/` so each package can run its own dependencies and test configuration.

## Test inventory

| Test ID | Test file | Tool | Test description |
| --- | --- | --- | --- |
| API-01 | `server/tests/lab-01/health.test.ts` | Vitest + Supertest | `GET /api/health` returns HTTP 200, JSON, `status: ok`, `service: TokTickIT API`, and the expected cache/CORS behavior. |
| API-02 | `server/tests/lab-01/categories.test.ts` | Vitest + Supertest + PostgreSQL | `GET /api/categories` returns the four seeded categories in canonical order, proves repeatable seeding, handles an empty table, and returns a safe query-failure response. |
| API-03 | `server/tests/lab-01/openapi.test.ts` | Vitest + Supertest | The OpenAPI document validates, describes both endpoints, is served at `/openapi.json`, and powers interactive `/docs`. |
| API-04 | `server/tests/lab-01/app.test.ts` | Vitest + Supertest | Unknown routes return HTTP 404. |
| UI-01 | `client/tests/lab-01/home.test.tsx` | Vitest + Testing Library | The TokTickIT heading and `[ Check System ]` button render without initial API requests. |
| UI-02 | `client/tests/lab-01/home.test.tsx` | Vitest + Testing Library | Clicking the button starts health and category requests, shows loading state, then renders online status and API-driven categories. |
| UI-03 | `client/tests/lab-01/home.test.tsx` | Vitest + Testing Library | Empty, partial-failure, full-failure, fallback-error, and retry states render correctly. |
| UI-04 | `client/tests/lab-01/health.test.tsx` | Vitest + Testing Library | Health queries request the API only after an explicit refetch, preserve API errors, normalize connection errors, and retry. |

## Commands

Run from the repository root:

```sh
pnpm run check
pnpm run check-types
pnpm run test
pnpm run build
```

`pnpm run test` requires PostgreSQL because `server/tests/lab-01/categories.test.ts` creates an isolated test database and verifies the seed. Start the local database first:

```sh
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm run test
```

## Evidence status

- Client Vitest tests: passing.
- Server health, app, and OpenAPI tests: passing.
- Server category integration tests: require PostgreSQL; run the database setup commands above before the final evidence capture.
