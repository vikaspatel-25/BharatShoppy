/**
 * Abstract email provider interface for sending one-time admin verification codes.
 */
export class EmailProvider {
  async sendAdminVerificationCode(email, code) {
    throw new Error("sendAdminVerificationCode() must be implemented by subclass");
  }
}

/**
 * Development implementation that logs verification codes to standard output.
 */
export class DevelopmentEmailProvider extends EmailProvider {
  async sendAdminVerificationCode(email, code) {
    console.log(`[DEV EMAIL] Admin 6-digit login verification code for ${email}: ${code}`);
    return { success: true, simulated: true };
  }
}

/**
 * Production implementation that fails closed if an external provider is unconfigured.
 */
export class ProductionEmailProvider extends EmailProvider {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.EMAIL_API_KEY;
  }

  async sendAdminVerificationCode(email, code) {
    if (!this.apiKey) {
      throw new Error(
        "Production email provider is unconfigured (missing EMAIL_API_KEY). Refusing to send code."
      );
    }
    // Future integration with Resend / AWS SES / SendGrid once provider chosen (Q2)
    return { success: true };
  }
}

let activeProviderInstance = null;

export function setEmailProvider(provider) {
  activeProviderInstance = provider;
}

export function resetEmailProvider() {
  activeProviderInstance = null;
}

export function getEmailProvider(env = process.env) {
  if (activeProviderInstance) {
    return activeProviderInstance;
  }
  if (env.NODE_ENV === "production") {
    return new ProductionEmailProvider({ apiKey: env.EMAIL_API_KEY });
  }
  return new DevelopmentEmailProvider();
}
