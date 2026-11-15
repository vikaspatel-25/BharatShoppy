import { useEffect, useState } from "react";
import { Check, CheckCircle2, Clock, Loader2, Send } from "lucide-react";
import { Field, FormSection, LoadingState, Notice, PageHeader, StatusBadge, UsageBar, inputClass } from "@/components/panel/ui";
import { PlanBanner } from "@/components/vendor/vendorParts";
import { useVendorSession } from "@/context/PanelSession";
import { useToast } from "@/context/ToastContext";
import { planStatusBadge, useVendorPlan } from "@/hooks/useVendorPlan";
import { apiFetch } from "@/lib/apiClient";
import { formatDisplayDate, toMessage } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";
import { countActiveItems, formatRupees, getUploadAllowance, planFeatureLines } from "@/lib/vendorItems";

const REQUEST_BADGE = {
  pending: { tone: "warn", label: "Waiting" },
  approved: { tone: "success", label: "Activated" },
  rejected: { tone: "danger", label: "Declined" },
};

export default function VendorPlan() {
  const { store, storeId, products, reload: reloadStore } = useVendorSession();
  const { info, loading, error, reload } = useVendorPlan(storeId);
  const { toast } = useToast();
  const [plans, setPlans] = useState(null);
  const [plansError, setPlansError] = useState("");
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/subscription/plans")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(toMessage(data, "Plans could not be loaded."));
        if (!cancelled) setPlans(Array.isArray(data.plans) ? data.plans : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setPlans([]);
          setPlansError(toMessage(err, "Plans could not be loaded."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sub = info?.subscription;
  const requests = Array.isArray(info?.recentRequests) ? info.recentRequests : [];
  const pending = requests.find((r) => r.status === "pending");
  const badge = planStatusBadge(sub);
  const allowance = getUploadAllowance(store, countActiveItems(products));
  const photoLimit = Number(store?.limits?.maxImagesPerProduct) || 5;
  const removal = store?.removalStatus === "pending_deletion";

  // Until the vendor picks one, the current plan is selected, so "renew" is one click
  const selectedId = selected || plans?.find((p) => p.planId === sub?.plan)?.planId || "";
  const chosen = plans?.find((p) => p.planId === selectedId) || null;

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    if (!chosen) {
      setNotice({ tone: "error", message: "Choose a plan first." });
      scrollToTop();
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}/subscription-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: chosen.planId, vendorNote: note.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 409 ? "You already have a request waiting. The BharatShopy team will contact you about it." : toMessage(data, "Your request couldn't be sent.")
        );
      }
      const msg = `Your request for ${chosen.name} is sent. The BharatShopy team will contact you about payment, then switch the plan on.`;
      setNotice({ tone: "success", message: msg });
      toast.success("Plan request sent.");
      setNote("");
      await Promise.all([reload(), reloadStore().catch(() => {})]);
    } catch (err) {
      const msg = toMessage(err);
      setNotice({ tone: "error", message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
      scrollToTop();
    }
  };

  return (
    <>
      <PlanBanner store={store} sub={sub} />
      <PageHeader title="Plan and usage" description="Your current plan, how much of it you're using, and how to renew or change it." />

      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {error && (
        <Notice tone="error" className="mb-6">
          {error}
        </Notice>
      )}

      {loading && !info ? (
        <LoadingState label="Loading your plan…" />
      ) : (
        <div className="space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="current-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-stone-500">Current plan</p>
                <h2 id="current-title" className="mt-0.5 text-xl font-bold break-words">
                  {sub?.planName || (sub?.plan ? "Plan details unavailable" : "No plan yet")}
                </h2>
                {sub?.expiresAt && (
                  <p className="mt-1 text-sm text-stone-600">
                    {sub.computedStatus === "active"
                      ? `Ends on ${formatDisplayDate(sub.expiresAt)}, ${sub.remainingDays} ${sub.remainingDays === 1 ? "day" : "days"} left`
                      : `Ended on ${formatDisplayDate(sub.expiresAt)}`}
                  </p>
                )}
              </div>
              <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <UsageBar label="Active items" used={allowance.used} limit={allowance.limit} />
              <div className="text-sm">
                <p className="font-medium text-stone-800">Photos per item</p>
                <p className="mt-1 text-stone-600">Up to {photoLimit}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-stone-500">Switched-off items don't count toward the limit, and the limit doesn't reset.</p>
          </section>

          {pending && (
            <Notice tone="info" icon={Clock}>
              Your request for <strong>{pending.planName}</strong> sent on {formatDisplayDate(pending.createdAt)} is waiting. The BharatShopy team will contact you about payment,
              then switch the plan on.
            </Notice>
          )}

          {!removal && (
            <form onSubmit={submit} className="space-y-6">
              <FormSection
                id="choose"
                step={1}
                title={sub?.plan ? "Renew or change your plan" : "Choose a plan"}
                description="Payment is made directly to the BharatShopy team. Nothing is charged on this site."
              >
                {plansError && <Notice tone="error">{plansError}</Notice>}
                {plans === null ? (
                  <LoadingState label="Loading plans…" />
                ) : (
                  <fieldset>
                    <legend className="sr-only">Plans</legend>
                    <div className="grid gap-4 md:grid-cols-3">
                      {plans.map((plan) => {
                        const current = plan.planId === sub?.plan;
                        return (
                          <label
                            key={plan.planId}
                            className="relative flex cursor-pointer flex-col rounded-lg border-2 border-stone-200 p-5 hover:border-stone-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-500"
                          >
                            <input
                              type="radio"
                              name="plan"
                              value={plan.planId}
                              checked={selectedId === plan.planId}
                              onChange={() => setSelected(plan.planId)}
                              disabled={Boolean(pending)}
                              className="sr-only"
                            />
                            <span className="flex items-start justify-between gap-2">
                              <span className="text-base font-bold break-words text-stone-900">{plan.name}</span>
                              {current ? <StatusBadge tone="brand">Your plan</StatusBadge> : plan.badge ? <StatusBadge tone="neutral">{plan.badge}</StatusBadge> : null}
                            </span>
                            <span className="mt-3 flex flex-wrap items-baseline gap-2">
                              <span className="text-2xl font-extrabold text-stone-900">{formatRupees(plan.discountedPrice)}</span>
                              {plan.billingCycle && <span className="text-sm text-stone-500">{plan.billingCycle}</span>}
                              {Number(plan.originalPrice) > Number(plan.discountedPrice) && (
                                <span className="text-sm text-stone-400 line-through">{formatRupees(plan.originalPrice)}</span>
                              )}
                            </span>
                            <ul className="mt-4 space-y-2 text-sm text-stone-700">
                              {planFeatureLines(plan).map((line) => (
                                <li key={line} className="flex items-start gap-2">
                                  <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
              </FormSection>

              <FormSection id="send" step={2} title="Send your request">
                <Field id="vendorNote" label="Note for the team" optional hint="For example, the best time to call you, or how you plan to pay.">
                  <textarea id="vendorNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={Boolean(pending)} className={inputClass(false)} />
                </Field>
                <p className="text-sm text-stone-600">
                  After you send this, the BharatShopy team contacts you about payment. Your plan is switched on once they confirm it. If you renew early, the new time is added after your
                  current end date.
                </p>
                <div className="flex justify-end">
                  <button type="submit" disabled={sending || Boolean(pending) || !chosen} className="btn btn-primary">
                    {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    {sending ? "Sending…" : chosen ? `Request ${chosen.name}` : "Choose a plan"}
                  </button>
                </div>
              </FormSection>
            </form>
          )}

          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title" className="border-b border-stone-100 px-5 py-4 text-base font-semibold">
              Your requests
            </h2>
            {requests.length === 0 ? (
              <p className="px-5 py-6 text-sm text-stone-500">You haven't sent a plan request yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {requests.map((r) => {
                  const b = REQUEST_BADGE[r.status] || { tone: "neutral", label: r.status };
                  return (
                    <li key={r._id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium break-words text-stone-900">
                          {r.planName || "Plan"} <span className="font-normal text-stone-500">· {formatRupees(r.discountedPrice)}</span>
                        </p>
                        <p className="text-sm text-stone-500">Sent on {formatDisplayDate(r.createdAt)}</p>
                        {r.status === "rejected" && r.adminNotes && <p className="mt-1 text-sm text-red-800">Reason: {r.adminNotes}</p>}
                      </div>
                      <StatusBadge tone={b.tone}>{b.label}</StatusBadge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
