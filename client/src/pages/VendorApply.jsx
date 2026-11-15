import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { AuthLayout, Field, FormSection, Notice, inputClass } from "@/components/panel/ui";
import { apiFetch } from "@/lib/apiClient";
import { ENTITY_TYPES } from "@/lib/entityTypes";
import { toMessage } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";

const toSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default function VendorApply() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    storeName: "",
    slug: "",
    subdomain: "",
    phone: "",
    entityType: "shopkeeper",
    storeCategory: "Retail & General",
    description: "",
    city: "",
    state: "",
  });
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [warning, setWarning] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Suggest the slug and subdomain from the store name until the applicant edits them
      if (name === "storeName") {
        const before = toSlug(prev.storeName);
        if (!prev.slug || prev.slug === before) updated.slug = toSlug(value);
        if (!prev.subdomain || prev.subdomain === before) updated.subdomain = toSlug(value);
      }
      return updated;
    });
  };

  const fail = (msg) => {
    setError(toMessage(msg));
    scrollToTop();
  };

  const handleRequestCode = async () => {
    setError("");
    if (!formData.email.trim() || !formData.email.includes("@")) {
      fail("Please provide a valid email address.");
      return;
    }
    try {
      setCodeLoading(true);
      const res = await apiFetch("/api/vendor/apply/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Failed to send verification code."));
      setCodeSent(true);
    } catch (err) {
      fail(err);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!codeSent) {
      fail("Please request a verification code first.");
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      fail("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    try {
      setLoading(true);
      const res = await apiFetch("/api/vendor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          code: code.trim(),
          address: { city: formData.city, state: formData.state },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Failed to submit application."));
      setWarning(typeof data.warning === "string" ? data.warning : "");
      setSuccess(true);
      scrollToTop();
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title="Application submitted">
        <div className="text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} aria-hidden="true" />
          </span>
          <p className="text-sm text-stone-600">
            Thank you for applying to sell on BharatShopy. Our moderation team will review your store application for{" "}
            <strong className="break-words text-stone-900">{formData.storeName}</strong>. You will receive an email update at{" "}
            <strong className="break-all text-stone-900">{formData.email}</strong> once approved.
          </p>
          {warning && (
            <Notice tone="warn" className="mt-4 text-left">
              Your application is saved, but the confirmation email couldn't be sent. You don't need to apply again.
            </Notice>
          )}
          <div className="mt-6 grid gap-2">
            <Link to="/vendor/login" className="btn btn-primary">
              Go to vendor sign in
            </Link>
            <Link to="/" className="btn btn-ghost">
              Back to the marketplace
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      wide
      title="Apply to sell on BharatShopy"
      subtitle="Join local shopkeepers, artisans and farmers reaching customers across India. The BharatShopy team reviews every application."
      footer={
        <>
          Already an approved vendor?{" "}
          <Link to="/vendor/login" className="link font-semibold">
            Sign in here
          </Link>
        </>
      }
    >
      {error && (
        <Notice tone="error" className="mb-6">
          {error}
        </Notice>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormSection id="verify" step={1} title="Your email" description="We'll send a code to check it's yours. Your store sign-in uses this email.">
          <Field id="email" label="Email address">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="vendor@example.com"
                value={formData.email}
                onChange={handleInputChange}
                className={inputClass(false, "flex-1")}
              />
              <button type="button" onClick={handleRequestCode} disabled={codeLoading || !formData.email} className="btn btn-secondary">
                {codeLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                {codeSent ? "Resend code" : "Send code"}
              </button>
            </div>
          </Field>
          {codeSent && (
            <>
              <Notice tone="success" icon={CheckCircle2}>
                Verification code sent to <span className="break-all">{formData.email}</span>. Please check your inbox.
              </Notice>
              <Field id="code" label="6-digit verification code">
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={inputClass(false, "text-center text-xl font-bold tracking-widest sm:max-w-48")}
                />
              </Field>
            </>
          )}
        </FormSection>

        <FormSection id="about" step={2} title="You and your store">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="name" label="Your full name">
              <input id="name" name="name" type="text" autoComplete="name" required placeholder="For example, Ramesh Patel" value={formData.name} onChange={handleInputChange} className={inputClass(false)} />
            </Field>
            <Field id="storeName" label="Store or business name">
              <input id="storeName" name="storeName" type="text" required placeholder="For example, Patel Organics" value={formData.storeName} onChange={handleInputChange} className={inputClass(false)} />
            </Field>
          </div>
          <fieldset>
            <legend className="field-label">What you sell</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.values(ENTITY_TYPES).map((entity) => (
                <label
                  key={entity.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-stone-200 p-3 hover:border-stone-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-500"
                >
                  <input type="radio" name="entityType" value={entity.id} checked={formData.entityType === entity.id} onChange={handleInputChange} className="mt-1 accent-brand-700" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-900">{entity.label}</span>
                    <span className="block text-sm text-stone-500">{entity.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="description" label="Store description" optional>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Tell customers about the products or produce you sell"
              value={formData.description}
              onChange={handleInputChange}
              className={inputClass(false)}
            />
          </Field>
        </FormSection>

        <FormSection id="address" step={3} title="Store web address" description="Lowercase letters, numbers and hyphens. Suggested from your store name.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="slug" label="Store link name" hint={`Marketplace link: /shop/${formData.slug || "your-slug"}`}>
              <input id="slug" name="slug" type="text" required placeholder="patel-organics" value={formData.slug} onChange={handleInputChange} className={inputClass(false, "font-mono")} />
            </Field>
            <Field id="subdomain" label="Subdomain" hint={`Your own site: ${formData.subdomain || "your-store"}.bharatshopy.com`}>
              <input id="subdomain" name="subdomain" type="text" required placeholder="patel-organics" value={formData.subdomain} onChange={handleInputChange} className={inputClass(false, "font-mono")} />
            </Field>
          </div>
        </FormSection>

        <FormSection id="contact" step={4} title="Contact and location">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="phone" label="Phone or WhatsApp" optional>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 9876543210" value={formData.phone} onChange={handleInputChange} className={inputClass(false)} />
            </Field>
            <Field id="city" label="City" optional>
              <input id="city" name="city" type="text" autoComplete="address-level2" placeholder="For example, Pune" value={formData.city} onChange={handleInputChange} className={inputClass(false)} />
            </Field>
            <Field id="state" label="State" optional>
              <input id="state" name="state" type="text" autoComplete="address-level1" placeholder="For example, Maharashtra" value={formData.state} onChange={handleInputChange} className={inputClass(false)} />
            </Field>
          </div>
        </FormSection>

        <div className="flex justify-end">
          <button type="submit" disabled={loading || !codeSent} className="btn btn-primary btn-lg w-full sm:w-auto">
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            {loading ? "Submitting application…" : "Submit application"}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
