'use strict';

/**
 * @file store/service-accounts.js
 * @description In-memory service account store backed by a Map.
 *
 * Acts as a singleton for the lifetime of the process — Node's module cache
 * ensures all callers share the same Map instance. Keys are lost on restart.
 *
 * Key generation uses crypto.randomBytes(32).toString('hex'), producing a
 * 64-character hex string with 256 bits of entropy.
 */

const { randomBytes, randomUUID } = require('node:crypto');

/**
 * @typedef {Object} ServiceAccount
 * @property {string} id        - UUID v4
 * @property {string} name      - Human-readable label for the account
 * @property {string} key       - 64-char hex API key (only returned on creation)
 * @property {string} createdAt - ISO 8601 creation timestamp
 */

/**
 * In-memory store keyed by the plaintext API key for O(1) lookup.
 *
 * @type {Map<string, ServiceAccount>}
 */
const accounts = new Map();

/**
 * Creates a new service account and stores it in the Map.
 *
 * @param {string} [name='unnamed'] - A human-readable label for the account
 * @returns {ServiceAccount} The newly created account, including the plaintext key.
 *   The key is only available in this return value — it cannot be retrieved again.
 */
function createAccount(name = 'unnamed') {
    const id = randomUUID();
    const key = randomBytes(32).toString('hex');
    const createdAt = new Date().toISOString();

    /** @type {ServiceAccount} */
    const account = { id, name, key, createdAt };
    accounts.set(key, account);
    return account;
}

/**
 * Looks up a service account by its API key.
 *
 * @param {string} key - The 64-char hex API key from the Authorization header
 * @returns {ServiceAccount|undefined} The matching account, or undefined if not found
 */
function findByKey(key) {
    return accounts.get(key);
}

/**
 * Returns a snapshot of all service accounts, omitting the key field
 * so it is safe to expose over the API.
 *
 * @returns {Array<Omit<ServiceAccount, 'key'>>}
 */
function listAccounts() {
    return Array.from(accounts.values()).map(({ key, ...rest }) => rest);
}

module.exports = { createAccount, findByKey, listAccounts };
