import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { toMessage } from "@/lib/formatDate";

/**
 * Loads the store's plan status from the server, which computes it from the end date
 * with the one shared rule. Returns { info, loading, error, reload }.
 * info: { subscription: { computedStatus, planName, expiresAt, remainingDays, isExpiringSoon, ... },
 *         limits: { productMonthlyLimit, maxImagesPerProduct, currentProductCount }, recentRequests }
 */
export function useVendorPlan(storeId) {
  const [state, setState] = useState({ info: null, loading: true, error: "" });

  const load = useCallback(async () => {
    if (!storeId) return;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}/subscription`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, "Your plan details could not be loaded."));
      setState({ info: data, loading: false, error: "" });
    } catch (err) {
      setState({ info: null, loading: false, error: toMessage(err, "Your plan details could not be loaded.") });
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}

/** Badge tone and label for a computed plan status. */
export function planStatusBadge(sub) {
  const status = sub?.computedStatus;
  if (status === "active" && sub?.isExpiringSoon) return { tone: "warn", label: "Ending soon" };
  if (status === "active") return { tone: "success", label: "Active" };
  if (status === "expired") return { tone: "danger", label: "Ended" };
  if (status === "removal_hold") return { tone: "danger", label: "Being removed" };
  return { tone: "neutral", label: "No plan" };
}
