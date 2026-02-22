'use strict';

/**
 * @file auth.js
 * @description Fastify plugin that enforces service account API-key authentication globally.
 *
 * Every request must carry a valid API key as `Authorization: Bearer <key>`.
 * The key is looked up in the shared in-memory service account store. On success,
 * `request.user` is populated with the matching service account's data (id, name,
 * createdAt — never the key itself). On failure a 401 is returned immediately.
 *
 * Public routes that bypass this check:
 *   GET  /health                  — health check, no auth needed
 *   POST /service-account-create  — account creation must be open so callers can obtain a key
 */

const fp = require('fastify-plugin');
const { findByKey } = require('./store/service-accounts');

/**
 * Routes that bypass API-key authentication entirely.
 *
 * Each entry is a composite `"METHOD /path"` string so that, for example,
 * only `POST /service-account-create` is open — a future `GET /service-account-create`
 * would still require a valid key.
 *
 * @type {Set<string>}
 */
const PUBLIC_ROUTES = new Set([
    'GET /health',
    'POST /service-account-create',
]);

/**
 * Fastify plugin that adds a global onRequest hook for API-key authentication.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _options - Unused plugin options
 * @returns {Promise<void>}
 */
async function authPlugin(fastify, _options) {
    /**
     * Global onRequest hook — runs before every route handler.
     *
     * Checks whether the route is public. If not, validates that the request
     * carries a Bearer token matching a known service account. Populates
     * `request.user` with account metadata (id, name, createdAt) on success.
     *
     * @param {import('fastify').FastifyRequest} request
     * @param {import('fastify').FastifyReply} reply
     * @returns {Promise<void>}
     */
    fastify.addHook('onRequest', async (request, reply) => {
        const routeKey = `${request.method} ${request.routeOptions.url}`;
        if (PUBLIC_ROUTES.has(routeKey)) return;

        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.slice(7);
        const account = findByKey(token);

        if (!account) {
            return reply.code(401).send({ error: 'Invalid API key' });
        }

        // Expose account info to downstream handlers without leaking the key
        const { key, ...user } = account;
        request.user = user;
    });
}

module.exports = fp(authPlugin);
