'use strict';

/**
 * @file plugins/snowflake.js
 * @description Fastify plugin that opens a single Snowflake connection on startup
 * and decorates the instance with `fastify.snowflake` for use in route handlers.
 *
 * Required environment variables:
 *   SNOWFLAKE_ACCOUNT              — e.g. "myorg-myaccount"
 *   SNOWFLAKE_USERNAME             — Snowflake username
 *   SNOWFLAKE_PRIVATE_KEY          — PKCS8 PEM content of the RSA private key.
 *                                    Multi-line values stored as \n-escaped strings
 *                                    are automatically normalised.
 *   SNOWFLAKE_PRIVATE_KEY_PASSPHRASE — (optional) passphrase for encrypted keys
 *   SNOWFLAKE_DATABASE             — default database
 *   SNOWFLAKE_SCHEMA               — default schema
 *   SNOWFLAKE_WAREHOUSE            — default warehouse
 */

const fp = require('fastify-plugin');
const snowflake = require('snowflake-sdk');

/**
 * Fastify plugin that establishes a Snowflake connection and exposes it via
 * `fastify.snowflake`. Uses key-pair (JWT) authentication.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _options - Unused plugin options
 * @returns {Promise<void>}
 */
async function snowflakePlugin(fastify, _options) {
    // PEM keys stored in env vars often have literal \n instead of real newlines.
    const privateKey = process.env.SNOWFLAKE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT,
        username: process.env.SNOWFLAKE_USERNAME,
        authenticator: 'SNOWFLAKE_JWT',
        privateKey,
        privateKeyPass: process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE,
        database: process.env.SNOWFLAKE_DATABASE,
        schema: process.env.SNOWFLAKE_SCHEMA,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    });

    await new Promise((resolve, reject) => {
        connection.connect((err, conn) => {
            if (err) reject(new Error(`Snowflake connection failed: ${err.message}`));
            else resolve(conn);
        });
    });

    fastify.log.info('Snowflake connection established');

    /**
     * Execute a Snowflake SQL statement and resolve with the result rows.
     *
     * @param {string} sqlText - SQL to execute. Use `?` placeholders for binds.
     * @param {Array} [binds=[]] - Positional bind parameters matching each `?`.
     * @returns {Promise<Array<object>>} Resolves with the array of result row objects.
     */
    function execute(sqlText, binds = []) {
        return new Promise((resolve, reject) => {
            connection.execute({
                sqlText,
                binds,
                complete: (err, _stmt, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                },
            });
        });
    }

    fastify.decorate('snowflake', { execute });

    fastify.addHook('onClose', (_instance, done) => {
        connection.destroy(done);
    });
}

module.exports = fp(snowflakePlugin);

//   Then in any route handler:

//   const rows = await fastify.snowflake.execute(
//       'SELECT * FROM my_table WHERE id = ?',
//       [id]
//   );

