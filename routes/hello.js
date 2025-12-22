
async function routes(fastify, opts) {
    fastify.post('/hello', async (request, reply) => {
        // validate that user info is present
        const { name } = request.body;
        if (!name) reply.code(400).send({ error: 'Name not found' });

        // handle the request
        try {

            return { message: `Hello, ${name}!` };

        } catch (err) {
            reply.code(500).send({ error: 'Internal Server Error', details: err.message });
        }
    });
}

module.exports = routes;
