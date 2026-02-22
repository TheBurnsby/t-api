
const fastify = require('fastify')({
    logger: false
});

// Register auth middleware
fastify.register(require('./auth'));

// Register routes
fastify.register(require('./routes/hello'));


// Run the server
fastify.listen({ port: 8080 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    console.log(`Server is now listening on ${address}`)
})