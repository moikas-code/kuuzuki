/**
 * Email service for sending license-related emails
 * This uses Cloudflare's Email API or can be adapted for other email services
 */

export interface EmailMessage {
  to: string
  subject: string
  text?: string
  html?: string
}

export interface LicenseEmailData {
  email: string
  licenseKey: string
  customerId: string
}

/**
 * Send license key to customer via email
 */
export async function sendLicenseEmail(
  data: LicenseEmailData,
  env?: { EMAIL_API_URL?: string; EMAIL_API_KEY?: string }
): Promise<void> {
  const message = createLicenseEmailMessage(data)
  
  try {
    // Try Cloudflare Email API first
    if (env?.EMAIL_API_URL && env?.EMAIL_API_KEY) {
      await sendViaCloudflareEmail(message, env)
    } else {
      // Fallback to console logging for development/testing
      console.log("📧 Email would be sent:", {
        to: message.to,
        subject: message.subject,
        preview: message.text?.substring(0, 100) + "..."
      })
    }
  } catch (error) {
    console.error("Failed to send license email:", error)
    // Don't throw - we don't want to fail the webhook if email fails
  }
}

/**
 * Create email message for license key delivery
 */
function createLicenseEmailMessage(data: LicenseEmailData): EmailMessage {
  const { email, licenseKey, customerId } = data
  
  const subject = "Your Kuuzuki Pro License Key"
  
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
`.trim()

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
`.trim()

  return {
    to: email,
    subject,
    text,
    html
  }
}

/**
 * Send email via Cloudflare Email API
 */
async function sendViaCloudflareEmail(
  message: EmailMessage,
  env: { EMAIL_API_URL: string; EMAIL_API_KEY: string }
): Promise<void> {
  const response = await fetch(env.EMAIL_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@kuuzuki.com",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email API error: ${response.status} ${error}`)
  }
}

/**
 * Alternative implementation using Resend (popular email API)
 * Uncomment and adapt if using Resend instead of Cloudflare Email
 */
/*
async function sendViaResend(
  message: EmailMessage,
  apiKey: string
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Kuuzuki <noreply@kuuzuki.com>",
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${response.status} ${error}`)
  }
}
*/