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

test('decorates fastify with snowflake.execute', async (t) => {
    const app = buildApp();
    t.after(() => app.close());

    await app.ready();

    assert.equal(typeof app.snowflake.execute, 'function');
});

test('execute resolves with rows', async (t) => {
    executeRows = [{ ID: 1 }, { ID: 2 }];
    const app = buildApp();
    t.after(() => app.close());

    await app.ready();
    const rows = await app.snowflake.execute('SELECT ID FROM my_table');

    assert.deepEqual(rows, [{ ID: 1 }, { ID: 2 }]);
});

test('execute rejects on query error', async (t) => {
    executeError = new Error('SQL compilation error');
    const app = buildApp();
    t.after(() => { executeError = null; return app.close(); });

    await app.ready();

    await assert.rejects(
        () => app.snowflake.execute('SELECT bad'),
        { message: 'SQL compilation error' }
    );
});

test('destroy is called on app close', async () => {
    destroyCalled = false;
    const app = buildApp();

    await app.ready();
    await app.close();

    assert.ok(destroyCalled);
});

test('plugin throws at startup if connection fails', async (t) => {
    connectError = new Error('bad credentials');
    const app = buildApp();
    t.after(() => { connectError = null; });

    await assert.rejects(
        () => app.ready(),
        { message: 'Snowflake connection failed: bad credentials' }
    );
});
