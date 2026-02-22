const fastify = require('fastify')({
    logger: false,
    trustProxy: true  // API sits behind a reverse proxy that handles TLS termination
});

// ─── PRE-ROUTE ────────────────────────────────────────────────────────────────
// Runs before every request reaches a route handler.
fastify.register(require('@fastify/rate-limit'), {
    max: 100,           // max requests per timeWindow per IP
    timeWindow: '1 minute'
});
fastify.register(require('./auth'));

// ─── ROUTES ───────────────────────────────────────────────────────────────────
// Each module registers one or more endpoints.
fastify.register(require('./routes/hello'));

// ─── AFTER-ROUTE ──────────────────────────────────────────────────────────────
// Runs after a route handler resolves, before the response is sent.
// Use for response sanitization or transformations.
fastify.addHook('onSend', async (request, reply, payload) => {
    // placeholder
    return payload;
});

// ─── START ────────────────────────────────────────────────────────────────────
fastify.listen({ port: 8080 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    console.log(`Server is now listening on ${address}`)
});
