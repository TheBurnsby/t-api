// Uses 'fastify-jwt' for demonstration; in production, use 'fastify-oauth2' or MSAL for advanced scenarios
// This example expects the Entra public key or JWKS endpoint to be configured
const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');


const TENANT_ID = process.env.AZURE_TENANT_ID;
const AUDIENCE = process.env.AZURE_CLIENT_ID;
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

const client = jwksClient({
    jwksUri: JWKS_URI
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            callback(err);
        } else {
            const signingKey = key.getPublicKey();
            callback(null, signingKey);
        }
    });
}

async function authPlugin(fastify, options) {
    fastify.addHook('onRequest', async (request, reply) => {
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            reply.code(401).send({ error: 'Missing or invalid Authorization header' });
            return;
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = await new Promise((resolve, reject) => {
                jwt.verify(token, getKey, {
                    audience: AUDIENCE,
                    issuer: ISSUER,
                    algorithms: ['RS256']
                }, (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded);
                });
            });
            request.user = decoded;

            // ensure request.body is always an object
            request.body = request.body ?? {};
            console.log(request.body)
        } catch (err) {
            reply.code(401).send({ error: 'Invalid or expired token' });
        }
    });
}

module.exports = fp(authPlugin);