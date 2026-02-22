/**
 * @file auth.js
 * @description Fastify plugin that globally enforces Microsoft Entra ID (Azure AD) JWT authentication.
 *
 * Every incoming request must carry a valid Bearer token in the Authorization header.
 * The token is verified against Microsoft's JWKS endpoint using RS256. On success,
 * the decoded payload is attached to `request.user` for use in downstream route handlers.
 *
 * Required environment variables:
 *   AZURE_TENANT_ID  — Your Azure AD tenant ID
 *   AZURE_CLIENT_ID  — The client/application ID (used as the expected token audience)
 */
const fp = require('fastify-plugin');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

/**
 * Routes that bypass JWT authentication entirely.
 * Add paths here only for genuinely public endpoints (e.g. health checks).
 * All other routes require a valid Bearer token.
 *
 * @type {Set<string>}
 */
const PUBLIC_ROUTES = new Set([
    '/health',
]);

async function authPlugin(fastify, options) {
    const TENANT_ID = process.env.AZURE_TENANT_ID;
    const AUDIENCE = process.env.AZURE_CLIENT_ID;

    if (!TENANT_ID || !AUDIENCE) {
        throw new Error('Missing required env vars: AZURE_TENANT_ID and AZURE_CLIENT_ID must be set');
    }

    const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
    const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;

    /**
     * JWKS client fetches Microsoft's public signing keys so we can verify token signatures.
     * Caching is enabled to avoid a network round-trip to Microsoft on every request.
     * Rate limiting guards against bursts that could exhaust the JWKS endpoint.
     */
    const client = jwksClient({
        jwksUri: JWKS_URI,
        cache: true,
        cacheMaxAge: 150_000, // 2.5 minutes
        rateLimit: true,
    });

    /**
     * Resolves the RS256 public signing key for a given JWT header.
     * The `kid` (key ID) in the header tells us which key in the JWKS to use.
     *
     * @param {object} header - The decoded JWT header (must contain `kid`)
     * @returns {Promise<string>} The PEM-encoded public key
     */
    function getSigningKey(header) {
        return new Promise((resolve, reject) => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) reject(err);
                else resolve(key.getPublicKey());
            });
        });
    }

    /**
     * Global onRequest hook — runs before every route handler.
     *
     * Validates that the request carries a Bearer token, then verifies it is:
     *   - Signed by Microsoft (via JWKS)
     *   - Issued for this application (audience check)
     *   - From the expected tenant (issuer check)
     *   - Not expired
     *
     * On success, `request.user` is populated with the decoded JWT claims,
     * e.g. request.user.oid, request.user.name, request.user.preferred_username.
     * On failure, a 401 is returned immediately and the route handler is not called.
     */
    fastify.addHook('onRequest', async (request, reply) => {
        if (PUBLIC_ROUTES.has(request.routeOptions.url)) return;

        const authHeader = request.headers['authorization'];
        if (!authHeader?.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.slice(7);

        try {
            request.user = await new Promise((resolve, reject) => {
                jwt.verify(token, getSigningKey, {
                    audience: AUDIENCE,
                    issuer: ISSUER,
                    algorithms: ['RS256'],
                }, (err, decoded) => {
                    if (err) reject(err);
                    else resolve(decoded);
                });
            });
        } catch {
            return reply.code(401).send({ error: 'Invalid or expired token' });
        }
    });
}

module.exports = fp(authPlugin);
