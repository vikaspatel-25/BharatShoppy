import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  LogOut,
  AlertTriangle,
  Zap,
  Building2,
  Clock,
  UserCheck,
} from "lucide-react";
import { apiFetch } from "../lib/apiClient.js";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("applications"); // 'applications' | 'subscriptions' | 'direct'
  const [requests, setRequests] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Direct store control inputs
  const [targetStoreId, setTargetStoreId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("yearly_standard");
  const [durationDays, setDurationDays] = useState(365);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch both applications and subscription requests
      const [appRes, subRes] = await Promise.all([
        apiFetch("/api/admin/vendor-applications"),
        apiFetch("/api/admin/subscription-requests"),
      ]);

      if (appRes.status === 401 || subRes.status === 401) {
        navigate("/admin/login");
        return;
      }

      if (appRes.ok) {
        const appData = await appRes.json();
        setApplications(appData.applications || []);
      }

      if (subRes.ok) {
        const subData = await subRes.json();
        setRequests(subData.requests || []);
      }
    } catch (err) {
      console.error("Admin fetch error:", err);
      setFeedback({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleApproveApplication = async (appId) => {
    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/admin/vendor-applications/${appId}/approve`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to approve vendor application");
      }

      setFeedback({
        type: "success",
        message: data.message || "Vendor application approved and store provisioned!",
      });
      fetchDashboardData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectApplication = async (appId) => {
    const reason = window.prompt("Please enter the reason for rejecting this vendor application:");
    if (!reason || !reason.trim()) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/admin/vendor-applications/${appId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to reject vendor application");
      }

      setFeedback({
        type: "warning",
        message: "Vendor application rejected.",
      });
      fetchDashboardData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (requestId, action) => {
    try {
      setActionLoading(true);
      const res = await apiFetch(
        `/api/admin/subscription-requests/${requestId}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${action} request`);
      }

      setFeedback({
        type: "success",
        message: `Request successfully ${action === "approve" ? "approved" : "rejected"}!`,
      });
      fetchDashboardData();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectRenew = async (e) => {
    e.preventDefault();
    if (!targetStoreId.trim()) {
      setFeedback({ type: "error", message: "Please specify a Store ID" });
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(`/api/admin/store/${targetStoreId.trim()}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan,
          durationDays: Number(durationDays) || 365,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to renew subscription");
      }

      setFeedback({
        type: "success",
        message: data.message || `Store ${targetStoreId} plan renewed successfully!`,
      });
      setTargetStoreId("");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDirectDiscontinue = async (e) => {
    e.preventDefault();
    if (!targetStoreId.trim()) {
      setFeedback({ type: "error", message: "Please specify a Store ID" });
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to discontinue the subscription for store "${targetStoreId.trim()}"?`
      )
    ) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiFetch(
        `/api/admin/store/${targetStoreId.trim()}/discontinue`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to discontinue subscription");
      }

      setFeedback({
        type: "warning",
        message: data.message || `Store ${targetStoreId} subscription discontinued.`,
      });
      setTargetStoreId("");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      navigate("/admin/login");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Admin Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                BharatShopy Admin Moderation Desk
              </h1>
              <p className="text-xs text-slate-400">
                Vendor applications, subscriptions & store lifecycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/10 text-rose-300 border border-rose-500/20 hover:bg-rose-600/20 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 border-t border-slate-800/60 pt-2 pb-2">
          <button
            onClick={() => setActiveTab("applications")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === "applications"
                ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Vendor Applications ({applications.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === "subscriptions"
                ? "bg-slate-800 text-orange-400 border border-orange-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Subscription Requests ({requests.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("direct")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 ${
              activeTab === "direct"
                ? "bg-slate-800 text-rose-400 border border-rose-500/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Direct Store Override</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {feedback && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center gap-3 ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                : feedback.type === "warning"
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                : "bg-rose-500/10 border border-rose-500/30 text-rose-300"
            }`}
          >
            {feedback.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
            {feedback.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
            {feedback.type === "error" && <XCircle className="w-5 h-5 text-rose-400" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tab 1: Vendor Applications */}
        {activeTab === "applications" && (
          <section className="bg-slate-800/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  Vendor Onboarding Applications
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review email-verified prospective vendor submissions and approve storefronts
                </p>
              </div>
              <span className="text-xs bg-slate-700/80 text-slate-300 px-3 py-1 rounded-full font-mono">
                {applications.length} Total
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading vendor applications...
              </div>
            ) : applications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-700/60 rounded-xl">
                No vendor applications found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Store & Applicant</th>
                      <th className="py-3 px-4">Slug & Subdomain</th>
                      <th className="py-3 px-4">Entity / Category</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {applications.map((app) => (
                      <tr key={app._id} className="hover:bg-slate-750/30 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">
                            {app.storeName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {app.name} ({app.email})
                          </div>
                          {app.phone && (
                            <div className="text-[11px] text-slate-500">
                              Phone: {app.phone}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                          <div>/{app.slug}</div>
                          <div className="text-emerald-400">{app.subdomain}.bharatshopy.com</div>
                        </td>
                        <td className="py-3.5 px-4 capitalize">
                          <div className="text-white font-medium">{app.entityType || "shopkeeper"}</div>
                          <div className="text-[11px] text-slate-400">{app.storeCategory}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {app.address?.city ? `${app.address.city}, ${app.address?.state || ""}` : "N/A"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide ${
                              app.status === "approved"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : app.status === "rejected"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {app.status}
                          </span>
                          {app.rejectionReason && (
                            <div className="text-[10px] text-rose-400 mt-1 max-w-[180px] truncate" title={app.rejectionReason}>
                              Reason: {app.rejectionReason}
                            </div>
                          )}
                          {app.storeId && (
                            <div className="text-[10px] font-mono text-emerald-400 mt-1">
                              ID: {app.storeId}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {app.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleApproveApplication(app._id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs disabled:opacity-50 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectApplication(app._id)}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-md bg-rose-700/60 hover:bg-rose-600 text-rose-200 font-medium text-xs disabled:opacity-50 transition"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Decided</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Subscription Requests */}
        {activeTab === "subscriptions" && (
          <section className="bg-slate-800/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-400" />
                  Subscription Payment Requests
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review offline vendor payments and activate subscription tiers
                </p>
              </div>
              <span className="text-xs bg-slate-700/80 text-slate-300 px-3 py-1 rounded-full font-mono">
                {requests.length} Total
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Loading payment requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-700/60 rounded-xl">
                No pending subscription requests at this time.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Store Info</th>
                      <th className="py-3 px-4">Plan Requested</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Vendor Note</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {requests.map((req) => (
                      <tr key={req.requestId} className="hover:bg-slate-750/30 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">
                            {req.storeName || "Store"}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {req.storeId}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-orange-400 capitalize">
                          {req.planName || req.planId?.replace(/_/g, " ")}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          ₹{req.amount}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                          {req.vendorNote || "None provided"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wide ${
                              req.status === "approved"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : req.status === "rejected"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          {req.status === "pending" ? (
                            <>
                              <button
                                onClick={() => handleVerify(req.requestId, "approve")}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs disabled:opacity-50 transition"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleVerify(req.requestId, "reject")}
                                disabled={actionLoading}
                                className="px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-xs disabled:opacity-50 transition"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Direct Store Moderation (Renew / Discontinue) */}
        {activeTab === "direct" && (
          <section className="bg-slate-800/60 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-400" />
                Direct Store Moderation & Lifecycle Actions
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Direct administrative overrides to renew or discontinue a store subscription
              </p>
            </div>

            <form className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-slate-950/40 p-4 rounded-xl border border-slate-800">
              <div>
                <label
                  htmlFor="storeId"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Store Identifier (ID or Slug)
                </label>
                <input
                  id="storeId"
                  type="text"
                  placeholder="e.g. store_farmer_01 or kisan-organics"
                  value={targetStoreId}
                  onChange={(e) => setTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-rose-500 focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="planSelect"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Subscription Plan
                </label>
                <select
                  id="planSelect"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                >
                  <option value="starter_free">Starter Free Trial</option>
                  <option value="yearly_standard">Boutique & Farm Standard (₹1,200/yr)</option>
                  <option value="yearly_pro">Enterprise Pro Unlimited (₹2,400/yr)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="durationDays"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Duration (Days)
                </label>
                <input
                  id="durationDays"
                  type="number"
                  min="1"
                  max="366"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDirectRenew}
                  disabled={actionLoading || !targetStoreId}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Renew</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectDiscontinue}
                  disabled={actionLoading || !targetStoreId}
                  className="py-2 px-3 rounded-lg text-xs font-bold bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Discontinue</span>
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
