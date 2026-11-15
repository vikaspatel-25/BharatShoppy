import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, Loader2, Mail } from "lucide-react";
import { Field, Notice, inputClass } from "@/components/panel/ui";
import { useToast } from "@/context/ToastContext";
import { MAX_DAYS, MIN_DAYS, computeNewExpiry, isValidDuration } from "@/lib/adminFormat";
import { formatDisplayDate } from "@/lib/formatDate";
import { formatRupees } from "@/lib/vendorItems";

/** An email-failed warning that stays on the page, with a button to send it again. */
export function EmailWarning({ warning, onResend, className = "" }) {
  const [busy, setBusy] = useState(false);
  if (!warning) return null;
  return (
    <Notice tone="warn" icon={Mail} className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{warning} The change is saved.</span>
        {onResend && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onResend();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />} Resend email
          </button>
        )}
      </div>
    </Notice>
  );
}

/** Small copy-to-clipboard button for an email address or phone number. */
export function CopyButton({ value, label }) {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value));
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error(`The ${label} couldn't be copied.`);
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
}

/**
 * Plan cards as radio inputs, a duration from 1 to 366 days, and the end date that results.
 * The end date extends from the current expiry when that is later than today, as the server does.
 */
export function PlanChoice({ idPrefix, plans, planId, onPlan, days, onDays, currentExpiresAt, showPlans = true, durationError }) {
  const end = computeNewExpiry(currentExpiresAt, days);
  const extends_ = currentExpiresAt && new Date(currentExpiresAt) > new Date();
  return (
    <div className="space-y-5">
      {showPlans && (
        <fieldset>
          <legend className="field-label">Plan</legend>
          {plans.length === 0 ? (
            <p className="text-sm text-stone-500">Loading plans…</p>
          ) : (
            <div className="grid gap-2">
              {plans.map((p) => (
                <label
                  key={p.planId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-stone-200 p-3 hover:border-stone-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-500"
                >
                  <input type="radio" name={`${idPrefix}-plan`} value={p.planId} checked={planId === p.planId} onChange={() => onPlan(p.planId)} className="mt-1 accent-brand-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold break-words text-stone-900">{p.name}</span>
                    <span className="block text-sm text-stone-500">
                      {formatRupees(p.discountedPrice)}
                      {p.billingCycle ? ` ${p.billingCycle.toLowerCase()}` : ""} · {p.productMonthlyLimit} items · {p.maxImagesPerProduct} photos each
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <Field
        id={`${idPrefix}-days`}
        label="Duration in days"
        error={durationError || (!isValidDuration(days) && String(days) !== "" ? `Enter a whole number from ${MIN_DAYS} to ${MAX_DAYS}.` : "")}
        hint={end ? `${extends_ ? "Added to the current end date" : "Starts today"}. New end date: ${formatDisplayDate(end)}.` : undefined}
      >
        <input
          id={`${idPrefix}-days`}
          type="number"
          inputMode="numeric"
          min={MIN_DAYS}
          max={MAX_DAYS}
          step="1"
          value={days}
          onChange={(e) => onDays(e.target.value)}
          className={inputClass(!isValidDuration(days))}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {[30, 90, 180, 365].map((d) => (
          <button key={d} type="button" className="btn btn-ghost btn-sm" onClick={() => onDays(String(d))}>
            {d} days
          </button>
        ))}
      </div>
    </div>
  );
}

/** Previous and next page buttons. */
export function Pager({ page, totalPages, onPage, total, noun = "results" }) {
  if (!totalPages || totalPages <= 1) return total != null ? <p className="mt-4 text-sm text-stone-500">{total} {noun}</p> : null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pages">
      <p className="text-sm text-stone-500">
        Page {page} of {totalPages}
        {total != null ? ` · ${total} ${noun}` : ""}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={15} aria-hidden="true" /> Previous
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** Store name kept readable: two lines, with the full text on hover. */
export function ClampedName({ children, className = "" }) {
  const text = String(children ?? "");
  return (
    <span className={`line-clamp-2 break-words ${className}`} title={text}>
      {text}
    </span>
  );
}
