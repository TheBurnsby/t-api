'use strict';

/**
 * @file routes/service-account-create.js
 * @description Fastify route plugin for service account management.
 *
 * POST /service-account-create — Open endpoint (no auth required). Creates a new service
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
async function serviceAccountCreate(fastify, _opts) {
    /**
     * POST /service-account-create
     *
     * Creates a new service account. No authentication required — this is the
     * bootstrap endpoint that allows callers to obtain an API key for the first time.
     *
     * @param {string} request.body.name - Required human-readable label for the account.
     *   Validated by Fastify schema before the handler runs; returns 400 if missing or blank.
     * @returns {201} { id: string, key: string, name: string, createdAt: string }
     *   The full account object including the plaintext key (only returned here).
     */
    fastify.post('/service-account-create', {
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: { type: 'string', minLength: 1 }
                }
            }
        }
    }, async (request, reply) => {
        const account = createAccount(request.body.name);
        return reply.code(201).send(account);
    });
}

module.exports = serviceAccountCreate;
