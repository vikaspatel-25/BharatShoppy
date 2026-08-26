import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Store, Package } from "lucide-react";

import Header from "@/components/layout/header/header";
import ProductCard from "@/components/productCard";
import StoreCard from "@/components/storeCard";

import { getProducts } from "@/services/productService";
import { getStores } from "@/services/storeService";

import { useLocation } from "@/context/locationContext";

const categories = [
  "Apparel & Fashion",
  "Books & Stationery",
  "Groceries & Organics",
  "Furniture & Home Decor",
  "Pet Supplies",
  "Sports & Outdoors",
  "Jewelry & Watches",
  "Home & Garden",
  "Electronics",
  "Gaming",
  "Gadgets",
  "Computers",
  "Mobiles",
  "Audio"
];

function Home() {
  const { selectedLocation } = useLocation();

  const [activeTab, setActiveTab] = useState("products");
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [products, setProducts] = useState([]);
  const [productPage, setProductPage] = useState(1);
  const [productHasMore, setProductHasMore] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const [stores, setStores] = useState([]);
  const [storePage, setStorePage] = useState(1);
  const [storeHasMore, setStoreHasMore] = useState(false);
  const [storesLoaded, setStoresLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMoreRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    setProducts([]);
    setStores([]);

    setProductPage(1);
    setStorePage(1);

    setProductHasMore(false);
    setStoreHasMore(false);

    setProductsLoaded(false);
    setStoresLoaded(false);

    setActiveTab("products");
    setSelectedCategory(null);
  }, [selectedLocation]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);

        const city = selectedLocation?.city || null;
        const category = selectedCategory || null;

        if (activeTab === "products" && !productsLoaded) {
          const data = await getProducts(
            1,
            city,
            category
          );

          setProducts(data.products || []);

          setProductPage(
            data.pagination?.page || 1
          );

          setProductHasMore(
            data.pagination?.hasMore || false
          );

          setProductsLoaded(true);
        }

        if (activeTab === "stores" && !storesLoaded) {
          const data = await getStores(
            1,
            city,
            category
          );

          setStores(data.stores || []);

          setStorePage(
            data.pagination?.page || 1
          );

          setStoreHasMore(
            data.pagination?.hasMore || false
          );

          setStoresLoaded(true);
        }
      } catch (error) {
        console.error(
          "Home data loading failed:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [
    activeTab,
    selectedLocation,
    selectedCategory,
    productsLoaded,
    storesLoaded,
  ]);

  function handleCategoryChange(category) {
    setSelectedCategory(
      selectedCategory === category ? null : category
    );

    setProducts([]);
    setStores([]);

    setProductPage(1);
    setStorePage(1);

    setProductHasMore(false);
    setStoreHasMore(false);

    setProductsLoaded(false);
    setStoresLoaded(false);
  }

  async function loadMore() {
    if (loading || loadingMore) {
      return;
    }

    const city = selectedLocation?.city || null;
    const category = selectedCategory || null;

    try {
      setLoadingMore(true);

      if (activeTab === "products") {
        if (!productHasMore) {
          return;
        }

        const nextPage = productPage + 1;

        const data = await getProducts(
          nextPage,
          city,
          category
        );

        setProducts((currentProducts) => [
          ...currentProducts,
          ...(data.products || []),
        ]);

        setProductPage(
          data.pagination?.page || nextPage
        );

        setProductHasMore(
          data.pagination?.hasMore || false
        );
      }

      if (activeTab === "stores") {
        if (!storeHasMore) {
          return;
        }

        const nextPage = storePage + 1;

        const data = await getStores(
          nextPage,
          city,
          category
        );

        setStores((currentStores) => [
          ...currentStores,
          ...(data.stores || []),
        ]);

        setStorePage(
          data.pagination?.page || nextPage
        );

        setStoreHasMore(
          data.pagination?.hasMore || false
        );
      }
    } catch (error) {
      console.error(
        "Loading more home results failed:",
        error
      );
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const element = loadMoreRef.current;

    if (!element) {
      return;
    }

    const hasMore =
      activeTab === "products"
        ? productHasMore
        : storeHasMore;

    if (!hasMore) {
      return;
    }

    observerRef.current?.disconnect();

    observerRef.current =
      new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMore();
          }
        },
        {
          rootMargin: "300px",
        }
      );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [
    activeTab,
    productHasMore,
    storeHasMore,
    productPage,
    storePage,
    loading,
    loadingMore,
    selectedLocation,
    selectedCategory,
  ]);

  const currentResults =
    activeTab === "products"
      ? products
      : stores;

  const currentHasMore =
    activeTab === "products"
      ? productHasMore
      : storeHasMore;

  const hasResults =
    currentResults.length > 0;

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-6">

            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`relative flex cursor-pointer items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "products"
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Package
                className="h-4 w-4"
                strokeWidth={1.8}
              />

              Products

              {activeTab === "products" && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-slate-900" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("stores")}
              className={`relative flex cursor-pointer items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === "stores"
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Store
                className="h-4 w-4"
                strokeWidth={1.8}
              />

              Stores

              {activeTab === "stores" && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-slate-900" />
              )}
            </button>

          </div>
        </div>

        {/* Categories */}
        <div className="mt-4 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex min-w-max gap-2">

            <button
              type="button"
              onClick={() => handleCategoryChange(null)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === null
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              All
            </button>

            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() =>
                  handleCategoryChange(category)
                }
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {category}
              </button>
            ))}

          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[360px] items-center justify-center">
            <LoaderCircle
              className="h-7 w-7 animate-spin text-slate-400"
              strokeWidth={1.8}
            />
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasResults && (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              {activeTab === "products" ? (
                <Package
                  className="h-5 w-5 text-slate-400"
                  strokeWidth={1.7}
                />
              ) : (
                <Store
                  className="h-5 w-5 text-slate-400"
                  strokeWidth={1.7}
                />
              )}
            </div>

            <h2 className="mt-4 text-sm font-semibold text-slate-800">
              No {activeTab} available
            </h2>

            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
              There are currently no {activeTab} available
              {selectedCategory
                ? ` in ${selectedCategory}.`
                : selectedLocation
                  ? ` in ${selectedLocation.city}.`
                  : "."}
            </p>

          </div>
        )}

        {/* Products */}
        {!loading &&
          activeTab === "products" &&
          hasResults && (
            <section className="mt-6">

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {products.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                  />
                ))}
              </div>

              {currentHasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex h-20 items-center justify-center"
                >
                  {loadingMore && (
                    <LoaderCircle
                      className="h-5 w-5 animate-spin text-slate-400"
                      strokeWidth={1.8}
                    />
                  )}
                </div>
              )}

              {!currentHasMore && (
                <p className="pt-6 text-center text-xs text-slate-400">
                  You've reached the end of the products.
                </p>
              )}

            </section>
          )}

        {/* Stores */}
        {!loading &&
          activeTab === "stores" &&
          hasResults && (
            <section className="mt-6">

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {stores.map((store) => (
                  <StoreCard
                    key={store._id}
                    store={store}
                  />
                ))}
              </div>

              {currentHasMore && (
                <div
                  ref={loadMoreRef}
                  className="flex h-20 items-center justify-center"
                >
                  {loadingMore && (
                    <LoaderCircle
                      className="h-5 w-5 animate-spin text-slate-400"
                      strokeWidth={1.8}
                    />
                  )}
                </div>
              )}

              {!currentHasMore && (
                <p className="pt-6 text-center text-xs text-slate-400">
                  You've reached the end of the stores.
                </p>
              )}

            </section>
          )}

      </main>
    </div>
  );
}

export default Home;