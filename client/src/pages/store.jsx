import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Store as StoreIcon,
  Package,
  LoaderCircle,
  Clock,
  Search,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import Header from "@/components/layout/header/header";
import ProductCard from "@/components/productCard";

import {
  getStorePage,
} from "@/services/storePageService";

import {
  searchStoreProducts,
} from "@/services/storeProductSearchService";

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

function Store() {
  const navigate = useNavigate();
  const { storeId } = useParams();

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [defaultProducts, setDefaultProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [productSearch, setProductSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [productSearchLoading, setProductSearchLoading] =
    useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

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

        setSelectedImage(0);
        setImageErrors({});
      } catch (error) {
        console.error(
          "Store page loading failed:",
          error
        );

        setError(
          error.message || "Failed to load store"
        );
      } finally {
        setLoading(false);
      }
    }

    loadStore();
  }, [storeId]);

  function handleImageError(index) {
    setImageErrors((current) => ({
      ...current,
      [index]: true,
    }));
  }

  function openWhatsApp() {
    if (!store?.contact?.whatsapp) {
      return;
    }

    const whatsappNumber =
      store.contact.whatsapp.replace(/\D/g, "");

    const message = `Hello, I found your store on BharatShoppy.

Store: ${store.storeName}
Location: ${store.address?.area || ""}, ${store.city || ""}

I would like to know more about your products and availability.`;

    const whatsappUrl =
      `https://wa.me/${whatsappNumber}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function callStore() {
    if (!store?.contact?.phone) {
      return;
    }

    window.location.href =
      `tel:${store.contact.phone}`;
  }

  function getTodayKey() {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    return days[new Date().getDay()];
  }

  function getTodayHours() {
    if (!store?.businessHours) {
      return null;
    }

    return (
      store.businessHours[getTodayKey()] || null
    );
  }

  async function performProductSearch() {
    const trimmedQuery = productSearch.trim();

    if (!trimmedQuery) {
      setProducts(defaultProducts);
      setSearchOpen(false);
      return;
    }

    try {
      setProductSearchLoading(true);
      setSearchOpen(false);

      const data = await searchStoreProducts(
        storeId,
        trimmedQuery
      );

      setProducts(data.products || []);
    } catch (error) {
      console.error(
        "Store product search failed:",
        error
      );

      setProducts([]);
    } finally {
      setProductSearchLoading(false);
    }
  }

  function handleProductSearchSubmit(event) {
    event.preventDefault();

    performProductSearch();
  }

  function handleProductSearchChange(event) {
    const value = event.target.value;

    setProductSearch(value);

    if (!value.trim()) {
      setProducts(defaultProducts);
      setSearchOpen(false);
      return;
    }

    setSearchOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />

        <main className="flex min-h-[70vh] items-center justify-center">
          <LoaderCircle
            className="h-7 w-7 animate-spin text-slate-400"
            strokeWidth={1.8}
          />
        </main>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-white">
        <Header />

        <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4">
          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <StoreIcon
                className="h-6 w-6 text-slate-400"
                strokeWidth={1.7}
              />
            </div>

            <h1 className="mt-4 text-base font-semibold text-slate-900">
              Store not found
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              This store may no longer be available.
            </p>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#16365f]"
            >
              <ArrowLeft
                className="h-4 w-4"
                strokeWidth={1.8}
              />

              Go back
            </button>

          </div>
        </main>
      </div>
    );
  }

  const images =
    store.images?.length > 0
      ? store.images
      : [null];

  const selectedImageUrl =
    images[selectedImage];

  const todayHours = getTodayHours();

  const hasSearchQuery =
    productSearch.trim().length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0f2747]"
        >
          <ArrowLeft
            className="h-4 w-4"
            strokeWidth={1.8}
          />

          Back
        </button>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,39,71,0.05)] sm:p-7 lg:p-8">

          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">

            <div className="flex min-w-0 gap-4 sm:gap-5">

              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-24 sm:w-24">

                {store.logo ? (
                  <img
                    src={store.logo}
                    alt={store.storeName}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src =
                        "/assets/images/placeholders/storeLogoPlaceholder.jpeg";
                    }}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <img
                    src="/assets/images/placeholders/storeLogoPlaceholder.jpeg"
                    alt="Store logo unavailable"
                    className="h-full w-full object-contain p-2"
                  />
                )}

              </div>

              <div className="min-w-0">

                <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#0f2747] sm:text-3xl">
                  {store.storeName}
                </h1>

                {store.storeCategory && (
                  <div className="mt-2">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {store.storeCategory}
                    </span>
                  </div>
                )}

                {store.description && (
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
                    {store.description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">

                  {store.address?.area && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin
                        className="h-3.5 w-3.5 text-slate-400"
                        strokeWidth={1.8}
                      />

                      {store.address.area},{" "}
                      {store.city}
                    </span>
                  )}

                  {store.contact?.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone
                        className="h-3.5 w-3.5 text-slate-400"
                        strokeWidth={1.8}
                      />

                      {store.contact.phone}
                    </span>
                  )}

                </div>

              </div>

            </div>

            <div className="flex w-full flex-col gap-2 md:w-[220px]">

              {store.contact?.whatsapp && (
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#20bd5a]"
                >
                  <WhatsAppIcon className="h-4 w-4" />

                  WhatsApp
                </button>
              )}

              {store.contact?.phone && (
                <button
                  type="button"
                  onClick={callStore}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#16365f]"
                >
                  <Phone
                    className="h-4 w-4"
                    strokeWidth={2}
                  />

                  Call
                </button>
              )}

            </div>

          </div>

        </section>

{store.address && (
          <section className="mt-5 grid gap-5 md:grid-cols-2">

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,39,71,0.04)] sm:p-6">

              <div className="flex items-center gap-2">

                <MapPin
                  className="h-4 w-4 text-slate-500"
                  strokeWidth={1.8}
                />

                <h2 className="text-sm font-semibold text-[#0f2747]">
                  Store location
                </h2>

              </div>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                {store.address.area},{" "}
                {store.address.city},{" "}
                {store.address.state}{" "}
                {store.address.pincode}
              </p>

              <button
                type="button"
                disabled
                className="mt-4 cursor-not-allowed rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-300"
              >
                Get directions
              </button>

            </section>

            {todayHours && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,39,71,0.04)] sm:p-6">

                <div className="flex items-center gap-2">

                  <Clock
                    className="h-4 w-4 text-slate-500"
                    strokeWidth={1.8}
                  />

                  <h2 className="text-sm font-semibold text-[#0f2747]">
                    Business hours
                  </h2>

                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">

                  <span className="text-xs font-medium text-slate-500">
                    Today
                  </span>

                  <span className="text-xs font-semibold text-slate-800">
                    {todayHours.open} -{" "}
                    {todayHours.close}
                  </span>

                </div>

                <p className="mt-3 text-[11px] text-slate-400">
                  Business hours may vary on holidays.
                </p>

              </section>
            )}

          </section>
        )}
        
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,39,71,0.04)]">

          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">

            <div className="flex items-center gap-2">

              <Package
                className="h-4 w-4 text-slate-500"
                strokeWidth={1.8}
              />

              <h2 className="text-sm font-semibold text-[#0f2747]">
                Products from this store
              </h2>

              {products.length > 0 && (
                <span className="text-xs text-slate-400">
                  ({products.length})
                </span>
              )}

            </div>

            <div className="relative mt-4">

              <form
                onSubmit={handleProductSearchSubmit}
                className="group flex h-10 w-full items-center rounded-xl border border-slate-200 bg-slate-50 transition-all duration-200 focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm sm:h-11"
              >
                <Search
                  className="ml-2.5 h-[17px] w-[17px] shrink-0 text-slate-400 transition-colors group-focus-within:text-slate-600 sm:ml-3.5 sm:h-[18px] sm:w-[18px]"
                />

                <input
                  type="search"
                  value={productSearch}
                  onChange={handleProductSearchChange}
                  onFocus={() => {
                    if (hasSearchQuery) {
                      setSearchOpen(true);
                    }
                  }}
                  placeholder="Search products in this store..."
                  aria-label="Search products in this store"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:px-3"
                />

                {productSearchLoading && (
                  <LoaderCircle
                    className="mr-3 h-4 w-4 shrink-0 animate-spin text-slate-400"
                    strokeWidth={1.8}
                  />
                )}
              </form>

              {searchOpen && hasSearchQuery && (
                <div className="absolute left-0 right-0 top-12 z-50 rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:top-14">

                  <button
                    type="button"
                    onClick={performProductSearch}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        Search for "{productSearch.trim()}"
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        Search products in this store
                      </p>
                    </div>
                  </button>

                </div>
              )}

            </div>

          </div>

          {products.length > 0 ? (
            <div className="p-5 sm:p-6">

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">

                {products.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                  />
                ))}

              </div>

            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">

                <Package
                  className="h-5 w-5 text-slate-400"
                  strokeWidth={1.7}
                />

              </div>

              <h3 className="mt-4 text-sm font-semibold text-slate-800">
                {hasSearchQuery
                  ? "No products found"
                  : "No products available"}
              </h3>

              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
                {hasSearchQuery
                  ? `No products in this store match "${productSearch.trim()}".`
                  : "This store currently has no products listed on BharatShoppy."}
              </p>

            </div>
          )}

        </section>

        

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,39,71,0.04)]">

          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">

            <div className="flex items-center gap-2">

              <StoreIcon
                className="h-4 w-4 text-slate-500"
                strokeWidth={1.8}
              />

              <h2 className="text-sm font-semibold text-[#0f2747]">
                Store gallery
              </h2>

            </div>

          </div>

          <div className="flex min-h-[300px] items-center justify-center bg-slate-50 p-5 sm:min-h-[430px] sm:p-8">

            {selectedImageUrl &&
            !imageErrors[selectedImage] ? (
              <img
                src={selectedImageUrl}
                alt={`${store.storeName} storefront`}
                onError={() =>
                  handleImageError(selectedImage)
                }
                className="h-full max-h-[400px] w-full object-contain"
              />
            ) : (
              <img
                src="/assets/images/placeholders/storePlaceholder.jpeg"
                alt="Store image unavailable"
                className="h-full max-h-[400px] w-full object-contain"
              />
            )}

          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto border-t border-slate-100 p-4">

              {images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() =>
                    setSelectedImage(index)
                  }
                  className={`flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-white transition-all ${
                    selectedImage === index
                      ? "border-[#0f2747] ring-2 ring-slate-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {image &&
                  !imageErrors[index] ? (
                    <img
                      src={image}
                      alt={`${store.storeName} ${
                        index + 1
                      }`}
                      onError={() =>
                        handleImageError(index)
                      }
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src="/assets/images/placeholders/storePlaceholder.jpeg"
                      alt="Store image unavailable"
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}

            </div>
          )}

        </section>

      </main>
    </div>
  );
}

export default Store;