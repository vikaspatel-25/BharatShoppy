import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout, Field, LoadingState, Notice, inputClass } from "@/components/panel/ui";
import { apiFetch } from "@/lib/apiClient";
import { toMessage } from "@/lib/formatDate";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState("credentials"); // 'credentials' | 'code'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // An admin who is already signed in goes straight to the panel
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/auth/me")
      .then((res) => {
        if (cancelled) return;
        if (res.ok) navigate("/admin", { replace: true });
        else setChecking(false);
      })
      .catch(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Admin login failed"));
      setTempToken(data.tempToken);
      setMessage(data.message || "A 6-digit 2FA code has been sent to your admin email.");
      setStep("code");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      // The code step only works with the token from a completed password step
      const res = await apiFetch("/api/admin/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Code verification failed"));
      setMessage("Admin authorized successfully! Redirecting...");
      setTimeout(() => navigate("/admin"), 800);
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
      title="Admin sign in"
      subtitle={step === "credentials" ? "For the BharatShopy team only. A code is emailed after your password." : `Enter the code sent to ${email}.`}
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

      {step === "credentials" ? (
        <form onSubmit={handleLogin} className="space-y-5">
          <Field id="email" label="Admin email">
            <input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass(false)} />
          </Field>
          <Field id="password" label="Password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass(false)}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="space-y-5">
          <Field id="code" label="6-digit email code" hint={`Sent to ${email}. Code expires in 10 minutes.`}>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass(false, "text-center text-xl font-bold tracking-widest")}
            />
          </Field>
          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setMessage("");
              setError("");
            }}
            className="btn btn-ghost w-full"
          >
            Back to password
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
