import { useState } from "react";
import { Link } from "react-router-dom";
import { Store, Mail, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/apiClient.js";

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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-suggest slug & subdomain when storeName changes if not explicitly typed
      if (name === "storeName") {
        const generatedSlug = value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (!prev.slug || prev.slug === prev.storeName?.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
          updated.slug = generatedSlug;
        }
        if (!prev.subdomain || prev.subdomain === prev.storeName?.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
          updated.subdomain = generatedSlug;
        }
      }
      return updated;
    });
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }

    try {
      setCodeLoading(true);
      const res = await apiFetch("/api/vendor/apply/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code.");
      }

      setCodeSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!codeSent) {
      setError("Please request a verification code first.");
      return;
    }

    if (!code.trim() || code.trim().length !== 6) {
      setError("Please enter the 6-digit verification code sent to your email.");
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
          address: {
            city: formData.city,
            state: formData.state,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit application.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full mx-auto bg-white p-8 border border-slate-200 rounded-2xl shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Submitted!</h2>
          <p className="text-slate-600 text-sm mb-6">
            Thank you for applying to sell on BharatShopy. Our moderation team will review your
            store application for <strong>{formData.storeName}</strong>. You will receive an email update
            at <strong>{formData.email}</strong> once approved.
          </p>
          <div className="space-y-3">
            <Link
              to="/vendor/login"
              className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm"
            >
              Go to Vendor Login
            </Link>
            <Link
              to="/"
              className="w-full inline-flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-600/10 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Apply to Sell on BharatShopy
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Join local shopkeepers, artisans, and farmers reaching customers across India.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Applicant Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Business / Store Name *
                </label>
                <input
                  type="text"
                  name="storeName"
                  required
                  value={formData.storeName}
                  onChange={handleInputChange}
                  placeholder="e.g. Patel Organics"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Applicant Email Address *
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="vendor@example.com"
                  className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleRequestCode}
                  disabled={codeLoading || !formData.email}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50 transition flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Mail className="w-4 h-4" />
                  <span>{codeSent ? "Resend Code" : "Send Code"}</span>
                </button>
              </div>
              {codeSent && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  Verification code sent to {formData.email}. Please check your inbox.
                </p>
              )}
            </div>

            {codeSent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  6-Digit Verification Code *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full tracking-widest text-center font-mono font-bold text-lg px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Store Slug *
                </label>
                <input
                  type="text"
                  name="slug"
                  required
                  value={formData.slug}
                  onChange={handleInputChange}
                  placeholder="patel-organics"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Storefront URL: /store/{formData.slug || "your-slug"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subdomain *
                </label>
                <input
                  type="text"
                  name="subdomain"
                  required
                  value={formData.subdomain}
                  onChange={handleInputChange}
                  placeholder="patel-organics"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Subdomain: {formData.subdomain || "your-store"}.bharatshopy.com
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone / WhatsApp Number
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Business Entity Type
                </label>
                <select
                  name="entityType"
                  value={formData.entityType}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="shopkeeper">Shopkeeper / Retailer</option>
                  <option value="farmer">Farmer / Agro Producer</option>
                  <option value="artisan">Artisan / Handcrafter</option>
                  <option value="service">Service Provider</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="e.g. Pune"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Store Description
              </label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Tell customers about the products or produce you sell..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !codeSent}
                className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Submitting Application...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Submit Vendor Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already registered as an approved vendor?{" "}
              <Link to="/vendor/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
