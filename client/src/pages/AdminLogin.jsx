import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient.js";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState("credentials"); // 'credentials' | 'code'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Admin login failed");
      }

      setTempToken(data.tempToken);
      setMessage(data.message || "A 6-digit 2FA code has been sent to your admin email.");
      setStep("code");
    } catch (err) {
      setError(err.message);
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
      const res = await apiFetch("/api/admin/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Code verification failed");
      }

      setMessage("Admin authorized successfully! Redirecting...");
      setTimeout(() => {
        navigate("/admin");
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          Restricted System
        </span>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          BharatShopy Admin Desk
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Internal administrative & moderation portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 py-8 px-6 shadow-xl rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          {step === "credentials" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-300"
                >
                  Admin Email
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="admin@bharatshopy.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-300"
                >
                  Master Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Verifying..." : "Verify Password & Send 2FA"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-slate-300"
                >
                  Enter 6-Digit Email Code
                </label>
                <div className="mt-1">
                  <input
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="block w-full text-center text-xl font-bold tracking-widest px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  Sent to {email}. Code expires in 10 minutes.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("credentials")}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                >
                  Back to password
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Authorizing..." : "Authenticate Admin Session"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
