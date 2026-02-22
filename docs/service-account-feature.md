# Plan: Service Account Authentication

## Context

The API currently authenticates all requests via Microsoft Entra ID (Azure AD) JWTs. The goal is to introduce a simpler service account model — callers create an account via an open endpoint and receive an API key, then use that key as a Bearer token on subsequent requests. The existing Entra auth is preserved as `auth-old.js` for reference; the new auth plugin replaces it as the active mechanism.

---

## Files to Create

### `store/service-accounts.js` (new)
Plain CJS singleton module. No Fastify involvement — just a `Map` and three exported functions. Node's module cache ensures all callers share the same instance.

```
exports: createAccount(name?), findByKey(key), listAccounts()
```

- Key generation: `crypto.randomBytes(32).toString('hex')` → 64-char hex, 256-bit entropy
- `findByKey` does O(1) `Map.get(key)` — the raw key is the Map key
- `listAccounts` strips the `key` field via rest destructuring before returning

### `routes/service-account-create.js` (new)
Single route plugin, no auth required on the endpoint.

```
POST /service-account-create
  Body (required): { name: string }  ← validated by Fastify inline schema (AJV)
  Response 201:    { id, key, name, createdAt }  ← key only returned here
  Response 400:    if name is missing or blank
```

### `auth.js` (new — replaces current)
Fastify plugin (wrapped with `fastify-plugin`) that adds a global `onRequest` hook.

- `PUBLIC_ROUTES` set uses `"METHOD /path"` composite keys (e.g. `"POST /service-account-create"`) so method matters, not just path
- Uses `request.routeOptions.url` (matched route pattern, not raw URL) — same as `auth-old.js`
- On success: strips `key` from account before assigning to `request.user`
- Public routes: `GET /health`, `POST /service-account-create`
- No environment variables required

### `tests/service-accounts.test.js` (new)
Uses `node:test` + `fastify.inject()` + `mock.module('../store/service-accounts', ...)`. Follows existing `auth.test.js` patterns exactly.

Tests cover:
1. `POST /service-account-create` → 201 with `id`, `key`, `name`, `createdAt`
2. No body → defaults name to `"unnamed"`
3. No Authorization header on public endpoint → 201 (not 401)
4. No Authorization header on protected route → 401
5. Non-Bearer auth header → 401
6. Unknown API key → 401
7. Valid API key on protected route → 200
8. `GET /health` remains public → 200

---

## Files to Modify

### `auth.js` → rename to `auth-old.js`
File contents unchanged. Only the filename changes.

### `tests/auth.test.js`
One line change — update the require path:
```js
// line ~35: require('../auth')  →  require('../auth-old')
```

### `index.js`
Two changes:
1. `require('./auth')` — already correct (now resolves to the new plugin)
2. Add `fastify.register(require('./routes/service-accounts'))` in the ROUTES section

No structural changes. Registration order is preserved: rate-limit → auth → routes.

---

## Implementation Order

1. Create `store/service-accounts.js`
2. Create new `auth.js`
3. Create `routes/service-accounts.js`
4. Create `tests/service-accounts.test.js`
5. Rename `auth.js` → `auth-old.js`
6. Update `tests/auth.test.js` require path
7. Update `index.js`

Steps 1–4 can be done before the rename so the server is never in a broken state.

---

## No New Dependencies

`crypto.randomBytes` and `crypto.randomUUID` are Node built-ins. `fastify-plugin` is already installed.

---

## Verification

```bash
# All tests pass (4 existing + 8 new)
npm test

# Manual smoke test
npm run start-dev

curl -X POST http://localhost:8080/service-accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test"}'
# → 201 { id, key, name, createdAt }

curl -X POST http://localhost:8080/hello \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
# → 200 { message: "Hello, World!" }

curl http://localhost:8080/health
# → 200 { status: "ok" }

curl -X POST http://localhost:8080/hello \
  -H "Authorization: Bearer badkey" \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
# → 401 { error: "Invalid API key" }
```
