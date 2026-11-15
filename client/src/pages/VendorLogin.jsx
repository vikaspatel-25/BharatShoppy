import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout, Field, LoadingState, Notice, inputClass } from "@/components/panel/ui";
import { apiFetch } from "@/lib/apiClient";
import { getMarketplaceUrl } from "@/lib/domainUtils";
import { toMessage } from "@/lib/formatDate";

export default function VendorLogin() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState("email"); // 'email' | 'code'
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // A vendor who is already signed in goes straight to the portal
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/vendor/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.ok) navigate("/vendor", { replace: true });
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/vendor/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Failed to request verification code"));
      // The same response for known and unknown emails, so this page can't reveal who has an account
      setMessage(data.message || "If registered, a verification code was sent to your email.");
      setStep("code");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/vendor/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Verification failed"));
      setMessage("Authentication successful! Redirecting to dashboard...");
      setTimeout(() => navigate("/vendor"), 800);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="panel-root min-h-screen">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  return (
    <AuthLayout
      title="Sign in to your store"
      subtitle={step === "email" ? "We'll email you a 6-digit code. No password needed." : `Enter the code we sent to ${email}.`}
      footer={
        <>
          New to BharatShopy?{" "}
          <a href={getMarketplaceUrl("/vendor/apply")} className="link font-semibold">
            Apply for a vendor account
          </a>
        </>
      }
    >
      {error && (
        <Notice tone="error" className="mb-5">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" icon={CheckCircle2} className="mb-5">
          {message}
        </Notice>
      )}

      {step === "email" ? (
        <form onSubmit={handleRequestCode} className="space-y-5">
          <Field id="email" label="Email address">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass(false)}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Sending code…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-5">
          <Field id="code" label="6-digit code" hint={`Sent to ${email}. Code expires in 5 minutes.`}>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass(false, "text-center text-xl font-bold tracking-widest")}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Verifying…" : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setMessage("");
              setError("");
            }}
            className="btn btn-ghost w-full"
          >
            Change email address
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
