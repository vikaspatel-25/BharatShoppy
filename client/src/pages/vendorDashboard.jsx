import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Store,
  Plus,
  Save,
  QrCode,
  Check,
  AlertCircle,
  Package,
  ArrowLeft,
  Eye,
  RefreshCw,
  Edit2,
  CreditCard,
} from "lucide-react";
import StoreQrModal from "@/components/store/storeQrModal";
import ProductUploadModal from "@/components/vendor/productUploadModal";
import SubscriptionManager from "@/components/vendor/subscriptionManager";
import { ENTITY_TYPES, getEntityConfig } from "@/lib/entityTypes";
import { getProductFallbackImage, handleImgError } from "@/lib/imageFallback";
import { apiFetch } from "@/lib/apiClient";

export default function VendorDashboard({
  defaultTab = "catalog",
}) {
  const [storeId, setStoreId] = useState(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab); // "catalog" | "profile" | "subscription"
  const [showQrModal, setShowQrModal] = useState(false);

  // Product Upload / Edit Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    storeName: "",
    description: "",
    entityType: "shopkeeper",
    phone: "",
    whatsapp: "",
    area: "",
    city: "",
    state: "",
    metadata: {},
  });

  // Resolve vendor store from session if not specified in URL route params
  useEffect(() => {
    if (!storeId) {
      apiFetch("/api/vendor/auth/me")
        .then((res) => {
          if (!res.ok) throw new Error("Unauthenticated vendor");
          return res.json();
        })
        .then((data) => {
          if (data.vendor?.storeId) {
            setStoreId(data.vendor.storeId);
          } else {
            setFeedback({
              type: "error",
              message: "No store linked to this vendor account.",
            });
            setLoading(false);
          }
        })
        .catch(() => {
          window.location.href = "/vendor/login";
        });
    }
  }, [storeId]);

  useEffect(() => {
    async function fetchVendorData() {
      try {
        setLoading(true);
        setFeedback(null);
        const res = await apiFetch(`/api/vendor/store/${storeId}`);
        if (!res.ok) {
          throw new Error("Failed to load vendor data");
        }
        const data = await res.json();
        setStore(data.store);
        setProducts(data.products || []);

        setProfileForm({
          storeName: data.store.storeName || "",
          description: data.store.description || "",
          entityType: data.store.entityType || "shopkeeper",
          phone: data.store.contact?.phone || "",
          whatsapp: data.store.contact?.whatsapp || "",
          area: data.store.address?.area || "",
          city: data.store.city || "",
          state: data.store.state || "",
          metadata: data.store.metadata || {},
        });
      } catch (err) {
        console.error("Vendor load failed:", err);
        setFeedback({ type: "error", message: err.message });
      } finally {
        setLoading(false);
      }
    }

    if (storeId) {
      fetchVendorData();
    }
  }, [storeId]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        storeName: profileForm.storeName,
        description: profileForm.description,
        entityType: profileForm.entityType,
        contact: {
          phone: profileForm.phone,
          whatsapp: profileForm.whatsapp,
        },
        address: {
          area: profileForm.area,
          city: profileForm.city,
          state: profileForm.state,
        },
        metadata: profileForm.metadata,
      };

      const res = await apiFetch(`/api/vendor/store/${storeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update profile");
      const data = await res.json();
      setStore(data.store);
      setFeedback({ type: "success", message: "Profile & entity settings updated successfully!" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async (productData) => {
    try {
      setSaving(true);
      if (editingProduct) {
        const res = await apiFetch(
          `/api/vendor/store/${storeId}/products/${editingProduct._id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(productData),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to update item");
        }
        const data = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p._id === editingProduct._id ? data.product : p))
        );
        setFeedback({
          type: "success",
          message: `"${data.product.productName}" updated successfully!`,
        });
      } else {
        const res = await apiFetch(`/api/vendor/store/${storeId}/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Failed to add catalog item");
        }
        const data = await res.json();
        setProducts((prev) => [data.product, ...prev]);
        setFeedback({
          type: "success",
          message: `"${data.product.productName}" published to catalog!`,
        });
      }
      setUploadModalOpen(false);
      setEditingProduct(null);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductStatus = async (product) => {
    try {
      const newActive = product.isActive === false ? true : false;
      const res = await apiFetch(`/api/vendor/store/${storeId}/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      setProducts((prev) =>
        prev.map((p) => (p._id === product._id ? { ...p, isActive: newActive } : p))
      );
    } catch (err) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  const entityConfig = getEntityConfig(profileForm.entityType);

  const productLimit = store?.limits?.productMonthlyLimit || 50;
  const currentProductCount = products.length;
  const remainingQuota = Math.max(0, productLimit - currentProductCount);
  const isSubscriptionActive = store?.subscription
    ? store.subscription.status === "active" || store.subscription.status === "trial"
    : true;

  const quotaInfo = {
    currentCount: currentProductCount,
    limit: productLimit,
    remaining: remainingQuota,
    isSubscriptionActive,
    status: store?.subscription?.status || "active",
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Top Bar */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
              title="Back to Marketplace"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-stone-900 text-lg leading-tight">
                  Vendor Management Portal
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${entityConfig.badgeClass}`}
                >
                  {entityConfig.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Manage your entity profile, isolated storefront & catalog
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {store && (
              <>
                <button
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-100 transition"
                >
                  <QrCode className="w-4 h-4 text-orange-600" />
                  <span>Store QR</span>
                </button>
                <Link
                  to={`/shop/${store.slug || store._id}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Storefront</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 pt-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl mb-6 text-sm flex items-center gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-stone-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "catalog"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catalog & Inventory ({products.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "profile"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Entity Profile & Onboarding Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("subscription")}
            className={`pb-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "subscription"
                ? "border-orange-600 text-orange-600"
                : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Subscription & Quotas</span>
          </button>
        </div>

        {/* Tab 1: Catalog Management */}
        {activeTab === "catalog" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  {entityConfig.id === "farmer"
                    ? "Produce & Harvest Catalog"
                    : entityConfig.id === "service_provider"
                    ? "Services & Packages"
                    : "Products & Stock"}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <p className="text-xs text-stone-500">
                    Items listed here appear directly on your dedicated storefront and in marketplace search.
                  </p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                    Quota: {currentProductCount}/{productLimit} used
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setUploadModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {entityConfig.id === "service_provider"
                    ? "Add New Service"
                    : entityConfig.id === "farmer"
                    ? "Add Harvest Item"
                    : "Add Product"}
                </span>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center text-stone-400 text-sm">
                Loading catalog items...
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-stone-200">
                <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <h3 className="font-semibold text-stone-800 text-sm">No items in catalog yet</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
                  Add your first item to start receiving direct orders or WhatsApp inquiries.
                </p>
                <button
                  onClick={() => {
                    setEditingProduct(null);
                    setUploadModalOpen(true);
                  }}
                  className="px-4 py-2 bg-orange-600 text-white text-xs font-semibold rounded-xl hover:bg-orange-700 transition"
                >
                  Add Your First Item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mobile View: Touch-Friendly Product Cards */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {products.map((item) => {
                    const price = item.price?.min ?? item.price ?? 0;
                    const unit = item.price?.unit ?? item.unit ?? "piece";
                    const active = item.isActive !== false;

                    return (
                      <div
                        key={item._id}
                        className="bg-white p-3.5 rounded-2xl border border-stone-200 flex items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={
                              item.images?.[0] ||
                              getProductFallbackImage(profileForm.entityType, item.category)
                            }
                            alt={item.productName}
                            className="w-14 h-14 object-cover rounded-xl border border-stone-200 bg-stone-100 shrink-0"
                            onError={(e) => {
                              handleImgError(
                                e,
                                getProductFallbackImage(profileForm.entityType, item.category)
                              );
                            }}
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-stone-900 text-xs truncate">
                              {item.productName}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-bold text-stone-900 text-xs">
                                ₹{Number(price).toLocaleString("en-IN")}
                              </span>
                              <span className="text-[10px] text-stone-400">/{unit}</span>
                            </div>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                                active
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-stone-100 text-stone-500 border border-stone-200"
                              }`}
                            >
                              {active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(item);
                              setUploadModalOpen(true);
                            }}
                            className="p-2 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs flex items-center justify-center transition"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(item)}
                            className="p-2 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 text-xs flex items-center justify-center transition"
                            title="Toggle Status"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Full Data Table */}
                <div className="hidden sm:block bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-stone-600">
                      <thead className="bg-stone-50 border-b border-stone-200 text-stone-900 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Item Name</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4">Unit</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {products.map((item) => {
                          const price = item.price?.min || item.price || 0;
                          const unit = item.price?.unit || item.unit || "piece";
                          const active = item.isActive !== false;

                          return (
                            <tr key={item._id} className="hover:bg-stone-50/70 transition">
                              <td className="py-3 px-4 font-semibold text-stone-900 flex items-center gap-3">
                                {item.images?.[0] ? (
                                  <img
                                    src={item.images[0]}
                                    alt={item.productName}
                                    className="w-10 h-10 object-cover rounded-lg border border-stone-200 bg-stone-100"
                                    onError={(e) => {
                                      handleImgError(
                                        e,
                                        getProductFallbackImage(profileForm.entityType, item.category)
                                      );
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={getProductFallbackImage(profileForm.entityType, item.category)}
                                    alt={item.productName}
                                    className="w-10 h-10 object-cover rounded-lg border border-stone-200 bg-stone-100 p-0.5"
                                  />
                                )}
                                <div>
                                  <span className="line-clamp-1">{item.productName}</span>
                                  {item.shortDescription && (
                                    <span className="text-[11px] text-stone-400 line-clamp-1 font-normal">
                                      {item.shortDescription}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px]">
                                  {item.category || "General"}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-bold text-stone-900">
                                ₹{Number(price).toLocaleString("en-IN")}
                              </td>
                              <td className="py-3 px-4 text-stone-500 capitalize">{unit}</td>
                              <td className="py-3 px-4">
                                <button
                                  onClick={() => handleToggleProductStatus(item)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                                    active
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                      : "bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200"
                                  }`}
                                >
                                  {active ? "Active" : "Inactive"}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setEditingProduct(item);
                                    setUploadModalOpen(true);
                                  }}
                                  className="p-1 rounded text-stone-400 hover:text-stone-800 transition mr-1"
                                  title="Edit Item"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleProductStatus(item)}
                                  className="p-1 rounded text-stone-400 hover:text-stone-700 transition"
                                  title="Toggle Status"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Profile & Entity Settings */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSave} className="space-y-6">
            {/* Entity Type Picker */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Entity Type</h3>
                <p className="text-xs text-stone-500">
                  Select your profile classification. This configures your badge, WhatsApp enquiry format, and storefront styling.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(ENTITY_TYPES).map((entity) => {
                  const isSelected = profileForm.entityType === entity.id;
                  return (
                    <div
                      key={entity.id}
                      onClick={() => setProfileForm({ ...profileForm, entityType: entity.id })}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                        isSelected
                          ? "border-orange-600 bg-orange-50/50"
                          : "border-stone-200 hover:border-stone-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${entity.badgeClass}`}
                        >
                          {entity.badgeLabel}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-orange-600" />}
                      </div>
                      <h4 className="font-bold text-stone-900 text-sm">{entity.label}</h4>
                      <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                        {entity.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* General Info */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h3 className="font-bold text-stone-900 text-sm">General Profile Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Business / Entity Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.storeName}
                    onChange={(e) => setProfileForm({ ...profileForm, storeName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Assigned Subdomain Slug
                  </label>
                  <input
                    type="text"
                    disabled
                    value={store?.subdomain || store?.slug || ""}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-100 text-xs font-mono text-stone-500"
                  />
                  <span className="text-[11px] text-stone-400 mt-0.5 block">
                    Direct access via {store?.subdomain || store?.slug}.bharatshopy.com
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Bio / Description
                  </label>
                  <textarea
                    rows={3}
                    value={profileForm.description}
                    onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    WhatsApp Enquiry Number
                  </label>
                  <input
                    type="text"
                    value={profileForm.whatsapp}
                    onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Area / Locality
                  </label>
                  <input
                    type="text"
                    value={profileForm.area}
                    onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">City</label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Entity Specific Metadata */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <h3 className="font-bold text-stone-900 text-sm">
                {profileForm.entityType === "farmer"
                  ? "🌾 Farm & Harvest Specific Metadata"
                  : profileForm.entityType === "service_provider"
                  ? "🛠️ Specialist & Service Terms"
                  : "🏪 Boutique & Shop Features"}
              </h3>

              {profileForm.entityType === "farmer" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Farm Location / Village
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mandya Valley Organic Belt"
                      value={profileForm.metadata?.farmLocation || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, farmLocation: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Harvest Season / Crops
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kharif Harvest, Organic Millets"
                      value={profileForm.metadata?.produceSeason || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, produceSeason: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                </div>
              )}

              {profileForm.entityType === "service_provider" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Experience (Years)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 12+ Years Master Artisan"
                      value={profileForm.metadata?.experienceYears || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, experienceYears: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Service Radius (km)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Up to 15 km"
                      value={profileForm.metadata?.serviceRadius || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, serviceRadius: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                </div>
              )}

              {profileForm.entityType === "shopkeeper" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Store Specialty
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Hand-block ethnic wear"
                      value={profileForm.metadata?.specialty || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, specialty: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Pickup / Delivery
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. In-store trials and doorstep delivery"
                      value={profileForm.metadata?.deliveryNotes || ""}
                      onChange={(e) =>
                        setProfileForm({
                          ...profileForm,
                          metadata: { ...profileForm.metadata, deliveryNotes: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white text-xs font-semibold rounded-xl hover:bg-orange-700 transition active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Saving Changes..." : "Save Profile & Settings"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Subscription & Quota Manager */}
        {activeTab === "subscription" && (
          <SubscriptionManager
            storeId={storeId}
            onSubscriptionUpdated={() => {
              apiFetch(`/api/vendor/store/${storeId}`)
                .then((r) => r.json())
                .then((d) => setStore(d.store))
                .catch(console.error);
            }}
          />
        )}

        {/* Product Upload / Edit Modal Panel */}
        <ProductUploadModal
          isOpen={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false);
            setEditingProduct(null);
          }}
          onSave={handleSaveProduct}
          entityType={profileForm.entityType}
          initialData={editingProduct}
          isSaving={saving}
          quotaInfo={quotaInfo}
        />

        {/* QR Modal */}
        {store && (
          <StoreQrModal
            store={store}
            isOpen={showQrModal}
            onClose={() => setShowQrModal(false)}
          />
        )}
      </main>
    </div>
  );
}
