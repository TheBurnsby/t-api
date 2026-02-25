'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');
const jwt = require('jsonwebtoken');

// ─── Test RSA key pair ────────────────────────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// ─── Environment ──────────────────────────────────────────────────────────────
process.env.AZURE_TENANT_ID = 'test-tenant';
process.env.AZURE_CLIENT_ID = 'test-client';

const TEST_ISSUER = 'https://login.microsoftonline.com/test-tenant/v2.0';
const TEST_AUDIENCE = 'test-client';

// ─── Mock jwks-rsa ────────────────────────────────────────────────────────────
// Must run before auth.js is required so the mock is in place when jwksClient is created.
mock.module('jwks-rsa', {
    defaultExport: () => ({
        getSigningKey: (_kid, callback) => {
            callback(null, { getPublicKey: () => publicKey });
        }
    })
});

// ─── App factory ──────────────────────────────────────────────────────────────
function buildApp() {
    const Fastify = require('fastify');
    const authPlugin = require('../auth-old');
    const app = Fastify();
    app.register(authPlugin);
    app.get('/test', async () => ({ ok: true }));
    return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────
test('given no Authorization header, when GET /test, then returns 401', async () => {
    const app = buildApp();
    const res = await app.inject({ method: 'GET', url: '/test' });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Missing or invalid Authorization header' });
});

test('given a non-Bearer Authorization header, when GET /test, then returns 401', async () => {
    const app = buildApp();
    const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Basic abc123' }
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Missing or invalid Authorization header' });
});

test('given an invalid JWT token, when GET /test, then returns 401', async () => {
    const app = buildApp();
    const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer not.a.valid.token' }
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.json(), { error: 'Invalid or expired token' });
});

test('given a valid Entra JWT, when GET /test, then returns 200', async () => {
    const app = buildApp();
    const token = jwt.sign(
        { sub: 'test-user' },
        privateKey,
        {
            algorithm: 'RS256',
            audience: TEST_AUDIENCE,
            issuer: TEST_ISSUER,
            expiresIn: '1h'
        }
    );
    const res = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
});
