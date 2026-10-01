import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Store as StoreIcon,
  Package,
  LoaderCircle,
  Clock,
  Search,
  Share2,
  Check,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  BadgeCheck,
  X,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";

import ProductCard from "@/components/productCard";
import StoreCartDrawer from "@/components/store/storeCartDrawer";
import { useStoreCart } from "@/hooks/useStoreCart";
import { getStorePage } from "@/services/storePageService";
import { searchStoreProducts } from "@/services/storeProductSearchService";

function WhatsAppIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.51 0 .17 5.34.17 11.9c0 2.1.55 4.15 1.59 5.96L.07 24l6.28-1.65a11.9 11.9 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.46-8.43ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.21-3.73.98 1-3.64-.23-.37a9.87 9.87 0 1 1 8.36 4.61Z"
        fill="currentColor"
      />
      <path
        d="M17.82 13.99c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.51-.16-.72.16-.21.31-.83 1.04-1.02 1.25-.19.21-.38.23-.7.08-.32-.16-1.33-.49-2.54-1.56-.94-.84-1.57-1.87-1.75-2.18-.18-.31-.02-.48.14-.64.14-.14.32-.37.48-.55.16-.18.21-.31.32-.52.11-.21.05-.39-.03-.55-.08-.16-.72-1.73-.99-2.37-.26-.62-.53-.54-.72-.55-.18-.01-.39-.01-.6-.01-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.38 4.76.75.32 1.34.51 1.8.65.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.14-.29-.23-.61-.39Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatTime(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${m < 10 ? "0" : ""}${m} ${period}`;
}

function getStoreOpenStatus(businessHours) {
  if (!businessHours) return null;
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const now = new Date();
  const dayName = days[now.getDay()];
  const todayHours = businessHours[dayName];
  if (!todayHours || !todayHours.open || !todayHours.close) {
    return { isOpen: false, text: "Closed today" };
  }

  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
    return {
      isOpen: true,
      text: `Open now · Closes at ${formatTime(todayHours.close)}`,
      todayHours,
    };
  } else if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      text: `Closed now · Opens at ${formatTime(todayHours.open)}`,
      todayHours,
    };
  } else {
    return {
      isOpen: false,
      text: `Closed now · Opens tomorrow`,
      todayHours,
    };
  }
}

function Store() {
  const navigate = useNavigate();
  const { storeId } = useParams();

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [defaultProducts, setDefaultProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [productSearch, setProductSearch] = useState("");
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [activeTab, setActiveTab] = useState("products");
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState(0);
  const [imageErrors, setImageErrors] = useState({});
  const [copiedLink, setCopiedLink] = useState(false);

  const currentDayOfWeek = useMemo(() => {
    return new Date()
      .toLocaleDateString("en-US", { weekday: "long" })
      .toLowerCase();
  }, []);

  // Shop-specific Cart Hook
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getQuantity,
    totalCount,
    totalEstimatedPrice,
    sendWhatsAppEnquiry,
  } = useStoreCart(storeId);

  useEffect(() => {
    async function loadStore() {
      try {
        setLoading(true);
        setError(null);

        const data = await getStorePage(storeId);
        const initialProducts = data.products || [];

        setStore(data.store || null);
        setProducts(initialProducts);
        setDefaultProducts(initialProducts);
        setSelectedGalleryImage(0);
        setImageErrors({});
      } catch (err) {
        console.error("Store page loading failed:", err);
        setError(err.message || "Failed to load store");
      } finally {
        setLoading(false);
      }
    }

    loadStore();
  }, [storeId]);

  // Extract distinct product categories from store's default products
  const storeCategories = useMemo(() => {
    const counts = {};
    defaultProducts.forEach((p) => {
      const cat = p.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const categoriesList = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));

    return categoriesList;
  }, [defaultProducts]);

  // Filter products by selected category
  const displayedProducts = useMemo(() => {
    if (selectedCategory === "all") {
      return products;
    }
    return products.filter(
      (p) =>
        (p.category || "").toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  async function performProductSearch(searchTerm) {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setProducts(defaultProducts);
      return;
    }

    try {
      setProductSearchLoading(true);
      const data = await searchStoreProducts(storeId, trimmed);
      setProducts(data.products || []);
    } catch (err) {
      console.error("Store product search failed:", err);
      setProducts([]);
    } finally {
      setProductSearchLoading(false);
    }
  }

  function handleProductSearchChange(event) {
    const value = event.target.value;
    setProductSearch(value);
    if (!value.trim()) {
      setProducts(defaultProducts);
    }
  }

  function handleProductSearchSubmit(event) {
    event.preventDefault();
    performProductSearch(productSearch);
  }

  function handleClearSearch() {
    setProductSearch("");
    setProducts(defaultProducts);
  }

  function openWhatsAppDirect() {
    if (!store?.contact?.whatsapp) return;
    const rawNumber = store.contact.whatsapp.replace(/\D/g, "");
    const num = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;
    const msg = `Hello ${store.storeName}, I found your shop on BharatShoppy and would like to enquire about your products.`;
    window.open(
      `https://wa.me/${num}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function callStore() {
    if (!store?.contact?.phone) return;
    window.location.href = `tel:${store.contact.phone}`;
  }

  function handleShareStore() {
    if (navigator.share) {
      navigator
        .share({
          title: store?.storeName || "BharatShoppy Store",
          text: `Check out ${store?.storeName} on BharatShoppy!`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  function getDirectionsUrl() {
    if (store?.location?.latitude && store?.location?.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${store.location.latitude},${store.location.longitude}`;
    }
    const query = [store?.storeName, store?.address?.area, store?.city]
      .filter(Boolean)
      .join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;
  }

  const openStatus = useMemo(() => {
    return getStoreOpenStatus(store?.businessHours);
  }, [store]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <main className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
          <LoaderCircle
            className="h-8 w-8 animate-spin text-blue-900"
            strokeWidth={1.8}
          />
          <p className="text-sm font-medium text-slate-500">
            Loading storefront...
          </p>
        </main>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <StoreIcon className="h-7 w-7" strokeWidth={1.7} />
            </div>
            <h1 className="mt-4 text-lg font-bold text-slate-900">
              Store Not Found
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              We couldn&apos;t load this store&apos;s page. It may have been relocated or is temporarily offline.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0f2747] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#16365f] transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to BharatShoppy</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  const galleryImages =
    store.images?.length > 0 ? store.images : [store.logo].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50/60 pb-28">
      {/* 1. TOP BREADCRUMB & ENQUIRY BAG BAR */}
      <div className="static sm:sticky sm:top-16 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 font-medium text-slate-600 hover:text-blue-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
            <span className="text-slate-300">/</span>
            <Link
              to="/"
              className="hover:text-slate-800 transition-colors hidden sm:inline"
            >
              Stores
            </Link>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <span className="truncate font-semibold text-slate-900 max-w-[140px] sm:max-w-none">
              {store.storeName}
            </span>
          </div>

          {/* Status & Top Bag Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {openStatus && (
              <span
                className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                  openStatus.isOpen
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    openStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {openStatus.text}
              </span>
            )}

            {/* Quick Enquiry Bag Button */}
            <button
              type="button"
              onClick={() => setCartDrawerOpen(true)}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                totalCount > 0
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-500/20"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Enquiry Bag</span>
              <span
                className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                  totalCount > 0
                    ? "bg-white text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {totalCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 space-y-6">
        {/* 2. STORE WEBSITE HERO & IDENTITY */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm">
          {/* Store Info & Actions */}
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              {/* Brand Avatar + Title */}
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 min-w-0">
                {/* Logo Badge */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xs">
                  {store.logo ? (
                    <img
                      src={store.logo}
                      alt={store.storeName}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src =
                          "/assets/images/placeholders/storeLogoPlaceholder.jpeg";
                      }}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <img
                      src="/assets/images/placeholders/storeLogoPlaceholder.jpeg"
                      alt="Store logo"
                      className="h-full w-full object-contain p-2"
                    />
                  )}
                </div>

                {/* Name, Category, Location */}
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                      {store.storeName}
                    </h1>
                    <BadgeCheck
                      className="h-5 w-5 text-blue-600 shrink-0"
                      title="Verified Store on BharatShoppy"
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {store.storeCategory && (
                      <span className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 border border-blue-100">
                        {store.storeCategory}
                      </span>
                    )}

                    {store.city && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        {store.address?.area ? `${store.address.area}, ` : ""}
                        {store.city}
                      </span>
                    )}

                    {openStatus && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-[11px] md:hidden ${
                          openStatus.isOpen
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            openStatus.isOpen ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {openStatus.isOpen ? "Open" : "Closed"}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {store.description && (
                    <p className="mt-3.5 text-xs sm:text-sm leading-relaxed text-slate-600 max-w-2xl">
                      {store.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons Ribbon */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0">
                {store.contact?.whatsapp && (
                  <button
                    type="button"
                    onClick={openWhatsAppDirect}
                    className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#20bd5a] transition-all cursor-pointer"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                    <span>WhatsApp</span>
                  </button>
                )}

                {store.contact?.phone && (
                  <button
                    type="button"
                    onClick={callStore}
                    className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-[#0f2747] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#16365f] transition-all cursor-pointer"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Call Shop</span>
                  </button>
                )}

                <a
                  href={getDirectionsUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Directions</span>
                </a>

                <button
                  type="button"
                  onClick={handleShareStore}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Share Store"
                >
                  {copiedLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 3. STOREFRONT NAVIGATION TABS */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 sm:px-8">
            <div className="flex gap-6 overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className={`relative flex cursor-pointer items-center gap-2 py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "products"
                    ? "text-[#0f2747]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Package className="h-4 w-4" />
                <span>Products & Catalog</span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {defaultProducts.length}
                </span>
                {activeTab === "products" && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#0f2747] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("about")}
                className={`relative flex cursor-pointer items-center gap-2 py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "about"
                    ? "text-[#0f2747]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Store Timings & Info</span>
                {activeTab === "about" && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#0f2747] rounded-full" />
                )}
              </button>

              {galleryImages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("gallery")}
                  className={`relative flex cursor-pointer items-center gap-2 py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
                    activeTab === "gallery"
                      ? "text-[#0f2747]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <StoreIcon className="h-4 w-4" />
                  <span>Gallery</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    {galleryImages.length}
                  </span>
                  {activeTab === "gallery" && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#0f2747] rounded-full" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("contact")}
                className={`relative flex cursor-pointer items-center gap-2 py-3.5 text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "contact"
                    ? "text-[#0f2747]"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <MapPin className="h-4 w-4" />
                <span>Location & Contact</span>
                {activeTab === "contact" && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#0f2747] rounded-full" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* 4. TAB CONTENTS */}

        {/* TAB A: PRODUCTS & IN-STORE CATALOG */}
        {activeTab === "products" && (
          <div className="space-y-5">
            {/* In-Store Search & Category Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <form
                  onSubmit={handleProductSearchSubmit}
                  className="group relative flex h-10 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 transition-all focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm"
                >
                  <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400 group-focus-within:text-slate-600" />
                  <input
                    type="search"
                    value={productSearch}
                    onChange={handleProductSearchChange}
                    placeholder={`Search within ${store.storeName}...`}
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-base sm:text-sm leading-normal text-slate-800 outline-none placeholder:text-slate-400 [appearance:textfield] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="mr-2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {productSearchLoading && (
                    <LoaderCircle className="mr-3 h-4 w-4 animate-spin text-slate-400" />
                  )}
                </form>

                {/* Bag Status Summary */}
                <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
                  <span className="text-slate-500">
                    Showing{" "}
                    <strong className="text-slate-900">
                      {displayedProducts.length}
                    </strong>{" "}
                    product{displayedProducts.length === 1 ? "" : "s"}
                  </span>
                  {totalCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setCartDrawerOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <ShoppingBag className="h-3 w-3" />
                      <span>{totalCount} in enquiry bag</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills (if multiple categories exist) */}
              {storeCategories.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("all")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      selectedCategory === "all"
                        ? "bg-[#0f2747] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All Items ({defaultProducts.length})
                  </button>

                  {storeCategories.map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedCategory(name)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                        selectedCategory === name
                          ? "bg-[#0f2747] text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {name} ({count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Grid */}
            {displayedProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    showCartAction={true}
                    cartQuantity={getQuantity(product._id)}
                    onAddToCart={addToCart}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Package className="h-6 w-6" strokeWidth={1.7} />
                </div>
                <h3 className="mt-4 text-sm font-bold text-slate-800">
                  No products matched
                </h3>
                <p className="mt-1 max-w-sm text-xs text-slate-500">
                  {productSearch
                    ? `No products in ${store.storeName} match "${productSearch}".`
                    : "No products in the selected category."}
                </p>
                {(productSearch || selectedCategory !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductSearch("");
                      setSelectedCategory("all");
                      setProducts(defaultProducts);
                    }}
                    className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB B: ABOUT & HOURS */}
        {activeTab === "about" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Business Hours Table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-900" />
                <h2 className="text-base font-bold text-slate-900">
                  Weekly Business Hours
                </h2>
              </div>

              {store.businessHours ? (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden text-xs">
                  {[
                    "monday",
                    "tuesday",
                    "wednesday",
                    "thursday",
                    "friday",
                    "saturday",
                    "sunday",
                  ].map((day) => {
                    const hours = store.businessHours[day];
                    const isToday = currentDayOfWeek === day;

                    return (
                      <div
                        key={day}
                        className={`flex items-center justify-between px-4 py-3 ${
                          isToday
                            ? "bg-blue-50/70 font-semibold text-blue-900"
                            : "text-slate-600"
                        }`}
                      >
                        <span className="capitalize flex items-center gap-2">
                          {day}
                          {isToday && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </span>
                        <span>
                          {hours && hours.open && hours.close
                            ? `${formatTime(hours.open)} - ${formatTime(
                                hours.close
                              )}`
                            : "Closed"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Business hours are not specified for this store.
                </p>
              )}
            </div>

            {/* Store Information */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <StoreIcon className="h-5 w-5 text-blue-900" />
                <h2 className="text-base font-bold text-slate-900">
                  About {store.storeName}
                </h2>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                {store.description ||
                  `${store.storeName} is a verified merchant on BharatShoppy, serving shoppers in ${store.city}.`}
              </p>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">
                      Direct Merchant Enquiries
                    </strong>
                    <p className="text-slate-500 mt-0.5">
                      BharatShoppy connects you directly with the shop owners. No third-party markups — get real-time stock and local pricing.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <ShoppingBag className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">
                      Multi-Product Enquiries
                    </strong>
                    <p className="text-slate-500 mt-0.5">
                      Use the shop enquiry bag to bundle multiple products and send one consolidated WhatsApp message.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB C: PHOTO GALLERY */}
        {activeTab === "gallery" && galleryImages.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Storefront & Interior Photos
              </h2>
              <span className="text-xs text-slate-500">
                {galleryImages.length} image{galleryImages.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Featured Image */}
            <div className="flex min-h-[300px] max-h-[460px] w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50 border border-slate-100 p-2">
              <img
                src={
                  imageErrors[selectedGalleryImage]
                    ? "/assets/images/placeholders/storePlaceholder.jpeg"
                    : galleryImages[selectedGalleryImage]
                }
                alt={`${store.storeName} photo`}
                className="h-full max-h-[440px] w-full object-contain"
                onError={() =>
                  setImageErrors((cur) => ({
                    ...cur,
                    [selectedGalleryImage]: true,
                  }))
                }
              />
            </div>

            {/* Thumbnail Carousel */}
            {galleryImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedGalleryImage(idx)}
                    className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-50 transition-all cursor-pointer ${
                      selectedGalleryImage === idx
                        ? "border-[#0f2747] ring-2 ring-blue-100"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB D: LOCATION & CONTACT */}
        {activeTab === "contact" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Address Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-900" />
                <h2 className="text-base font-bold text-slate-900">
                  Shop Address & Location
                </h2>
              </div>

              {store.address ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs sm:text-sm text-slate-700 space-y-1">
                  <p className="font-semibold text-slate-900">
                    {store.storeName}
                  </p>
                  <p>{store.address.area}</p>
                  <p>
                    {store.address.city}, {store.address.state}{" "}
                    {store.address.pincode}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Address details not available.
                </p>
              )}

              <a
                href={getDirectionsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0f2747] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#16365f] transition-all"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Open in Google Maps</span>
              </a>
            </div>

            {/* Direct Contact Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-900" />
                <h2 className="text-base font-bold text-slate-900">
                  Contact Information
                </h2>
              </div>

              <div className="space-y-3">
                {store.contact?.whatsapp && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        WhatsApp Enquiries
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {store.contact.whatsapp}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openWhatsAppDirect}
                      className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#20bd5a] transition-colors"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" />
                      <span>Chat</span>
                    </button>
                  </div>
                )}

                {store.contact?.phone && (
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Phone Calls
                      </p>
                      <p className="text-sm font-semibold text-slate-800">
                        {store.contact.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={callStore}
                      className="flex items-center gap-1.5 rounded-lg bg-[#0f2747] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#16365f] transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. FLOATING ENQUIRY BAR (VISIBLE WHEN ITEMS ARE IN BAG) */}
      {totalCount > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="mx-auto max-w-xl pointer-events-auto">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900/95 p-3.5 sm:px-5 sm:py-3.5 text-white shadow-2xl backdrop-blur-md border border-slate-800/80 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">
                    {totalCount} item{totalCount === 1 ? "" : "s"} in Enquiry Bag
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Est. Total:{" "}
                    <strong className="text-white font-bold">
                      {totalEstimatedPrice > 0
                        ? `₹${totalEstimatedPrice.toLocaleString("en-IN")}`
                        : "On Request"}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCartDrawerOpen(true)}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/30 hover:bg-[#20bd5a] transition-all active:scale-95"
              >
                <span>Review & Enquire</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SHOP-SPECIFIC ENQUIRY CART DRAWER */}
      <StoreCartDrawer
        isOpen={cartDrawerOpen}
        onClose={() => setCartDrawerOpen(false)}
        store={store}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onClearCart={clearCart}
        totalCount={totalCount}
        totalEstimatedPrice={totalEstimatedPrice}
        onSendWhatsApp={sendWhatsAppEnquiry}
      />
    </div>
  );
}

export default Store;