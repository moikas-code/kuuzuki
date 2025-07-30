"use strict";
/**
 * Email service for sending license-related emails
 * This uses Cloudflare's Email API or can be adapted for other email services
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendLicenseEmail = sendLicenseEmail;
exports.sendApiKeyEmail = sendApiKeyEmail;
/**
 * Send license key to customer via email (legacy)
 */
async function sendLicenseEmail(data, env) {
    const message = createLicenseEmailMessage(data);
    try {
        // Try Cloudflare Email API first
        if (env?.EMAIL_API_URL && env?.EMAIL_API_KEY) {
            await sendViaCloudflareEmail(message, { EMAIL_API_URL: env.EMAIL_API_URL, EMAIL_API_KEY: env.EMAIL_API_KEY });
        }
        else {
            // Fallback to console logging for development/testing
            console.log("📧 Email would be sent:", {
                to: message.to,
                subject: message.subject,
                preview: message.text?.substring(0, 100) + "...",
            });
        }
    }
    catch (error) {
        console.error("Failed to send license email:", error);
        // Don't throw - we don't want to fail the webhook if email fails
    }
}
/**
 * Send API key to customer via email
 */
async function sendApiKeyEmail(data, env) {
    const message = createApiKeyEmailMessage(data);
    try {
        // Try Cloudflare Email API first
        if (env?.EMAIL_API_URL && env?.EMAIL_API_KEY) {
            await sendViaCloudflareEmail(message, { EMAIL_API_URL: env.EMAIL_API_URL, EMAIL_API_KEY: env.EMAIL_API_KEY });
        }
        else {
            // Fallback to console logging for development/testing
            console.log("📧 Email would be sent:", {
                to: message.to,
                subject: message.subject,
                preview: message.text?.substring(0, 100) + "...",
            });
        }
    }
    catch (error) {
        console.error("Failed to send API key email:", error);
        // Don't throw - we don't want to fail the webhook if email fails
    }
}
/**
 * Create email message for license key delivery (legacy)
 */
function createLicenseEmailMessage(data) {
    const { email, licenseKey, customerId } = data;
    const subject = "Your Kuuzuki Pro License Key";
    const text = `
Thank you for purchasing Kuuzuki Pro!

Your license key is: ${licenseKey}

To activate your license, run the following command in your terminal:
kuuzuki billing login --email ${email} --license ${licenseKey}

If you have any questions or need support, please contact us.

Best regards,
The Kuuzuki Team

---
Customer ID: ${customerId}
License Key: ${licenseKey}
`.trim();
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .license-key { background: #e7f3ff; border: 1px solid #b3d7ff; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; font-size: 16px; margin: 20px 0; }
    .command { background: #1a1a1a; color: #f8f8f2; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; font-size: 14px; margin: 20px 0; overflow-x: auto; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Welcome to Kuuzuki Pro!</h1>
    <p>Thank you for your purchase. Your AI-powered development assistant is ready to use.</p>
  </div>
  
  <p>Your license key is:</p>
  <div class="license-key">
    <strong>${licenseKey}</strong>
  </div>
  
  <p>To activate your license, copy and run this command in your terminal:</p>
  <div class="command">
    kuuzuki billing login --email ${email} --license ${licenseKey}
  </div>
  
  <p>Once activated, you'll have access to:</p>
  <ul>
    <li>✅ Unlimited AI interactions</li>
    <li>✅ Advanced coding assistance</li>
    <li>✅ Priority support</li>
    <li>✅ Early access to new features</li>
  </ul>
  
  <p>If you have any questions or need help, please don't hesitate to reach out to our support team.</p>
  
  <p>Happy coding!</p>
  <p><strong>The Kuuzuki Team</strong></p>
  
  <div class="footer">
    <p>Customer ID: ${customerId}</p>
    <p>License Key: ${licenseKey}</p>
  </div>
</body>
</html>
`.trim();
    return {
        to: email,
        subject,
        text,
        html,
    };
}
/**
 * Create email message for API key delivery
 */
function createApiKeyEmailMessage(data) {
    const { email, apiKey, customerId } = data;
    const subject = "Your Kuuzuki Pro API Key";
    const text = `
Thank you for purchasing Kuuzuki Pro!

Your API key is: ${apiKey}

To use your API key, you have two options:

Option 1 (Recommended): Set as environment variable
export KUUZUKI_API_KEY=${apiKey}

Option 2: Login explicitly
kuuzuki apikey login --api-key ${apiKey}

Once set up, you'll have access to unlimited sharing features!

If you have any questions or need support, please contact us.

Best regards,
The Kuuzuki Team

---
Customer ID: ${customerId}
API Key: ${apiKey}
`.trim();
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .api-key { background: #e7f3ff; border: 1px solid #b3d7ff; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; font-size: 16px; margin: 20px 0; word-break: break-all; }
    .command { background: #1a1a1a; color: #f8f8f2; padding: 15px; border-radius: 6px; font-family: 'Monaco', 'Consolas', monospace; font-size: 14px; margin: 20px 0; overflow-x: auto; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    .option { margin: 20px 0; padding: 15px; border-left: 4px solid #007acc; background: #f8f9fa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Welcome to Kuuzuki Pro!</h1>
    <p>Thank you for your purchase. Your AI-powered development assistant is ready to use.</p>
  </div>
  
  <p>Your API key is:</p>
  <div class="api-key">
    <strong>${apiKey}</strong>
  </div>
  
  <p>To use your API key, choose one of these options:</p>
  
  <div class="option">
    <h3>Option 1: Environment Variable (Recommended)</h3>
    <p>Set your API key as an environment variable for automatic authentication:</p>
    <div class="command">export KUUZUKI_API_KEY=${apiKey}</div>
    <p><small>Add this to your shell profile (~/.bashrc, ~/.zshrc) to make it permanent.</small></p>
  </div>
  
  <div class="option">
    <h3>Option 2: Explicit Login</h3>
    <p>Login explicitly with the API key:</p>
    <div class="command">kuuzuki apikey login --api-key ${apiKey}</div>
  </div>
  
  <p>Once set up, you'll have access to:</p>
  <ul>
    <li>✅ Unlimited session sharing</li>
    <li>✅ Real-time sync</li>
    <li>✅ Persistent sessions</li>
    <li>✅ Priority support</li>
  </ul>
  
  <p><strong>Keep your API key secure!</strong> Don't share it publicly or commit it to version control.</p>
  
  <p>If you have any questions or need help, please don't hesitate to reach out to our support team.</p>
  
  <p>Happy coding!</p>
  <p><strong>The Kuuzuki Team</strong></p>
  
  <div class="footer">
    <p>Customer ID: ${customerId}</p>
    <p>API Key: ${apiKey}</p>
  </div>
</body>
</html>
`.trim();
    return {
        to: email,
        subject,
        text,
        html,
    };
}
/**
 * Send email via Cloudflare Email API
 */
async function sendViaCloudflareEmail(message, env) {
    const response = await fetch(env.EMAIL_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${env.EMAIL_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: "noreply@kuuzuki.com",
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
        }),
    });
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Email API error: ${response.status} ${error}`);
    }
}
