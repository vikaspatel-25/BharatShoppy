import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import Header from "@/components/layout/header/header";
import ProductCard from "@/components/productCard";
import { getProducts } from "@/services/productService";
import { useLocation } from "@/context/locationContext";

function Home() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { selectedLocation } = useLocation();

  const observerRef = useRef(null);

  useEffect(() => {
    async function loadInitialProducts() {
      try {
        setLoading(true);

        const city = selectedLocation?.city || null;

        const data = await getProducts(1, city);

        setProducts(data.products);
        setPage(1);
        setHasMore(data.pagination.hasMore);
      } catch (error) {
        console.error("Product loading failed:", error);

        setProducts([]);
        setPage(1);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }

    loadInitialProducts();
  }, [selectedLocation]);

  async function loadMoreProducts() {
    if (loading || loadingMore || !hasMore) {
      return;
    }

    try {
      setLoadingMore(true);

      const nextPage = page + 1;
      const city = selectedLocation?.city || null;

      const data = await getProducts(nextPage, city);

      setProducts((currentProducts) => [
        ...currentProducts,
        ...data.products,
      ]);

      setPage(nextPage);
      setHasMore(data.pagination.hasMore);
    } catch (error) {
      console.error("More products loading failed:", error);
    } finally {
      setLoadingMore(false);
    }
  }

  const loadMoreRef = useRef(null);

  useEffect(() => {
    const element = loadMoreRef.current;

    if (!element) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (entry.isIntersecting) {
          loadMoreProducts();
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
  }, [page, hasMore, loading, loadingMore, selectedLocation]);

  return (
    <div>
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <LoaderCircle className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <p className="text-base font-medium text-slate-700">
              No products available
            </p>

            <p className="mt-1 text-sm text-slate-400">
              There are no products available in this location yet.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {products.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                />
              ))}
            </div>

            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex h-24 items-center justify-center"
              >
                {loadingMore && (
                  <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Home;