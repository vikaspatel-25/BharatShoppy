import nodemailer from "nodemailer";

let testTransportInstance = null;

/**
 * Injects a fake or mock transport for unit testing.
 */
export function setTestTransport(transport) {
  testTransportInstance = transport;
}

/**
 * Resets the injected test transport.
 */
export function resetTestTransport() {
  testTransportInstance = null;
}

/**
 * Returns the configured administrator email address.
 */
export function getAdminEmail() {
  return process.env.ADMIN_EMAIL || "admin@bharatshopy.com";
}

/**
 * Creates or retrieves the active nodemailer transport.
 * Throws in production if unconfigured.
 */
function getTransporter() {
  if (testTransportInstance) {
    return testTransportInstance;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (isProduction && (!user || !pass)) {
    throw new Error(
      "Production email service is unconfigured (missing GMAIL_USER or GMAIL_APP_PASSWORD). Refusing to send email."
    );
  }

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Core email sending function. Every caller must await this function.
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!to || typeof to !== "string") {
    throw new Error("Recipient email address ('to') is required and must be a string.");
  }

  const transporter = getTransporter();

  if (!transporter) {
    // Development fallback when Gmail credentials are not configured
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}\n${text}`);
    return { success: true, simulated: true };
  }

  const fromAddress = process.env.GMAIL_USER || "noreply@bharatshopy.com";

  try {
    const info = await transporter.sendMail({
      from: `BharatShopy <${fromAddress}>`,
      to,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    console.error("Failed to send email via nodemailer:", err);
    throw err;
  }
}

/**
 * Sends a 6-digit login verification code to the administrator.
 */
export async function sendAdminLoginCode(to, code) {
  const subject = "BharatShopy Admin Verification Code";
  const text = `Your 6-digit verification code is: ${code}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">BharatShopy Admin Verification</h2>
      <p style="color: #475569;">Your single-use login code is:</p>
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #0284c7;">
        ${code}
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This code will expire in 10 minutes. If you did not request this, please secure your account immediately.</p>
    </div>
  `;

  // Ensure dev console log format matches expectation
  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Admin 6-digit login verification code for ${to}: ${code}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Sends a 6-digit login verification code to a store vendor.
 */
export async function sendVendorLoginCode(to, code) {
  const subject = "BharatShopy Vendor Login Code";
  const text = `Your 6-digit vendor verification code is: ${code}. It expires in 5 minutes.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">BharatShopy Vendor Portal</h2>
      <p style="color: #475569;">Your single-use login code is:</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #ea580c;">
        ${code}
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This code will expire in 5 minutes. Do not share this code with anyone.</p>
    </div>
  `;

  // Ensure dev console log format matches expectation
  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Vendor 6-digit login verification code for ${to}: ${code}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}
