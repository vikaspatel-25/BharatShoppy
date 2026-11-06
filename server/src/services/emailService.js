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

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Vendor 6-digit login verification code for ${to}: ${code}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Sends a 6-digit verification code to an applicant verifying their email.
 */
export async function sendApplicationVerificationCode(to, code) {
  const subject = "BharatShopy Vendor Application Verification Code";
  const text = `Your 6-digit verification code to submit your vendor application is: ${code}. It expires in 10 minutes.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">BharatShopy Vendor Application</h2>
      <p style="color: #475569;">Your verification code to submit your store application is:</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #059669;">
        ${code}
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">This code will expire in 10 minutes. Please enter this code in the application form.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Application verification code for ${to}: ${code}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Alerts administrator when a new vendor application is submitted.
 */
export async function sendNewApplicationAlert({ storeName, email, name, city, entityType }) {
  const adminEmail = getAdminEmail();
  const subject = `New Vendor Application: ${storeName}`;
  const text = `A new vendor application has been received for "${storeName}".\nApplicant: ${name} (${email})\nEntity: ${entityType || "shopkeeper"}\nCity: ${city || "N/A"}\n\nPlease review it in the admin dashboard.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">New Vendor Application</h2>
      <p style="color: #475569;">A new store application has been submitted for review:</p>
      <ul style="color: #334155; line-height: 1.6;">
        <li><strong>Store Name:</strong> ${storeName}</li>
        <li><strong>Applicant:</strong> ${name} (${email})</li>
        <li><strong>Entity Type:</strong> ${entityType || "shopkeeper"}</li>
        <li><strong>City:</strong> ${city || "N/A"}</li>
      </ul>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Log in to the Admin Dashboard to review and approve or reject this application.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] New application alert sent to ${adminEmail} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to: adminEmail, subject, text, html });
}

/**
 * Confirms submission of application to the applicant.
 */
export async function sendApplicationConfirmation(to, { storeName, name }) {
  const subject = `BharatShopy - Application Received for ${storeName}`;
  const text = `Dear ${name || "Vendor"},\n\nWe have received your application for "${storeName}". Our administration team is reviewing your application and you will receive an update once a decision has been made.\n\nThank you for choosing BharatShopy.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Application Received</h2>
      <p style="color: #475569;">Dear ${name || "Vendor"},</p>
      <p style="color: #475569;">We have received your application for <strong>${storeName}</strong>.</p>
      <p style="color: #475569;">Our administration team is reviewing your store details. You will receive an email notification as soon as your application is processed.</p>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Thank you for partnering with BharatShopy.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Application confirmation sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Notifies vendor that their store application has been approved.
 */
export async function sendVendorApprovalEmail(to, { storeName, slug, subdomain }) {
  const subject = `Welcome to BharatShopy - Your Store "${storeName}" is Approved!`;
  const text = `Congratulations! Your vendor application for "${storeName}" has been approved.\n\nYour store is now active on the Starter Free Plan.\nYou can now sign in to your vendor dashboard using your email (${to}) to manage your catalog.\nStore slug: ${slug}\nSubdomain: ${subdomain}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #059669;">Congratulations! Store Approved</h2>
      <p style="color: #475569;">Your vendor application for <strong>${storeName}</strong> has been approved by our administrators.</p>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="color: #065f46; margin: 0;"><strong>Active Plan:</strong> Starter Free Plan</p>
        <p style="color: #065f46; margin: 4px 0 0 0;"><strong>Store Slug:</strong> ${slug}</p>
        <p style="color: #065f46; margin: 4px 0 0 0;"><strong>Subdomain:</strong> ${subdomain}</p>
      </div>
      <p style="color: #475569;">You can now log in to the Vendor Portal using your email address (${to}) to list your products and configure your store.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Vendor approval email sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Notifies vendor that their application was rejected with a reason.
 */
export async function sendVendorRejectionEmail(to, { storeName, reason }) {
  const subject = `Update regarding your BharatShopy application for "${storeName}"`;
  const text = `Thank you for your interest in BharatShopy. After reviewing your application for "${storeName}", we are unable to approve it at this time.\n\nReason: ${reason}\n\nIf you have any questions or would like to submit updated information, please feel free to reach out.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #0f172a;">Application Status Update</h2>
      <p style="color: #475569;">Thank you for your interest in BharatShopy. After reviewing your store application for <strong>${storeName}</strong>, we are unable to approve it at this time.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="color: #991b1b; margin: 0;"><strong>Reason:</strong></p>
        <p style="color: #991b1b; margin: 4px 0 0 0;">${reason}</p>
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 16px;">If you have any questions, you can contact our support team.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Vendor rejection email sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Notifies vendor that their subscription tier has been activated or renewed.
 */
export async function sendSubscriptionActivationEmail(to, { storeName, planName, durationDays, expiresAt }) {
  const expiryFormatted = expiresAt ? new Date(expiresAt).toLocaleDateString() : "Active";
  const subject = `BharatShopy Subscription Activated: ${storeName}`;
  const text = `Congratulations! The subscription for "${storeName}" has been activated under the ${planName} plan for ${durationDays} days.\n\nActive until: ${expiryFormatted}\nYour storefront is active and accessible on BharatShopy.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #059669;">Subscription Activated</h2>
      <p style="color: #475569;">Your store <strong>${storeName}</strong> subscription has been successfully activated.</p>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="color: #065f46; margin: 0;"><strong>Active Plan:</strong> ${planName}</p>
        <p style="color: #065f46; margin: 4px 0 0 0;"><strong>Duration:</strong> +${durationDays} days</p>
        <p style="color: #065f46; margin: 4px 0 0 0;"><strong>Valid Until:</strong> ${expiryFormatted}</p>
      </div>
      <p style="color: #475569;">Your products are live and searchable in the marketplace and on your store link.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Subscription activation email sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Notifies vendor that their store subscription has been discontinued.
 */
export async function sendSubscriptionDiscontinuationEmail(to, { storeName }) {
  const subject = `BharatShopy Subscription Discontinued: ${storeName}`;
  const text = `The subscription for "${storeName}" has been discontinued by an administrator.\n\nYour products have been hidden from marketplace searches. Store contact details remain saved. To reactivate your catalog, please request a renewal through your vendor portal.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #b91c1c;">Subscription Discontinued</h2>
      <p style="color: #475569;">The subscription for your store <strong>${storeName}</strong> has been discontinued by an administrator.</p>
      <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="color: #991b1b; margin: 0;"><strong>Status:</strong> Discontinued / Inactive</p>
        <p style="color: #991b1b; margin: 4px 0 0 0;">Your products are hidden from public discovery until renewed.</p>
      </div>
      <p style="color: #475569;">Your store data and listing items are preserved. You can submit a renewal request anytime from the vendor dashboard.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Subscription discontinuation email sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}

/**
 * Sends a manual renewal reminder triggered by an admin.
 */
export async function sendRenewalReminderEmail(to, { storeName, planName, daysRemaining, expiresAt }) {
  const expiryFormatted = expiresAt ? new Date(expiresAt).toLocaleDateString() : "Soon";
  const subject = `BharatShopy Store Renewal Reminder: ${storeName}`;
  const text = `Dear Vendor,\n\nThis is a friendly reminder that the subscription for "${storeName}" (${planName || "Standard Plan"}) is expiring or has expired (Date: ${expiryFormatted}).\n\nPlease submit a renewal request in your vendor dashboard or contact BharatShopy administration to maintain uninterrupted visibility for your products.`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #ea580c;">Subscription Renewal Reminder</h2>
      <p style="color: #475569;">This is a reminder regarding the subscription for <strong>${storeName}</strong>.</p>
      <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="color: #9a3412; margin: 0;"><strong>Store:</strong> ${storeName}</p>
        <p style="color: #9a3412; margin: 4px 0 0 0;"><strong>Expiration:</strong> ${expiryFormatted}</p>
        ${typeof daysRemaining === "number" ? `<p style="color: #9a3412; margin: 4px 0 0 0;"><strong>Days Remaining:</strong> ${daysRemaining}</p>` : ""}
      </div>
      <p style="color: #475569;">To ensure uninterrupted access and visibility for your listings, please submit a renewal request in your vendor dashboard.</p>
    </div>
  `;

  if (!getTransporter() && process.env.NODE_ENV !== "production") {
    console.log(`[DEV EMAIL] Renewal reminder email sent to ${to} for store: ${storeName}`);
    return { success: true, simulated: true };
  }

  return await sendEmail({ to, subject, text, html });
}
