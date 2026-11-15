import { useCallback, useEffect, useState } from "react";
import { Check, CheckCircle2, Info, Loader2, Percent, Save } from "lucide-react";
import { EmptyState, Field, FormSection, LoadingState, Notice, PageHeader, StatusBadge, inputClass } from "@/components/panel/ui";
import { useToast } from "@/context/ToastContext";
import { adminRequest } from "@/lib/adminApi";
import { scrollToTop } from "@/lib/scrollPanel";
import { discountPercent, formatRupees, planFeatureLines } from "@/lib/vendorItems";

const NUMBER_FIELDS = ["originalPrice", "discountedPrice", "productMonthlyLimit", "maxImagesPerProduct", "sortOrder"];

function toForm(plan) {
  return {
    name: plan.name || "",
    originalPrice: String(plan.originalPrice ?? 0),
    discountedPrice: String(plan.discountedPrice ?? 0),
    productMonthlyLimit: String(plan.productMonthlyLimit ?? ""),
    maxImagesPerProduct: String(plan.maxImagesPerProduct ?? ""),
    sortOrder: String(plan.sortOrder ?? 0),
    extraFeatures: (plan.extraFeatures || []).join("\n"),
    isPopular: Boolean(plan.isPopular),
    isActive: plan.isActive !== false,
  };
}

/** Only the fields that changed, typed the way the server expects. */
function changes(plan, form) {
  const before = toForm(plan);
  const body = {};
  if (form.name.trim() !== before.name) body.name = form.name.trim();
  for (const k of NUMBER_FIELDS) if (form[k] !== before[k]) body[k] = form[k] === "" ? NaN : Number(form[k]);
  const lines = form.extraFeatures.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.join("\n") !== before.extraFeatures) body.extraFeatures = lines;
  if (form.isPopular !== before.isPopular) body.isPopular = form.isPopular;
  if (form.isActive !== before.isActive) body.isActive = form.isActive;
  return body;
}

export default function AdminPlans() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await adminRequest("/api/admin/plans");
    if (r.ok) {
      setPlans(Array.isArray(r.data.plans) ? r.data.plans : []);
      setError("");
    } else {
      setPlans((p) => p || []);
      setError(r.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Plans and limits" description="Prices, item limits and photo limits for each plan. Plans can be switched off, not deleted." />
      <Notice tone="info" icon={Info} className="mb-6">
        A change doesn't affect any store straight away. Each store gets the new limits the next time its plan is activated or renewed. New stores get the starter plan's limits when
        they're approved.
      </Notice>
      {error && (
        <Notice tone="error" className="mb-6">
          {error}
        </Notice>
      )}
      {plans === null ? (
        <LoadingState label="Loading plans…" />
      ) : plans.length === 0 ? (
        <EmptyState icon={Percent} title="No plans found" />
      ) : (
        <div className="space-y-6">
          {plans.map((plan, i) => (
            <PlanEditor key={plan.planId} plan={plan} step={i + 1} onSaved={load} />
          ))}
        </div>
      )}
    </>
  );
}

function PlanEditor({ plan, step, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(() => toForm(plan));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const id = `plan-${plan.planId}`;
  const body = changes(plan, form);
  const dirty = Object.keys(body).length > 0;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const preview = planFeatureLines({
    productMonthlyLimit: Number(form.productMonthlyLimit),
    maxImagesPerProduct: Number(form.maxImagesPerProduct),
    extraFeatures: form.extraFeatures.split("\n").map((l) => l.trim()).filter(Boolean),
  });

  const save = async (e) => {
    e.preventDefault();
    setNotice(null);
    setSaving(true);
    const r = await adminRequest(`/api/admin/plans/${encodeURIComponent(plan.planId)}`, { method: "PUT", body });
    setSaving(false);
    if (r.ok) {
      const msg = `${r.data.plan?.name || plan.name} is saved. Stores get the new limits at their next activation or renewal.`;
      setNotice({ tone: "success", message: msg });
      toast.success("Plan saved.");
      if (r.data.plan) setForm(toForm(r.data.plan));
      await onSaved();
    } else {
      setNotice({ tone: "error", message: r.message });
      toast.error(r.message);
      scrollToTop();
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <FormSection
        id={id}
        step={step}
        title={plan.name}
        description={`${plan.storesOnPlan || 0} ${plan.storesOnPlan === 1 ? "store is" : "stores are"} on this plan.`}
        aside={plan.isActive === false ? <StatusBadge tone="neutral">Switched off</StatusBadge> : <StatusBadge tone="success">Offered</StatusBadge>}
      >
        {notice && (
          <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} onDismiss={() => setNotice(null)}>
            {notice.message}
          </Notice>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${id}-name`} label="Plan name">
            <input id={`${id}-name`} type="text" maxLength={80} value={form.name} onChange={set("name")} className={inputClass(false)} />
          </Field>
          <Field id={`${id}-sort`} label="Order on the plan page" hint="Lower numbers come first.">
            <input id={`${id}-sort`} type="number" min="0" max="1000" step="1" value={form.sortOrder} onChange={set("sortOrder")} className={inputClass(false)} />
          </Field>
          <Field id={`${id}-orig`} label="Price before discount (₹)">
            <input id={`${id}-orig`} type="number" min="0" step="1" inputMode="numeric" value={form.originalPrice} onChange={set("originalPrice")} className={inputClass(false)} />
          </Field>
          <Field
            id={`${id}-price`}
            label="Price (₹)"
            hint={`Shown as ${formatRupees(form.discountedPrice)}${discountPercent(form.discountedPrice, form.originalPrice) ? `, ${discountPercent(form.discountedPrice, form.originalPrice)}% off` : ""}.`}
          >
            <input id={`${id}-price`} type="number" min="0" step="1" inputMode="numeric" value={form.discountedPrice} onChange={set("discountedPrice")} className={inputClass(false)} />
          </Field>
          <Field id={`${id}-items`} label="Active items allowed">
            <input id={`${id}-items`} type="number" min="1" max="10000" step="1" inputMode="numeric" value={form.productMonthlyLimit} onChange={set("productMonthlyLimit")} className={inputClass(false)} />
          </Field>
          <Field id={`${id}-photos`} label="Photos per item">
            <input id={`${id}-photos`} type="number" min="1" max="20" step="1" inputMode="numeric" value={form.maxImagesPerProduct} onChange={set("maxImagesPerProduct")} className={inputClass(false)} />
          </Field>
        </div>
        <Field
          id={`${id}-extra`}
          label="Extra feature lines"
          optional
          hint="One per line, up to 8. Only list what's built. The item and photo lines are added for you from the numbers above."
        >
          <textarea id={`${id}-extra`} rows={4} value={form.extraFeatures} onChange={set("extraFeatures")} className={inputClass(false)} />
        </Field>
        <div>
          <p className="field-label">What vendors see</p>
          <ul className="space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            {preview.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /> {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 hover:bg-stone-50">
            <input type="checkbox" className="checkbox" checked={form.isActive} onChange={set("isActive")} />
            <span>
              <span className="block text-sm font-medium text-stone-900">Offer for new requests</span>
              <span className="block text-sm text-stone-500">Switching off keeps it for stores already on it.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 hover:bg-stone-50">
            <input type="checkbox" className="checkbox" checked={form.isPopular} onChange={set("isPopular")} />
            <span>
              <span className="block text-sm font-medium text-stone-900">Mark as popular</span>
              <span className="block text-sm text-stone-500">Shows a "Popular" label on the plan card.</span>
            </span>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          {dirty && (
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setForm(toForm(plan))}>
              Undo changes
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />} Save {plan.name}
          </button>
        </div>
      </FormSection>
    </form>
  );
}
