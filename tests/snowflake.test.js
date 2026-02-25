'use strict';

/**
 * @file tests/snowflake.test.js
 * @description Tests for the Snowflake Fastify plugin.
 * snowflake-sdk is mocked so no real connection is attempted.
 */

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock ─────────────────────────────────────────────────────────────────────

let connectError = null;
let executeError = null;
let executeRows = [];
let destroyCalled = false;

mock.module('snowflake-sdk', {
    namedExports: {
        createConnection: () => ({
            connect: (cb) => cb(connectError, null),
            execute: ({ complete }) => complete(executeError, null, executeRows),
            destroy: (done) => { destroyCalled = true; done(); },
        }),
    },
});

// ─── App factory ──────────────────────────────────────────────────────────────

function buildApp() {
    const Fastify = require('fastify');
    const app = Fastify({ logger: false });
    app.register(require('../plugins/snowflake'));
    return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('given the plugin is registered, when app is ready, then snowflake.execute is a function', async (t) => {
    const app = buildApp();
    t.after(() => app.close());

    await app.ready();

    assert.equal(typeof app.snowflake.execute, 'function');
});

test('given query rows exist, when snowflake.execute is called, then resolves with those rows', async (t) => {
    executeRows = [{ ID: 1 }, { ID: 2 }];
    const app = buildApp();
    t.after(() => app.close());

    await app.ready();
    const rows = await app.snowflake.execute('SELECT ID FROM my_table');

    assert.deepEqual(rows, [{ ID: 1 }, { ID: 2 }]);
});

test('given a query error, when snowflake.execute is called, then rejects with the error message', async (t) => {
    executeError = new Error('SQL compilation error');
    const app = buildApp();
    t.after(() => { executeError = null; return app.close(); });

    await app.ready();

    await assert.rejects(
        () => app.snowflake.execute('SELECT bad'),
        { message: 'SQL compilation error' }
    );
});

test('given a connected app, when app is closed, then snowflake connection is destroyed', async () => {
    destroyCalled = false;
    const app = buildApp();

    await app.ready();
    await app.close();

    assert.ok(destroyCalled);
});

test('given bad credentials, when app starts, then throws with connection error', async (t) => {
    connectError = new Error('bad credentials');
    const app = buildApp();
    t.after(() => { connectError = null; });

    await assert.rejects(
        () => app.ready(),
        { message: 'Snowflake connection failed: bad credentials' }
    );
});
