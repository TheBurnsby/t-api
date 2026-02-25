'use strict';

/**
 * @file tests/service-account-create.test.js
 * @description Tests for POST /service-account-create and the API-key auth plugin.
 * Uses node:test, fastify.inject(), and mock.module() to avoid real I/O.
 */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock the store before any auth or route module is required ───────────────
// Controls the in-memory state for each test via mockAccounts.clear().
const mockAccounts = new Map();

mock.module('../store/service-accounts.js', {
    namedExports: {
        /**
         * @param {string} [name='unnamed']
         * @returns {{ id: string, key: string, name: string, createdAt: string }}
         */
        createAccount(name = 'unnamed') {
            const id = 'test-id-1';
            const key = 'a'.repeat(64); // predictable 64-char key for test assertions
            const createdAt = '2026-01-01T00:00:00.000Z';
            const account = { id, key, name, createdAt };
            mockAccounts.set(key, account);
            return account;
        },
        /** @param {string} key */
        findByKey(key) {
            return mockAccounts.get(key);
        },
        listAccounts() {
            return Array.from(mockAccounts.values()).map(({ key, ...rest }) => rest);
        },
    }
});

// ─── App factory ──────────────────────────────────────────────────────────────

/**
 * Builds a minimal Fastify app with the auth plugin, service-accounts route,
 * and a protected test route. Called fresh inside each test.
 *
 * @returns {import('fastify').FastifyInstance}
 */
function buildApp() {
    const Fastify = require('fastify');
    const authPlugin = require('../auth');
    const serviceAccountRoutes = require('../routes/service-account-create');

    const app = Fastify();
    app.register(authPlugin);
    app.register(serviceAccountRoutes);

    // A protected route to verify auth works end-to-end
    app.get('/protected', async () => ({ ok: true }));

    // Mirrors the real health route for the public-route bypass test
    app.get('/health', async () => ({ status: 'ok' }));

    return app;
}

// ─── POST /service-account-create ───────────────────────────────────────────────────

test('given a valid name, when POST /service-account-create, then returns 201 with account details', async () => {
    mockAccounts.clear();
    const app = buildApp();
    const res = await app.inject({
        method: 'POST',
        url: '/service-account-create',
        body: { name: 'my-service' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id, 'response should include id');
    assert.ok(body.key, 'response should include key');
    assert.equal(body.name, 'my-service');
    assert.ok(body.createdAt, 'response should include createdAt');
});

test('given no request body, when POST /service-account-create, then returns 400', async () => {
    mockAccounts.clear();
    const app = buildApp();
    const res = await app.inject({ method: 'POST', url: '/service-account-create' });
    assert.equal(res.statusCode, 400);
});

test('given a blank name, when POST /service-account-create, then returns 400', async () => {
    mockAccounts.clear();
    const app = buildApp();
    const res = await app.inject({
        method: 'POST',
        url: '/service-account-create',
        body: { name: '' },
    });
    assert.equal(res.statusCode, 400);
});

test('given no Authorization header, when POST /service-account-create, then returns 201 (route is public)', async () => {
    mockAccounts.clear();
    const app = buildApp();
    const res = await app.inject({
        method: 'POST',
        url: '/service-account-create',
        body: { name: 'bootstrap' },
    });
    // Must be 201, not 401 — the route is public
    assert.equal(res.statusCode, 201);
});

// ─── Auth plugin — API key validation ─────────────────────────────────────────

test('given no Authorization header, when GET /protected, then returns 401', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/protected' });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Missing or invalid Authorization header' });
});

test('given a non-Bearer Authorization header, when GET /protected, then returns 401', async () => {
    const app = buildApp();
    const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Basic abc123' },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Missing or invalid Authorization header' });
});

test('given an unknown API key, when GET /protected, then returns 401', async () => {
    mockAccounts.clear();
    const app = buildApp();
    const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer unknownkey' },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Invalid API key' });
});

test('given a valid API key, when GET /protected, then returns 200', async () => {
    mockAccounts.clear();
    const app = buildApp();

    // Create an account so the key is in the mock store
    await app.inject({ method: 'POST', url: '/service-account-create', body: { name: 'test' } });

    const validKey = 'a'.repeat(64);
    const res = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: `Bearer ${validKey}` },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
});

test('given no Authorization header, when GET /health, then returns 200 (public route)', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { status: 'ok' });
});
