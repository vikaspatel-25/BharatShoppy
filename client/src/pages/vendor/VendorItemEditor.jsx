import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Image as ImageIcon, Loader2, Package, Save, Star, Trash2, X } from "lucide-react";
import { EmptyState, Field, FormSection, LoadingState, Notice, PageHeader, inputClass } from "@/components/panel/ui";
import { PlanBanner } from "@/components/vendor/vendorParts";
import { useVendorSession } from "@/context/PanelSession";
import { useToast } from "@/context/ToastContext";
import { useVendorPlan } from "@/hooks/useVendorPlan";
import { apiFetch } from "@/lib/apiClient";
import { toMessage } from "@/lib/formatDate";
import { uploadProductPhotos } from "@/lib/mediaUpload";
import { scrollToTop } from "@/lib/scrollPanel";
import {
  CATEGORY_PRESETS,
  ITEM_DETAIL_FIELDS,
  UNIT_PRESETS,
  buildProductPayload,
  countActiveItems,
  discountPercent,
  getItemState,
  getUploadAllowance,
  itemWords,
  normaliseEntityType,
  productErrorField,
  productToForm,
  removePhoto,
  setCoverPhoto,
  validateProductForm,
} from "@/lib/vendorItems";

const FIELD_ORDER = ["images", "productName", "price", "mrp"];

export default function VendorItemEditor() {
  const { productId } = useParams();
  const { store, storeId, products, reload } = useVendorSession();
  const { info } = useVendorPlan(storeId);
  const editing = Boolean(productId);
  const original = editing ? products.find((p) => String(p._id) === String(productId)) : null;
  const [lookedAgain, setLookedAgain] = useState(false);

  // An item opened from a link may be newer than the list loaded at sign-in: reload once before saying it's missing.
  useEffect(() => {
    if (editing && !original && !lookedAgain) {
      reload()
        .catch(() => {})
        .finally(() => setLookedAgain(true));
    }
  }, [editing, original, lookedAgain, reload]);

  if (editing && !original) {
    if (!lookedAgain) return <LoadingState label="Loading this item…" />;
    return (
      <EmptyState
        icon={Package}
        title="This item wasn't found"
        description="It may belong to another store, or the link may be wrong."
        action={
          <Link to="/vendor/items" className="btn btn-secondary">
            Back to items
          </Link>
        }
      />
    );
  }

  return <ItemForm key={productId || "new"} store={store} storeId={storeId} products={products} original={original} sub={info?.subscription} reload={reload} />;
}

function ItemForm({ store, storeId, products, original, sub, reload }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const entityType = normaliseEntityType(store?.entityType);
  const words = itemWords(entityType);
  const editing = Boolean(original);
  const hiddenByAdmin = editing && getItemState(original) === "hidden";

  const [form, setForm] = useState(() => productToForm(original, entityType));
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [upload, setUpload] = useState(null); // { index, total, percent }
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const maxImages = Number(store?.limits?.maxImagesPerProduct) || 5;
  const allowance = getUploadAllowance(store, countActiveItems(products));
  // A new item needs room on a current plan. Checked before any photo upload starts,
  // so a refused save never leaves unused photos in Cloudinary.
  const blocked = !editing && !allowance.allowed;
  const reactivating = editing && original.isActive === false && form.isActive;
  const uploading = upload !== null;
  const slotsLeft = maxImages - form.images.length;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const showError = (message, field) => {
    const msg = toMessage(message);
    if (field) {
      setErrors((e) => ({ ...e, [field]: msg }));
      focusField(field);
    } else {
      setNotice({ tone: "error", message: msg });
      scrollToTop();
    }
    toast.error(msg);
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    if (blocked) {
      showError(allowance.message);
      return;
    }
    if (slotsLeft <= 0) {
      showError(`Your plan allows ${maxImages} photos per ${words.one}. Remove one to add another.`, "images");
      return;
    }
    const chosen = files.slice(0, slotsLeft);
    if (files.length > chosen.length) {
      toast.warning(`Only ${chosen.length} of ${files.length} photos were added. Your plan allows ${maxImages} per ${words.one}.`);
    }
    clearError("images");
    setNotice(null);
    setUpload({ index: 0, total: chosen.length, percent: 0 });
    try {
      const assets = await uploadProductPhotos(chosen, { storeId, onProgress: setUpload });
      setForm((f) => ({
        ...f,
        images: [...f.images, ...assets.map((a) => a.url)].slice(0, maxImages),
        imageAssets: [...(f.imageAssets || []), ...assets].slice(0, maxImages),
      }));
    } catch (err) {
      showError(err, "images");
    } finally {
      setUpload(null);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, "");
    if (tag && !form.tags.includes(tag)) set({ tags: [...form.tags, tag] });
    setTagInput("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    if (blocked) {
      showError(allowance.message);
      return;
    }
    if (uploading) return;
    const found = validateProductForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = FIELD_ORDER.find((k) => found[k]);
      focusField(first);
      toast.error("Check the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const url = editing
        ? `/api/vendor/store/${encodeURIComponent(storeId)}/products/${encodeURIComponent(original._id)}`
        : `/api/vendor/store/${encodeURIComponent(storeId)}/products`;
      const res = await apiFetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildProductPayload(form)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = toMessage(data, `The ${words.one} couldn't be saved.`);
        showError(msg, res.status === 400 ? productErrorField(msg) : null);
        return;
      }
      const name = data.product?.productName || form.productName.trim();
      const message = editing ? `Saved your changes to “${name}”.` : `“${name}” is added${form.isActive ? " and visible to customers" : ""}.`;
      toast.success(message);
      await reload().catch(() => {});
      navigate("/vendor/items", { state: { notice: { tone: "success", message } } });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  };

  const discount = discountPercent(form.price, form.mrp);
  const units = UNIT_PRESETS[entityType];
  const detailFields = ITEM_DETAIL_FIELDS[entityType];

  return (
    <>
      <Link to="/vendor/items" className="link mb-4 inline-flex items-center gap-1.5 text-sm">
        <ArrowLeft size={15} aria-hidden="true" /> Back to {words.many}
      </Link>
      <PlanBanner store={store} sub={sub} />
      <PageHeader
        title={editing ? `Edit ${words.one}` : `Add ${words.one === "service" ? "a service" : "an item"}`}
        description={
          editing ? (
            <span className="line-clamp-2" title={original.productName}>
              {original.productName}
            </span>
          ) : (
            `It goes live on your store as soon as you save, while your plan is active.`
          )
        }
      />

      {notice && (
        <Notice tone={notice.tone} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {blocked && (
        <Notice tone="error" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{allowance.message}</span>
            {allowance.reason !== "removal_hold" && (
              <Link to={allowance.reason === "quota_full" ? "/vendor/items" : "/vendor/plan"} className="btn btn-secondary btn-sm">
                {allowance.reason === "quota_full" ? "Manage items" : "See plans"}
              </Link>
            )}
          </div>
        </Notice>
      )}
      {hiddenByAdmin && (
        <Notice tone="error" className="mb-6">
          The BharatShopy team hid this {words.one}
          {original.moderation?.reason ? `: ${original.moderation.reason}` : "."} Your changes are saved, but only the team can show it again.
        </Notice>
      )}

      <form onSubmit={submit} noValidate className="space-y-6">
        <FormSection id="photos" step={1} title="Photos" description={`Up to ${maxImages} photos. The first one is the cover customers see.`} aside={<span className="text-sm text-stone-500">{form.images.length} of {maxImages}</span>}>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} tabIndex={-1} aria-hidden="true" />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} tabIndex={-1} aria-hidden="true" />
          <div id="images" tabIndex={-1} className="grid grid-cols-2 gap-3 outline-none">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={blocked || uploading || slotsLeft <= 0} className="btn btn-secondary btn-lg">
              <Camera size={18} aria-hidden="true" /> Take photo
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} disabled={blocked || uploading || slotsLeft <= 0} className="btn btn-secondary btn-lg">
              <ImageIcon size={18} aria-hidden="true" /> Choose photos
            </button>
          </div>
          {uploading && (
            <div role="status" className="text-sm text-stone-600">
              <p className="flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                Uploading photo {Math.min(upload.index + 1, upload.total)} of {upload.total}… {upload.percent}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${Math.round(((upload.index + upload.percent / 100) / upload.total) * 100)}%` }} />
              </div>
            </div>
          )}
          {errors.images && <p className="field-error">{errors.images}</p>}
          {form.images.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {form.images.map((src, idx) => (
                <li key={src} className="overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                  <div className="relative aspect-square">
                    <img src={src} alt={`Photo ${idx + 1}`} className="size-full object-cover" />
                    {idx === 0 && <span className="absolute top-1.5 left-1.5 rounded bg-stone-900/80 px-1.5 py-0.5 text-xs font-semibold text-white">Cover</span>}
                  </div>
                  {/* Always visible, so they work on a touchscreen */}
                  <div className="flex border-t border-stone-200">
                    {idx !== 0 && (
                      <button type="button" onClick={() => setForm((f) => setCoverPhoto(f, idx))} className="btn btn-ghost btn-sm flex-1 rounded-none" aria-label={`Set image ${idx + 1} as cover photo`}>
                        <Star size={14} aria-hidden="true" /> Cover
                      </button>
                    )}
                    <button type="button" onClick={() => setForm((f) => removePhoto(f, idx))} className="btn btn-ghost btn-sm flex-1 rounded-none text-red-700" aria-label={`Remove image ${idx + 1}`}>
                      <Trash2 size={14} aria-hidden="true" /> Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FormSection>

        <FormSection id="basics" step={2} title="Basic details">
          <Field id="productName" label={words.nameLabel} error={errors.productName}>
            <input
              id="productName"
              type="text"
              value={form.productName}
              onChange={(e) => {
                set({ productName: e.target.value });
                clearError("productName");
              }}
              placeholder={words.namePlaceholder}
              maxLength={200}
              aria-invalid={Boolean(errors.productName)}
              aria-describedby={errors.productName ? "productName-error" : undefined}
              className={inputClass(errors.productName)}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="brand" label="Brand, farm or maker" optional>
              <input id="brand" type="text" value={form.brand} onChange={(e) => set({ brand: e.target.value })} className={inputClass(false)} />
            </Field>
            <Field id="category" label="Category">
              <select id="category" value={form.category} onChange={(e) => set({ category: e.target.value })} className={inputClass(false)}>
                {[...new Set([form.category, ...CATEGORY_PRESETS])].filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="subCategory" label="Sub-category" optional>
            <input id="subCategory" type="text" value={form.subCategory} onChange={(e) => set({ subCategory: e.target.value })} className={inputClass(false)} />
          </Field>
        </FormSection>

        <FormSection id="pricing" step={3} title="Price">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="price" label="Selling price (₹)" error={errors.price}>
              <input
                id="price"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => {
                  set({ price: e.target.value });
                  clearError("price");
                }}
                aria-invalid={Boolean(errors.price)}
                aria-describedby={errors.price ? "price-error" : undefined}
                className={inputClass(errors.price)}
              />
            </Field>
            <Field id="mrp" label="MRP (₹)" optional error={errors.mrp} hint={discount > 0 ? `Customers see ${discount}% off.` : "Fill this in to show a discount."}>
              <input
                id="mrp"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.mrp}
                onChange={(e) => {
                  set({ mrp: e.target.value });
                  clearError("mrp");
                }}
                aria-invalid={Boolean(errors.mrp)}
                aria-describedby={errors.mrp ? "mrp-error" : undefined}
                className={inputClass(errors.mrp)}
              />
            </Field>
          </div>
          <fieldset>
            <legend className="field-label">Price is per</legend>
            <div className="flex flex-wrap gap-2">
              {[...new Set([...units, form.unit])].filter(Boolean).map((u) => (
                <label
                  key={u}
                  className="cursor-pointer rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium capitalize text-stone-700 has-[:checked]:border-stone-900 has-[:checked]:bg-stone-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ocean-500"
                >
                  <input type="radio" name="unit" value={u} checked={form.unit === u} onChange={() => set({ unit: u })} className="sr-only" />
                  {u}
                </label>
              ))}
            </div>
          </fieldset>
        </FormSection>

        <FormSection id="details" step={4} title="Details" description="Optional. Fill in what helps customers decide.">
          <div className="grid gap-5 sm:grid-cols-2">
            {detailFields.map((f) => (
              <Field key={f.key} id={`attr-${f.key}`} label={f.label} optional className={f.wide ? "sm:col-span-2" : ""}>
                <input
                  id={`attr-${f.key}`}
                  type="text"
                  value={form.attributes[f.key] || ""}
                  onChange={(e) => set({ attributes: { ...form.attributes, [f.key]: e.target.value } })}
                  placeholder={f.placeholder}
                  className={inputClass(false)}
                />
              </Field>
            ))}
          </div>
        </FormSection>

        <FormSection id="description" step={5} title="Description">
          <Field id="shortDescription" label="Short summary" optional hint="One or two sentences shown on the item card.">
            <input id="shortDescription" type="text" value={form.shortDescription} onChange={(e) => set({ shortDescription: e.target.value })} maxLength={300} className={inputClass(false)} />
          </Field>
          <Field id="longDescription" label="Full description" optional>
            <textarea id="longDescription" rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} className={inputClass(false)} />
          </Field>
        </FormSection>

        <FormSection id="visibility" step={6} title="Search words and visibility">
          <Field id="tag-input" label="Search words" optional hint="Words customers might search for. Press Enter or Add after each one.">
            <div className="flex gap-2">
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="For example, kurti, festive, organic"
                className={inputClass(false, "flex-1")}
              />
              <button type="button" onClick={addTag} className="btn btn-secondary">
                Add
              </button>
            </div>
          </Field>
          {form.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Search words added">
              {form.tags.map((t) => (
                <li key={t} className="badge badge-brand gap-1">
                  {t}
                  <button type="button" onClick={() => set({ tags: form.tags.filter((x) => x !== t) })} aria-label={`Remove search word ${t}`} className="-mr-1 rounded p-0.5 hover:bg-brand-100">
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-4 hover:bg-stone-50">
              <input type="checkbox" checked={form.inStock} onChange={(e) => set({ inStock: e.target.checked })} className="checkbox" />
              <span>
                <span className="block text-sm font-medium text-stone-900">In stock</span>
                <span className="block text-sm text-stone-500">Customers can enquire about it now.</span>
              </span>
            </label>
            <label className={`flex items-start gap-3 rounded-lg border border-stone-200 p-4 ${hiddenByAdmin ? "opacity-60" : "cursor-pointer hover:bg-stone-50"}`}>
              <input type="checkbox" checked={form.isActive} disabled={hiddenByAdmin} onChange={(e) => set({ isActive: e.target.checked })} className="checkbox" />
              <span>
                <span className="block text-sm font-medium text-stone-900">Show to customers</span>
                <span className="block text-sm text-stone-500">
                  {hiddenByAdmin ? "Hidden by BharatShopy." : "Switched-off items stay saved and don't count toward your plan."}
                </span>
              </span>
            </label>
          </div>
          {reactivating && !allowance.allowed && (
            <Notice tone="warn">{allowance.message} Save with “Show to customers” unticked, or make room first.</Notice>
          )}
        </FormSection>

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Link to="/vendor/items" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving || uploading || blocked} className="btn btn-primary flex-1 sm:flex-none">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            {saving ? "Saving…" : uploading ? "Waiting for photos…" : editing ? "Save changes" : `Add ${words.one}`}
          </button>
        </div>
      </form>
    </>
  );
}

/** Scrolls a field into view inside the panel's <main> and focuses it. */
function focusField(id) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
}
