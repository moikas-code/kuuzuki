"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStripeWebhook = handleStripeWebhook;
const apikey_1 = require("./apikey");
const email_1 = require("./email");
async function handleStripeWebhook(event, kv, env) {
    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            if (session.mode !== "subscription")
                return;
            const customerId = session.customer;
            const subscriptionId = session.subscription;
            const email = session.customer_email || session.customer_details?.email;
            if (!email) {
                console.error("No email found in checkout session");
                return;
            }
            // Check if API key already exists for this customer
            const existingApiKey = await (0, apikey_1.getApiKeyByCustomerId)(kv, customerId);
            if (existingApiKey) {
                console.log("API key already exists for customer", customerId);
                return;
            }
            // Create new API key
            const apiKey = (0, apikey_1.createApiKey)("live");
            await (0, apikey_1.storeApiKey)(kv, {
                key: apiKey,
                email,
                customerId,
                subscriptionId,
                status: "active",
                scopes: ["sharing"],
                createdAt: Date.now(),
                metadata: {
                    clientReferenceId: session.client_reference_id,
                    version: "1.0.0",
                },
            });
            console.log("Created API key", apiKey, "for", email);
            // Send API key via email
            await (0, email_1.sendApiKeyEmail)({
                email,
                apiKey,
                customerId,
            }, env);
            break;
        }
        case "customer.subscription.updated": {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            const apiKey = await (0, apikey_1.getApiKeyByCustomerId)(kv, customerId);
            if (!apiKey) {
                console.error("No API key found for customer", customerId);
                return;
            }
            // Map Stripe status to our status
            let status = "active";
            switch (subscription.status) {
                case "active":
                    status = "active";
                    break;
                case "canceled":
                    status = "canceled";
                    break;
                case "past_due":
                    status = "past_due";
                    break;
                case "incomplete":
                case "incomplete_expired":
                    status = "incomplete";
                    break;
            }
            await (0, apikey_1.updateApiKeyStatus)(kv, apiKey.key, status);
            console.log("Updated API key status", apiKey.key, status);
            break;
        }
        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            const apiKey = await (0, apikey_1.getApiKeyByCustomerId)(kv, customerId);
            if (!apiKey) {
                console.error("No API key found for customer", customerId);
                return;
            }
            await (0, apikey_1.updateApiKeyStatus)(kv, apiKey.key, "canceled");
            console.log("Canceled API key", apiKey.key);
            break;
        }
        default:
            console.log("Unhandled webhook event type:", event.type);
    }
}
