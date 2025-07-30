"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKey = createApiKey;
exports.validateApiKeyFormat = validateApiKeyFormat;
exports.getKeyEnvironment = getKeyEnvironment;
exports.maskApiKey = maskApiKey;
exports.storeApiKey = storeApiKey;
exports.getApiKey = getApiKey;
exports.getApiKeyByEmail = getApiKeyByEmail;
exports.getApiKeyByCustomerId = getApiKeyByCustomerId;
exports.getApiKeyBySubscriptionId = getApiKeyBySubscriptionId;
exports.updateApiKeyStatus = updateApiKeyStatus;
exports.updateApiKeyUsage = updateApiKeyUsage;
exports.logApiKeyUsage = logApiKeyUsage;
exports.isApiKeyValid = isApiKeyValid;
const nanoid_1 = require("nanoid");
const generateKeyPart = (0, nanoid_1.customAlphabet)("abcdefghijklmnopqrstuvwxyz0123456789", 32);
function createApiKey(environment = "live") {
    // 1. Validate environment
    if (!["live", "test"].includes(environment)) {
        throw new Error('Invalid environment. Must be "live" or "test"');
    }
    // 2. Generate cryptographically secure random string
    const randomPart = generateKeyPart();
    // 3. Construct key
    const prefix = "kz";
    const key = `${prefix}_${environment}_${randomPart}`;
    // 4. Validate format before returning
    if (!validateApiKeyFormat(key)) {
        throw new Error("Generated key failed validation");
    }
    return key;
}
function validateApiKeyFormat(key) {
    // Regex: kz_(live|test)_[a-z0-9]{32}
    const pattern = /^kz_(live|test)_[a-z0-9]{32}$/;
    return pattern.test(key);
}
function getKeyEnvironment(key) {
    if (!validateApiKeyFormat(key))
        return null;
    if (key.startsWith("kz_live_"))
        return "live";
    if (key.startsWith("kz_test_"))
        return "test";
    return null;
}
function maskApiKey(key) {
    // Show: kz_live_abcd****wxyz
    if (!validateApiKeyFormat(key))
        return key;
    const parts = key.split("_");
    const prefix = `${parts[0]}_${parts[1]}_`;
    const random = parts[2];
    const masked = random.slice(0, 4) + "****" + random.slice(-4);
    return prefix + masked;
}
async function storeApiKey(kv, apiKey) {
    const ttl = 60 * 60 * 24 * 365; // 1 year TTL
    // 1. Store primary record
    await kv.put(`apikey:${apiKey.key}`, JSON.stringify(apiKey), {
        expirationTtl: ttl,
    });
    // 2. Store email lookup
    await kv.put(`apikey:email:${apiKey.email}`, apiKey.key, {
        expirationTtl: ttl,
    });
    // 3. Store customer lookup
    await kv.put(`apikey:customer:${apiKey.customerId}`, apiKey.key, {
        expirationTtl: ttl,
    });
    // 4. Store subscription lookup
    await kv.put(`apikey:subscription:${apiKey.subscriptionId}`, apiKey.key, {
        expirationTtl: ttl,
    });
}
async function getApiKey(kv, key) {
    const data = await kv.get(`apikey:${key}`);
    return data ? JSON.parse(data) : null;
}
async function getApiKeyByEmail(kv, email) {
    const key = await kv.get(`apikey:email:${email}`);
    return key ? getApiKey(kv, key) : null;
}
async function getApiKeyByCustomerId(kv, customerId) {
    const key = await kv.get(`apikey:customer:${customerId}`);
    return key ? getApiKey(kv, key) : null;
}
async function getApiKeyBySubscriptionId(kv, subscriptionId) {
    const key = await kv.get(`apikey:subscription:${subscriptionId}`);
    return key ? getApiKey(kv, key) : null;
}
async function updateApiKeyStatus(kv, key, status) {
    const apiKey = await getApiKey(kv, key);
    if (!apiKey)
        throw new Error("API key not found");
    apiKey.status = status;
    // Set expiration for canceled keys
    if (status === "canceled") {
        apiKey.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days grace
    }
    await storeApiKey(kv, apiKey);
}
async function updateApiKeyUsage(kv, key, metadata) {
    const apiKey = await getApiKey(kv, key);
    if (!apiKey)
        return;
    apiKey.lastUsed = Date.now();
    if (metadata) {
        apiKey.metadata = { ...apiKey.metadata, ...metadata };
    }
    await storeApiKey(kv, apiKey);
}
async function logApiKeyUsage(kv, usage) {
    const usageKey = `usage:${usage.keyId}:${usage.timestamp}`;
    await kv.put(usageKey, JSON.stringify(usage), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
}
function isApiKeyValid(apiKey) {
    if (apiKey.status !== "active")
        return false;
    if (apiKey.expiresAt && apiKey.expiresAt < Date.now())
        return false;
    return true;
}
