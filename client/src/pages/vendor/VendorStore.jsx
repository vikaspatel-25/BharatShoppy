import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Save } from "lucide-react";
import { Field, FormSection, Notice, PageHeader, inputClass } from "@/components/panel/ui";
import { useVendorSession } from "@/context/PanelSession";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/apiClient";
import { getTenantStoreUrl } from "@/lib/domainUtils";
import { ENTITY_TYPES } from "@/lib/entityTypes";
import { toMessage } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";
import { STORE_DETAIL_FIELDS, buildProfilePayload, profileErrorField, storeToProfileForm, validateProfileForm } from "@/lib/vendorItems";

const FIELD_ORDER = ["entityType", "storeName", "description", "phone", "whatsapp"];

export default function VendorStore() {
  const { store, storeId, setStore } = useVendorSession();
  const { toast } = useToast();
  const [form, setForm] = useState(() => storeToProfileForm(store));
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const storeUrl = getTenantStoreUrl(store);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const change = (key) => (e) => {
    set({ [key]: e.target.value });
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    const found = validateProfileForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusField(FIELD_ORDER.find((k) => found[k]));
      toast.error("Check the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProfilePayload(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = toMessage(data, "Your store profile couldn't be saved.");
        const field = res.status === 400 ? profileErrorField(msg) : null;
        if (field) {
          setErrors({ [field]: msg });
          focusField(field);
        } else {
          setNotice({ tone: "error", message: msg });
          scrollToTop();
        }
        toast.error(msg);
        return;
      }
      if (data.store) {
        setStore(data.store);
        setForm(storeToProfileForm(data.store));
      }
      setNotice({ tone: "success", message: "Your store profile is saved. Customers see the changes straight away." });
      toast.success("Store profile saved.");
      scrollToTop();
    } catch (err) {
      const msg = toMessage(err);
      setNotice({ tone: "error", message: msg });
      toast.error(msg);
      scrollToTop();
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Store link copied.");
    } catch {
      toast.error("The link couldn't be copied. Select it and copy it yourself.");
    }
  };

  const details = STORE_DETAIL_FIELDS[form.entityType] || [];

  return (
    <>
      <PageHeader title="Store profile" description="What customers see at the top of your store and on WhatsApp enquiries." />
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}

      <form onSubmit={submit} noValidate className="space-y-6">
        <FormSection id="kind" step={1} title="What you sell" description="This sets the words and the badge on your store.">
          <fieldset id="entityType" tabIndex={-1} className="outline-none">
            <legend className="sr-only">What you sell</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.values(ENTITY_TYPES).map((entity) => (
                <label
                  key={entity.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border-2 border-stone-200 p-4 hover:border-stone-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-500"
                >
                  <input
                    type="radio"
                    name="entityType"
                    value={entity.id}
                    checked={form.entityType === entity.id}
                    onChange={() => set({ entityType: entity.id })}
                    className="mt-1 accent-brand-700"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-stone-900">{entity.label}</span>
                    <span className="mt-1 block text-sm text-stone-500">{entity.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.entityType && <p className="field-error">{errors.entityType}</p>}
          </fieldset>
        </FormSection>

        <FormSection id="about" step={2} title="About your store">
          <Field id="storeName" label="Store name" error={errors.storeName} hint="The BharatShopy team is told when you change it.">
            <input
              id="storeName"
              type="text"
              value={form.storeName}
              onChange={change("storeName")}
              maxLength={120}
              aria-invalid={Boolean(errors.storeName)}
              aria-describedby={errors.storeName ? "storeName-error" : undefined}
              className={inputClass(errors.storeName)}
            />
          </Field>
          <Field id="description" label="Description" optional error={errors.description}>
            <textarea id="description" rows={4} value={form.description} onChange={change("description")} maxLength={1000} className={inputClass(errors.description)} />
          </Field>
          {details.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              {details.map((f) => (
                <Field key={f.key} id={`meta-${f.key}`} label={f.label} optional>
                  <input
                    id={`meta-${f.key}`}
                    type="text"
                    value={form.metadata?.[f.key] || ""}
                    onChange={(e) => set({ metadata: { ...form.metadata, [f.key]: e.target.value } })}
                    placeholder={f.placeholder}
                    className={inputClass(false)}
                  />
                </Field>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection id="contact" step={3} title="Contact" description="Customers' enquiries go to your WhatsApp number.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="whatsapp" label="WhatsApp number" error={errors.whatsapp} hint="With country code, for example +919876543210.">
              <input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.whatsapp}
                onChange={change("whatsapp")}
                aria-invalid={Boolean(errors.whatsapp)}
                aria-describedby={errors.whatsapp ? "whatsapp-error" : undefined}
                className={inputClass(errors.whatsapp)}
              />
            </Field>
            <Field id="phone" label="Phone number" optional error={errors.phone}>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={change("phone")}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? "phone-error" : undefined}
                className={inputClass(errors.phone)}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection id="location" step={4} title="Location">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="area" label="Area or locality" optional>
              <input id="area" type="text" value={form.area} onChange={change("area")} className={inputClass(false)} />
            </Field>
            <Field id="city" label="City" optional>
              <input id="city" type="text" value={form.city} onChange={change("city")} autoComplete="address-level2" className={inputClass(false)} />
            </Field>
            <Field id="state" label="State" optional>
              <input id="state" type="text" value={form.state} onChange={change("state")} autoComplete="address-level1" className={inputClass(false)} />
            </Field>
          </div>
        </FormSection>

        <FormSection id="address" step={5} title="Store web address" description="Set when your store was approved. Contact the BharatShopy team to change it.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 font-mono text-sm break-all text-stone-700">{storeUrl}</p>
            <button type="button" onClick={copy} className="btn btn-secondary">
              <Copy size={15} aria-hidden="true" /> Copy
            </button>
          </div>
        </FormSection>

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <button type="submit" disabled={saving} className="btn btn-primary flex-1 sm:flex-none">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </>
  );
}

function focusField(id) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
