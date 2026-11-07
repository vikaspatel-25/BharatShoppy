import { useState, useEffect } from "react";
import {
  Check,
  AlertCircle,
  Zap,
  ShieldCheck,
  ArrowUpRight,
  X,
  Calendar,
  Package,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";

export default function SubscriptionManager({
  storeId,
  onSubscriptionUpdated,
}) {
  const [plans, setPlans] = useState([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Request Modal State
  const [selectedPlanForRequest, setSelectedPlanForRequest] = useState(null);
  const [vendorNote, setVendorNote] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansRes, infoRes] = await Promise.all([
        apiFetch("/api/subscription/plans"),
        apiFetch(`/api/vendor/store/${storeId}/subscription`),
      ]);

      if (!plansRes.ok || !infoRes.ok) {
        throw new Error("Failed to load subscription information");
      }

      const plansData = await plansRes.json();
      const infoData = await infoRes.json();

      setPlans(plansData.plans || []);
      setSubscriptionInfo(infoData);
    } catch (err) {
      console.error("Subscription load error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (storeId) {
      fetchSubscriptionData();
    }
  }, [storeId]);

  const handleOpenRequestModal = (plan) => {
    setSelectedPlanForRequest(plan);
    setVendorNote("");
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!selectedPlanForRequest) return;

    try {
      setSubmittingRequest(true);
      const res = await apiFetch(`/api/vendor/store/${storeId}/subscription-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlanForRequest.planId,
          vendorNote,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit request");
      const data = await res.json();

      setSelectedPlanForRequest(null);
      setActionFeedback({
        type: "success",
        message: data.message || "Request submitted successfully!",
      });

      fetchSubscriptionData();
      if (onSubscriptionUpdated) onSubscriptionUpdated();
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err) {
      setActionFeedback({ type: "error", message: err.message });
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loading && !subscriptionInfo) {
    return (
      <div className="p-12 text-center text-stone-400 text-xs">
        Loading subscription and quota metrics...
      </div>
    );
  }

  const sub = subscriptionInfo?.subscription;
  const usage = subscriptionInfo?.usage;
  const isExpired = sub?.isExpired || sub?.status === "expired";

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Feedback Alert */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : actionFeedback.type === "warning"
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {actionFeedback.type === "success" ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* 1. CURRENT SUBSCRIPTION & QUOTA STATUS HERO */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Current Plan
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isExpired
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : sub?.status === "active"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}
              >
                {isExpired ? "Subscription Expired" : sub?.status || "Active"}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-stone-900 mt-1 capitalize">
              {sub?.plan?.replace(/_/g, " ") || "Boutique Standard Annual"}
            </h3>

            <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              {isExpired ? (
                <span className="text-red-600 font-semibold">
                  Lapsed on {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "Recent"}
                </span>
              ) : (
                <span>
                  Active until {sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "Next Year"} ({sub?.daysRemaining || 365} days remaining)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const upgradePlan =
                  plans.find((p) => p.planId === "yearly_standard") || plans[0] || null;
                setSelectedPlanForRequest(upgradePlan);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition shadow-xs"
            >
              <Zap className="w-4 h-4" />
              <span>Renew / Upgrade Plan</span>
            </button>
          </div>
        </div>

        {/* Product Quota Utilization Meter */}
        <div className="pt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-stone-800">
              Total Active Catalog Items Quota
            </span>
            <span className="font-semibold text-stone-600">
              {usage?.totalProducts || 0} / {usage?.limit || 50} Items ({usage?.percentageUsed || 0}%)
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                (usage?.percentageUsed || 0) >= 90
                  ? "bg-red-500"
                  : (usage?.percentageUsed || 0) >= 70
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, usage?.percentageUsed || 0)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-400">
            <span>
              {usage?.remaining || 0} upload slots remaining on current tier
            </span>
            <span>Max {subscriptionInfo?.limits?.maxImagesPerProduct || 8} photos per item</span>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC SUBSCRIPTION PLANS GRID */}
      <div>
        <div className="mb-4">
          <h3 className="text-base font-bold text-stone-900">
            Available BharatShopy Growth Plans
          </h3>
          <p className="text-xs text-stone-500">
            Select a plan to request immediate renewal, unlock higher catalog limits, and verified store badges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = sub?.plan === plan.planId;
            return (
              <div
                key={plan.planId}
                className={`relative bg-white rounded-2xl p-5 border-2 transition flex flex-col justify-between ${
                  isCurrent
                    ? "border-orange-600 shadow-md ring-2 ring-orange-500/20"
                    : "border-stone-200 hover:border-stone-300"
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <span
                    className={`absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isCurrent
                        ? "bg-orange-600 text-white"
                        : "bg-stone-900 text-white"
                    }`}
                  >
                    {isCurrent ? "Current Plan" : plan.badge}
                  </span>
                )}

                <div>
                  <h4 className="font-extrabold text-stone-900 text-base">{plan.name}</h4>
                  <p className="text-xs text-stone-500 mt-0.5">{plan.billingCycle}</p>

                  {/* Pricing Display */}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-stone-900">
                      ₹{plan.discountedPrice?.toLocaleString("en-IN")}
                    </span>
                    {plan.originalPrice > plan.discountedPrice && (
                      <span className="text-xs line-through text-stone-400">
                        ₹{plan.originalPrice?.toLocaleString("en-IN")}
                      </span>
                    )}
                    {plan.discountPercentage > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        {plan.discountPercentage}% OFF
                      </span>
                    )}
                  </div>

                  <div className="mt-3 p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs text-stone-700 font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>Up to {plan.productMonthlyLimit} Items in Catalog</span>
                  </div>

                  {/* Features List */}
                  <ul className="mt-4 space-y-2 text-xs text-stone-600">
                    {plan.features?.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-5 mt-4 border-t border-stone-100">
                  <button
                    onClick={() => handleOpenRequestModal(plan)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? "bg-stone-100 text-stone-800 hover:bg-stone-200"
                        : "bg-stone-900 text-white hover:bg-stone-800 shadow-xs"
                    }`}
                  >
                    <span>{isCurrent ? "Renew This Plan" : "Choose & Activate"}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SUBSCRIPTION REQUESTS HISTORY */}
      {subscriptionInfo?.requests?.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs">
          <h4 className="font-bold text-stone-900 text-sm mb-3">
            Subscription Request History
          </h4>
          <div className="divide-y divide-stone-100 text-xs">
            {subscriptionInfo.requests.map((req) => (
              <div key={req._id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-stone-900">{req.planName}</span>
                  <span className="text-stone-400 text-[11px] ml-2">
                    ₹{req.discountedPrice}
                  </span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Requested on {new Date(req.createdAt).toLocaleDateString()}
                    {req.adminNotes && ` · Note: ${req.adminNotes}`}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    req.status === "approved"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : req.status === "rejected"
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. REQUEST ACTIVATION MODAL */}
      {selectedPlanForRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setSelectedPlanForRequest(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold text-stone-900 text-base">
                Activate {selectedPlanForRequest.name}
              </h3>
              <button
                onClick={() => setSelectedPlanForRequest(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div className="flex justify-between font-semibold text-stone-800">
                  <span>Annual Subscription:</span>
                  <span className="font-bold">
                    ₹{selectedPlanForRequest.discountedPrice?.toLocaleString("en-IN")}/yr
                  </span>
                </div>
                <div className="flex justify-between text-stone-500 text-[11px] mt-1">
                  <span>Product Limit:</span>
                  <span>{selectedPlanForRequest.productMonthlyLimit} items</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Vendor Note / Payment Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Annual renewal / Bank transfer ref #1234..."
                  value={vendorNote}
                  onChange={(e) => setVendorNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForRequest(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 disabled:opacity-50"
                >
                  {submittingRequest ? "Submitting..." : "Submit Activation Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
