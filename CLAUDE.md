# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test        # Starts the server (runs node index.js)
```

No build step, linter, or test framework is configured.

## Architecture

A minimal [Fastify](https://fastify.dev/) v5 REST API running on port 8080.

- **`index.js`** — Entry point. Registers plugins and route modules, then starts the server.
- **`routes/`** — Each file exports an async Fastify route plugin and is registered in `index.js`.
- **`auth.js`** — A Fastify plugin (via `fastify-plugin`) that adds an `onRequest` hook to validate Microsoft Entra ID (Azure AD) Bearer tokens using `jsonwebtoken` + `jwks-rsa`. It reads `AZURE_TENANT_ID` and `AZURE_CLIENT_ID` from environment variables. Currently commented out in `index.js`.

When auth is enabled, `request.user` is populated with the decoded JWT payload and `request.body` is guaranteed to be an object before route handlers run.
