/**
 * @file routes/health.js
 * @description Public health check endpoint. No authentication required.
 * Used by load balancers and uptime monitors to verify the service is running.
 */

async function routes(fastify, opts) {
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok' };
    });
}

module.exports = routes;
