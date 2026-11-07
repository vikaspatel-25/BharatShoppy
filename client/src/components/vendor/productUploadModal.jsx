import { useState, useEffect, useRef } from "react";
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Check,
  Package,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompressor";
import { getEntityConfig } from "@/lib/entityTypes";
import { apiFetch } from "@/lib/apiClient";

const UNIT_PRESETS = {
  shopkeeper: ["piece", "set", "pair", "meter", "pack"],
  farmer: ["kg", "gram", "quintal", "liter", "crate", "box", "dozen"],
  service_provider: ["hour", "service", "visit", "consultation", "day", "job"],
};

const CATEGORY_PRESETS = [
  "Apparel & Fashion",
  "Groceries & Organics",
  "Electronics",
  "Furniture & Home Decor",
  "Home & Garden",
  "Sports & Outdoors",
  "Jewelry & Watches",
  "Health & Wellness",
  "Services & Repairs",
  "Handicrafts & Art",
  "Books & Stationery",
];

export default function ProductUploadModal({
  isOpen,
  onClose,
  onSave,
  entityType = "shopkeeper",
  initialData = null,
  isSaving = false,
  quotaInfo = null,
  storeId = null,
  maxImages = 5,
}) {
  const entityConfig = getEntityConfig(entityType);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const maxAllowedImages = maxImages || quotaInfo?.maxImagesPerProduct || 5;

  const [form, setForm] = useState({
    productName: "",
    brand: "",
    category: "Apparel & Fashion",
    subCategory: "",
    price: "",
    mrp: "",
    unit: entityConfig.defaultUnit || "piece",
    shortDescription: "",
    description: "",
    images: [],
    imageAssets: [],
    inStock: true,
    isActive: true,
    tags: [],
    // Entity-specific attributes
    attributes: {},
  });

  const [currentTagInput, setCurrentTagInput] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Populate form if editing existing product, or initialize defaults
  useEffect(() => {
    if (initialData) {
      const priceVal = initialData.price?.min ?? initialData.price ?? "";
      const mrpVal = initialData.price?.max ?? initialData.mrp ?? "";
      const unitVal =
        initialData.price?.unit ?? initialData.unit ?? entityConfig.defaultUnit ?? "piece";

      setForm({
        productName: initialData.productName || "",
        brand: initialData.brand || "",
        category: initialData.category || "Apparel & Fashion",
        subCategory: initialData.subCategory || "",
        price: priceVal,
        mrp: mrpVal,
        unit: unitVal,
        shortDescription: initialData.shortDescription || "",
        description: initialData.description || "",
        images: initialData.images || [],
        imageAssets: initialData.imageAssets || [],
        inStock: initialData.inStock !== false,
        isActive: initialData.isActive !== false,
        tags: Array.isArray(initialData.tags) ? initialData.tags : [],
        attributes: initialData.attributes || {},
      });
    } else {
      // Default initial state
      setForm({
        productName: "",
        brand: "",
        category:
          entityType === "farmer"
            ? "Groceries & Organics"
            : entityType === "service_provider"
            ? "Services & Repairs"
            : "Apparel & Fashion",
        subCategory: "",
        price: "",
        mrp: "",
        unit: entityConfig.defaultUnit || "piece",
        shortDescription: "",
        description: "",
        images: [],
        imageAssets: [],
        inStock: true,
        isActive: true,
        tags: [],
        attributes: {},
      });
    }
    setValidationError("");
  }, [initialData, entityType, entityConfig.defaultUnit, isOpen]);

  if (!isOpen) return null;

  // Handle mobile camera and file uploads to Cloudinary
  const handleFileProcess = async (files) => {
    if (!files || files.length === 0) return;

    if (!storeId) {
      setValidationError("Store context is missing. Please refresh and try again.");
      return;
    }

    try {
      setCompressing(true);
      setValidationError("");

      const fileList = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (fileList.length === 0) return;

      const remainingSlots = maxAllowedImages - form.images.length;
      if (remainingSlots <= 0) {
        setValidationError(`You can upload a maximum of ${maxAllowedImages} photos per product.`);
        return;
      }

      const filesToProcess = fileList.slice(0, remainingSlots);

      // Request signed upload credentials from server
      const signRes = await apiFetch(`/api/vendor/store/${storeId}/media/sign`, {
        method: "POST",
      });
      if (!signRes.ok) {
        const errorData = await signRes.json().catch(() => ({}));
        throw new Error(
          errorData.message || "Failed to get upload authorization. Image service may be unavailable."
        );
      }
      const signData = await signRes.json();

      const newUrls = [];
      const newAssets = [];

      for (const file of filesToProcess) {
        const compressedDataUrl = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.82,
        });
        if (!compressedDataUrl) continue;

        const formData = new FormData();
        formData.append("file", compressedDataUrl);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", signData.timestamp);
        formData.append("signature", signData.signature);
        formData.append("folder", signData.folder);
        if (signData.allowed_formats) {
          formData.append("allowed_formats", signData.allowed_formats);
        }

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          const errBody = await uploadRes.json().catch(() => ({}));
          throw new Error(errBody.error?.message || "Failed to upload photo to Cloudinary");
        }

        const uploadData = await uploadRes.json();
        newUrls.push(uploadData.secure_url);
        newAssets.push({
          url: uploadData.secure_url,
          publicId: uploadData.public_id,
        });
      }

      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...newUrls].slice(0, maxAllowedImages),
        imageAssets: [...(prev.imageAssets || []), ...newAssets].slice(0, maxAllowedImages),
      }));
    } catch (err) {
      console.error("Image processing error:", err);
      setValidationError(err.message || "Failed to process image. Please try again.");
    } finally {
      setCompressing(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setForm((prev) => {
      const removedUrl = prev.images[indexToRemove];
      return {
        ...prev,
        images: prev.images.filter((_, idx) => idx !== indexToRemove),
        imageAssets: (prev.imageAssets || []).filter((a) => a.url !== removedUrl),
      };
    });
  };

  const handleSetCoverImage = (indexToCover) => {
    setForm((prev) => {
      const selectedUrl = prev.images[indexToCover];
      const restUrls = prev.images.filter((_, idx) => idx !== indexToCover);
      const selectedAsset = (prev.imageAssets || []).find((a) => a.url === selectedUrl);
      const restAssets = (prev.imageAssets || []).filter((a) => a.url !== selectedUrl);

      return {
        ...prev,
        images: [selectedUrl, ...restUrls],
        imageAssets: selectedAsset ? [selectedAsset, ...restAssets] : prev.imageAssets,
      };
    });
  };

  const handleAddTag = () => {
    const trimmed = currentTagInput.trim().replace(/^#/, "");
    if (trimmed && !form.tags.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        tags: [...prev.tags, trimmed],
      }));
      setCurrentTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleAttributeChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [key]: value,
      },
    }));
  };

  // Guard checks for subscription state & upload limits
  const isBlockedByInactiveSubscription =
    !initialData && quotaInfo && quotaInfo.isSubscriptionActive === false;
  const isBlockedByQuota =
    !initialData && quotaInfo && quotaInfo.remaining <= 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBlockedByInactiveSubscription) {
      setValidationError("Cannot add items while subscription is inactive or expired.");
      return;
    }
    if (isBlockedByQuota) {
      setValidationError(
        `Upload quota reached (${quotaInfo?.currentCount}/${quotaInfo?.limit}). Please upgrade your plan to list more items.`
      );
      return;
    }
    if (!form.productName.trim()) {
      setValidationError("Please enter an item name.");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setValidationError("Please enter a valid price greater than 0.");
      return;
    }

    const payload = {
      productName: form.productName.trim(),
      brand: form.brand.trim() || undefined,
      category: form.category,
      subCategory: form.subCategory.trim() || undefined,
      price: {
        min: Number(form.price),
        max: form.mrp ? Number(form.mrp) : Number(form.price),
        currency: "INR",
        unit: form.unit || "piece",
      },
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim() || form.shortDescription.trim(),
      images: form.images.length > 0 ? form.images : [],
      imageAssets: form.imageAssets || [],
      attributes: form.attributes,
      tags: form.tags,
      inStock: form.inStock,
      isActive: form.isActive,
    };

    onSave(payload);
  };

  // Discount calculation
  const sellingPrice = Number(form.price) || 0;
  const mrpPrice = Number(form.mrp) || 0;
  const discountPercent =
    mrpPrice > sellingPrice && sellingPrice > 0
      ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
      : 0;

  const unitOptions = UNIT_PRESETS[entityType] || UNIT_PRESETS.shopkeeper;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Mobile Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-700 shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                {initialData ? "Edit Catalog Item" : "Upload New Item / Service"}
              </h2>
              <span
                className={`inline-block px-2 py-0.5 mt-0.5 text-[10px] font-semibold rounded-full border ${entityConfig.badgeClass}`}
              >
                {entityConfig.badgeLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 scrollbar-none"
        >
          {validationError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Subscription Inactive Banner */}
          {isBlockedByInactiveSubscription && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Subscription Inactive or Expired</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Your store subscription is currently under renewal. Please activate or renew your subscription in the Subscription tab to list new items.
                </p>
              </div>
            </div>
          )}

          {/* Quota Limit Reached Banner */}
          {isBlockedByQuota && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Upload Quota Limit Reached ({quotaInfo.currentCount}/{quotaInfo.limit})
                </p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  You have reached the maximum catalog item limit for your current subscription plan. Upgrade your plan in the Subscription tab to list more items.
                </p>
              </div>
            </div>
          )}

          {/* Quota Capacity Info (when quota available) */}
          {!initialData && quotaInfo && !isBlockedByQuota && !isBlockedByInactiveSubscription && (
            <div className="px-3.5 py-2.5 rounded-xl bg-orange-50/60 border border-orange-200/80 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span className="font-medium text-stone-700">Catalog Capacity</span>
              </div>
              <span className="text-[11px] font-semibold text-orange-800">
                {quotaInfo.remaining} slots remaining ({quotaInfo.currentCount}/{quotaInfo.limit} used)
              </span>
            </div>
          )}

          {/* 1. MEDIA & PHOTO CAPTURE PANEL (Mobile Camera & Gallery) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-stone-900">
                  Product / Service Photos
                </label>
                <p className="text-[11px] text-stone-500">
                  Take a photo with your phone camera or select up to {maxAllowedImages} pictures.
                </p>
              </div>
              <span className="text-xs text-stone-400 font-medium">
                {form.images.length}/{maxAllowedImages}
              </span>
            </div>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileProcess(e.target.files)}
              className="hidden"
            />
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              multiple
              onChange={(e) => handleFileProcess(e.target.files)}
              className="hidden"
            />

            {/* Big Touch-Friendly Photo Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={compressing || form.images.length >= maxAllowedImages}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/50 text-orange-700 font-semibold text-xs hover:bg-orange-100/70 active:scale-98 transition disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-orange-600" />
                <span>Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={compressing || form.images.length >= maxAllowedImages}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-700 font-semibold text-xs hover:bg-stone-100 active:scale-98 transition disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4 text-stone-600" />
                <span>Choose Photos</span>
              </button>
            </div>

            {compressing && (
              <p className="text-xs text-orange-600 font-medium flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                Compressing and uploading images to cloud...
              </p>
            )}

            {/* Uploaded Thumbnails Grid */}
            {form.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 pt-1">
                {form.images.map((imgSrc, idx) => (
                  <div
                    key={idx}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shadow-xs"
                  >
                    <img
                      src={imgSrc}
                      alt={`Upload preview ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-stone-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-bold backdrop-blur-xs">
                        Cover
                      </span>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center gap-1.5 transition">
                      {idx !== 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetCoverImage(idx)}
                          className="p-1 bg-white rounded-md text-stone-800 text-[10px] font-bold"
                          title="Set as cover photo"
                        >
                          Cover
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1 bg-red-600 rounded-md text-white"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. ITEM BASIC INFORMATION */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">
                {entityType === "service_provider"
                  ? "Service Title *"
                  : entityType === "farmer"
                  ? "Produce / Crop Name *"
                  : "Product Name *"}
              </label>
              <input
                type="text"
                required
                placeholder={
                  entityType === "farmer"
                    ? "e.g., A2 Gir Cow Desi Ghee (Bilona Method)"
                    : entityType === "service_provider"
                    ? "e.g., Custom Bridal Blouse Hand-Embroidery"
                    : "e.g., Hand-Block Printed Cotton Kurti"
                }
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">
                  Brand / Farm / Artisan Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Master Studio / Organic Valley"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">
                  Category *
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs bg-white text-stone-900"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 3. PRICING & UNIT SELECTOR (TOUCH-FRIENDLY PILLS) */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">
                Pricing & Currency (INR ₹)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-stone-500 mb-1 block">
                    Selling Price (₹) *
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      placeholder="999"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-bold text-stone-900 focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-stone-500 mb-1 block">
                    Original MRP (₹) <span className="text-stone-400">(Optional)</span>
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-stone-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="1299"
                      value={form.mrp}
                      onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900"
                    />
                  </div>
                </div>
              </div>

              {discountPercent > 0 && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1.5">
                  ✓ Shows discount badge: {discountPercent}% OFF (Saves ₹
                  {mrpPrice - sellingPrice})
                </p>
              )}
            </div>

            {/* Unit Selector Pills */}
            <div>
              <span className="block text-xs font-bold text-stone-900 mb-1.5">
                Pricing Unit
              </span>
              <div className="flex flex-wrap gap-2">
                {unitOptions.map((u) => {
                  const isSelected = form.unit === u;
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setForm({ ...form, unit: u })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                        isSelected
                          ? "bg-stone-900 text-white shadow-xs"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      per {u}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. ENTITY-SPECIFIC ATTRIBUTES PANEL */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
              <span>{entityConfig.label} Custom Specifications</span>
            </h3>

            {entityType === "farmer" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Harvest Season / Date
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. October 2026 Fresh Harvest"
                    value={form.attributes.harvestSeason || ""}
                    onChange={(e) => handleAttributeChange("harvestSeason", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Organic / Farming Method
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 100% Pesticide-Free, Jaivik Bharat"
                    value={form.attributes.organicMethod || ""}
                    onChange={(e) => handleAttributeChange("organicMethod", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Shelf Life & Storage
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Best before 6 months in cool dry place"
                    value={form.attributes.shelfLife || ""}
                    onChange={(e) => handleAttributeChange("shelfLife", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Minimum Bulk Order
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5 kg bag minimum for wholesale rate"
                    value={form.attributes.minimumBulk || ""}
                    onChange={(e) => handleAttributeChange("minimumBulk", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>
            )}

            {entityType === "service_provider" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Estimated Service Duration
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2–3 hours on-site / 48 hrs"
                    value={form.attributes.duration || ""}
                    onChange={(e) => handleAttributeChange("duration", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Service Area / Radius
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Doorstep within 15 km"
                    value={form.attributes.serviceArea || ""}
                    onChange={(e) => handleAttributeChange("serviceArea", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Deliverables & Inclusions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fabric included, 1 trial fitting, lining attached"
                    value={form.attributes.inclusions || ""}
                    onChange={(e) => handleAttributeChange("inclusions", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>
            )}

            {entityType === "shopkeeper" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Fabric / Material
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pure Chanderi Silk Cotton"
                    value={form.attributes.fabric || ""}
                    onChange={(e) => handleAttributeChange("fabric", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Sizes Available
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S, M, L, XL, XXL"
                    value={form.attributes.sizes || ""}
                    onChange={(e) => handleAttributeChange("sizes", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-stone-600 mb-1">
                    Care Instructions
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gentle Hand Wash / Dry Clean recommended"
                    value={form.attributes.care || ""}
                    onChange={(e) => handleAttributeChange("care", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. DESCRIPTION & SUMMARY */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">
                Short Summary (Card Preview)
              </label>
              <input
                type="text"
                placeholder="1–2 sentence highlight for catalog cards"
                value={form.shortDescription}
                onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">
                Detailed Description
              </label>
              <textarea
                rows={3}
                placeholder="Elaborate on features, artisanal techniques, specifications..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>
          </div>

          {/* 6. SEARCH TAGS & INVENTORY STATUS */}
          <div className="space-y-4 pt-2 border-t border-stone-100">
            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">
                Discovery Tags (Marketplace Search)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="e.g. kurti, festive, organic (Press Add)"
                  value={currentTagInput}
                  onChange={(e) => setCurrentTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-semibold hover:bg-stone-200"
                >
                  Add
                </button>
              </div>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-orange-50 text-orange-800 border border-orange-200 text-xs"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-orange-500 hover:text-orange-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory & Status Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition">
                <input
                  type="checkbox"
                  checked={form.inStock}
                  onChange={(e) => setForm({ ...form, inStock: e.target.checked })}
                  className="w-4 h-4 accent-orange-600 rounded"
                />
                <div>
                  <span className="block text-xs font-bold text-stone-800">
                    In Stock
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Customers can order / enquire
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50 transition">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 accent-orange-600 rounded"
                />
                <div>
                  <span className="block text-xs font-bold text-stone-800">
                    Live Published
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Visible on storefront & search
                  </span>
                </div>
              </label>
            </div>
          </div>
        </form>

        {/* Sticky Mobile Bottom Action Bar */}
        <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/90 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-100 transition active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              isSaving ||
              compressing ||
              isBlockedByInactiveSubscription ||
              isBlockedByQuota
            }
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-sm flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>
              {isSaving
                ? "Saving Item..."
                : isBlockedByInactiveSubscription
                ? "Renewal Required"
                : isBlockedByQuota
                ? "Quota Limit Reached"
                : initialData
                ? "Update Catalog Item"
                : "Publish to Catalog"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
