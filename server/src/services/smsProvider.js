/**
 * Abstract SMS provider interface for sending phone OTP codes to vendors.
 */
export class SMSProvider {
  async sendOTP(phone, otp) {
    throw new Error("sendOTP() must be implemented by subclass");
  }
}

/**
 * Development implementation that logs OTP codes to standard output.
 */
export class DevelopmentSMSProvider extends SMSProvider {
  async sendOTP(phone, otp) {
    console.log(`[DEV SMS] Vendor login OTP for ${phone}: ${otp}`);
    return { success: true, simulated: true };
  }
}

/**
 * Production implementation that fails closed if an external SMS provider is unconfigured.
 */
export class ProductionSMSProvider extends SMSProvider {
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.SMS_API_KEY;
  }

  async sendOTP(phone, otp) {
    if (!this.apiKey) {
      throw new Error(
        "Production SMS provider is unconfigured (missing SMS_API_KEY). Refusing to send OTP."
      );
    }
    // Future integration with Twilio / Fast2SMS / MSG91 once provider chosen (Q2)
    return { success: true };
  }
}

let activeProviderInstance = null;

export function setSMSProvider(provider) {
  activeProviderInstance = provider;
}

export function resetSMSProvider() {
  activeProviderInstance = null;
}

export function getSMSProvider(env = process.env) {
  if (activeProviderInstance) {
    return activeProviderInstance;
  }
  if (env.NODE_ENV === "production") {
    return new ProductionSMSProvider({ apiKey: env.SMS_API_KEY });
  }
  return new DevelopmentSMSProvider();
}
