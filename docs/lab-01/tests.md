# Lab 1 Test Evidence

This document maps the Lab 1 requirements to the automated tests currently in the repository.

> Submission note: the lab sheet names `tests/lab-01/` as the evidence folder. The current implementation keeps API tests under `server/tests/` and UI tests beside their client features under `client/src/**/__test__/`. Move the tests or update this mapping before submitting if the instructor requires the exact folder path.

## Test inventory

| Test ID | Test file | Tool | Test description |
| --- | --- | --- | --- |
| API-01 | `server/tests/health.test.ts` | Supertest + Node test runner | `GET /api/health` returns HTTP 200, JSON, `status: ok`, `service: TokTickIT API`, and the expected cache/CORS behavior. |
| API-02 | `server/tests/categories.test.ts` | Supertest + PostgreSQL integration test | `GET /api/categories` returns stored categories in ascending ID order, returns `[]` when empty, and returns a safe error when the query fails. |
| API-03 | `server/tests/openapi.test.ts` | Supertest + Node test runner | The OpenAPI document validates, describes both endpoints, is served at `/openapi.json`, and powers interactive `/docs`. |
| API-04 | `server/tests/app.test.ts` | Supertest + Node test runner | Unknown routes return HTTP 404. |
| UI-01 | `client/src/routes/__test__/home.test.tsx` | Vitest + Testing Library | The TokTickIT heading and `[ Check System ]` button render without initial API requests. |
| UI-02 | `client/src/routes/__test__/home.test.tsx` | Vitest + Testing Library | Clicking the button starts health and category requests, shows loading state, then renders online status and API-driven categories. |
| UI-03 | `client/src/routes/__test__/home.test.tsx` | Vitest + Testing Library | Empty, partial-failure, full-failure, fallback-error, and retry states render correctly. |
| UI-04 | `client/src/api/__test__/health.test.tsx` | Vitest + Testing Library | Health queries request the API only after an explicit refetch, preserve API errors, normalize connection errors, and retry. |

## Commands

Run from the repository root:

```sh
pnpm run check
pnpm run typecheck
pnpm run test
pnpm run build
```

`pnpm run test` requires PostgreSQL because `server/tests/categories.test.ts` creates an isolated test database. Start the local database first:

```sh
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm run test
```

## Evidence status

- Client Vitest tests: passing in the latest local run.
- OpenAPI validation and server health tests: passing in the latest local run.
- Full test suite: rerun after PostgreSQL is available; category integration tests cannot pass without it.
