import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/apiClient.js";

export default function VendorLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState("phone"); // 'phone' | 'otp'
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/vendor/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to request verification code");
      }

      setMessage(data.message || "Verification code sent to your phone via SMS");
      setStep("otp");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/vendor/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Verification failed");
      }

      setMessage("Authentication successful! Redirecting to dashboard...");
      setTimeout(() => {
        if (data.vendor?.storeId) {
          navigate(`/vendor/${data.vendor.storeId}`);
        } else {
          navigate("/vendor");
        }
      }, 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          BharatShopy
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Vendor & Store Owner Sign In
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-6">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-slate-700"
                >
                  Mobile Phone Number
                </label>
                <div className="mt-1">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="e.g. 9876543210 or +919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  We'll send a 6-digit one-time code to verify your store ownership.
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {loading ? "Sending Code..." : "Send Verification Code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-slate-700"
                >
                  Enter 6-Digit Verification Code
                </label>
                <div className="mt-1">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="appearance-none tracking-widest text-center text-xl font-bold block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm placeholder-slate-300 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Sent to {phone}. Code expires in 5 minutes.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-500"
                >
                  Change phone number
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
