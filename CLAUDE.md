# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

A Fastify API service that exposes custom endpoints for consumption by a separate front-end application. **Every request must be authenticated** via a Microsoft Entra ID (Azure AD) JWT token — the `auth.js` plugin handles this globally and should always be registered in `index.js`.

## TODO

- Install `@fastify/cors` and register in the PRE-ROUTE section of `index.js` to control allowed origins for the front-end.

## Standards

- Always ask before making architectural changes.
- Never make database requests inside loops.
- Always use Fastify test utilities (e.g. `fastify.inject()`) first for route and handler testing before reaching for other tools like supertest or direct HTTP calls
- Add documentation comments in JSDoc format for any new code written

## Commands

```bash
npm start       # Start the server
npm test        # Run all tests (node:test with module mocking)
```

No build step or linter is configured. Tests use Node's built-in `node:test` runner with `--experimental-test-module-mocks` for CJS module mocking. Test files live in `tests/` and follow the `*.test.js` naming convention.

## Architecture

A minimal [Fastify](https://fastify.dev/) v5 REST API running on port 8080.

- **`index.js`** — Entry point. Registers plugins and route modules, then starts the server.
- **`routes/`** — Each file exports an async Fastify route plugin and is registered in `index.js`.
- **`auth.js`** — A Fastify plugin (via `fastify-plugin`) that adds an `onRequest` hook to validate Microsoft Entra ID (Azure AD) Bearer tokens using `jsonwebtoken` + `jwks-rsa`. It reads `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` from environment variables. Must be registered in `index.js` before route plugins.

After auth, `request.user` is populated with the decoded JWT payload for use in route handlers.

## Test Rules

These rules apply to all test files in `tests/`. Follow the KISS principle — tests should be easy to read and change.

### Structure
- **Flat only** — use top-level `test()` calls. No nesting or describe-style grouping.
- **One test file per source file** — `routes/foo.js` → `tests/foo.test.js`. Split only if a file exceeds ~200 lines.
- **Section dividers** — use ASCII rule comments (`// ─── Section ───`) to visually separate mock setup, the app factory, and test groups within a file.

### App Instances
- **Fresh `buildApp()` per test** — never share an app instance across tests. Define a `buildApp()` factory at the top of each file and call it inside every test.

### Mocking
- **Reset mock state at the top of every test that uses mocks** — never rely on state left behind by a previous test.
- **Use `mock.module()` before any source module is `require()`d** — module mocks must be in place before the code under test loads them.

### Coverage
- **Every test file must cover at minimum:** one happy-path case and the main failure modes (bad input, auth failure, upstream error). Do not test exhaustive edge cases — test what can actually go wrong.

### Assertions
- **Always assert `statusCode`** in every route test.
- **Assert the full response body only when the response shape is the point of the test** — for simple pass/fail cases a status code check is enough.

### Naming
- **Given/When/Then plain English** — e.g. `'given a valid API key, when GET /protected, then returns 200'`. Names should read as a sentence describing the scenario and expected outcome.

### Documentation
- **JSDoc file header only** — every test file starts with a `@file` / `@description` block. Do not add JSDoc to `buildApp()` or other test helpers.
