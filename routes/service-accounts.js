'use strict';

/**
 * @file routes/service-accounts.js
 * @description Fastify route plugin for service account management.
 *
 * POST /service-accounts — Open endpoint (no auth required). Creates a new service
 *   account and returns its API key. The key is only present in this response;
 *   it cannot be retrieved again from any other endpoint.
 */

const { createAccount } = require('../store/service-accounts');

/**
 * Registers service account routes on the Fastify instance.
 *
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} _opts - Unused plugin options
 * @returns {Promise<void>}
 */
async function serviceAccountRoutes(fastify, _opts) {
    /**
     * POST /service-accounts
     *
     * Creates a new service account. No authentication required — this is the
     * bootstrap endpoint that allows callers to obtain an API key for the first time.
     *
     * @param {object} [request.body.name] - Optional human-readable label for the account
     * @returns {201} { id: string, key: string, name: string, createdAt: string }
     *   The full account object including the plaintext key (only returned here).
     */
    fastify.post('/service-accounts', async (request, reply) => {
        const name = request.body?.name ?? 'unnamed';
        const account = createAccount(name);
        return reply.code(201).send(account);
    });
}

module.exports = serviceAccountRoutes;
