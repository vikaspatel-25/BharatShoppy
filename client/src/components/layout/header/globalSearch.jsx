import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "@/context/locationContext";
import { searchGlobal } from "@/services/globalSearchService";

function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    products: [],
    stores: [],
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchRef = useRef(null);

  const navigate = useNavigate();
  const { selectedLocation } = useLocation();

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target)
      ) {
        setSearchOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  useEffect(() => {
    async function loadSearchResults() {
      const trimmedQuery = query.trim();

      if (!trimmedQuery) {
        setResults({
          products: [],
          stores: [],
        });

        setSearchOpen(false);
        return;
      }

      try {
        setSearchLoading(true);
        setSearchOpen(true);

        const city = selectedLocation?.city || null;

        const data = await searchGlobal(
          trimmedQuery,
          city
        );

        setResults(data);
      } catch (error) {
        console.error("Global search failed:", error);

        setResults({
          products: [],
          stores: [],
        });
      } finally {
        setSearchLoading(false);
      }
    }

    loadSearchResults();
  }, [query, selectedLocation]);

  function handleInputChange(event) {
    setQuery(event.target.value);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    goToSearchResults(trimmedQuery);
  }

  function goToSearchResults(searchQuery) {
    setSearchOpen(false);

    navigate(
      `/search?q=${encodeURIComponent(searchQuery)}`
    );
  }

  function handleQuerySuggestion() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    goToSearchResults(trimmedQuery);
  }

  function handleProductClick(product) {
    setSearchOpen(false);

    navigate(`/product/${product._id}`);
  }

  function handleStoreClick(store) {
    setSearchOpen(false);

    navigate(`/store/${store._id}`);
  }

  function handleViewAllResults() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    goToSearchResults(trimmedQuery);
  }

  const hasProducts = results.products.length > 0;
  const hasStores = results.stores.length > 0;
  const hasResults = hasProducts || hasStores;

  const trimmedQuery = query.trim();

  return (
    <div
      ref={searchRef}
      className="relative flex min-w-0 flex-1"
    >
      <form
        onSubmit={handleSearchSubmit}
        className="group flex h-10 min-w-0 flex-1 items-center rounded-xl border border-slate-400 bg-slate-50 transition-all duration-200 focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm sm:h-11"
      >
        <Search className="ml-2.5 h-[17px] w-[17px] shrink-0 text-slate-400 transition-colors group-focus-within:text-slate-600 sm:ml-3.5 sm:h-[18px] sm:w-[18px]" />

        <input
          type="search"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim()) {
              setSearchOpen(true);
            }
          }}
          placeholder="Search products or stores..."
          aria-label="Search products or stores"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:px-3"
        />
      </form>

      {searchOpen && (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl sm:top-14">

          {/* Search Query Suggestion */}
          {trimmedQuery && (
            <button
              type="button"
              onClick={handleQuerySuggestion}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400" />

              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  Search for "{trimmedQuery}"
                </p>

                <p className="mt-0.5 text-xs text-slate-400">
                  View all matching products and stores
                </p>
              </div>
            </button>
          )}

          {/* Divider */}
          {trimmedQuery && (
            <div className="my-1 border-t border-slate-100" />
          )}

          {searchLoading && (
            <p className="px-3 py-4 text-sm text-slate-400">
              Searching...
            </p>
          )}

          {!searchLoading && !hasResults && (
            <p className="px-3 py-4 text-sm text-slate-400">
              No products or stores found.
            </p>
          )}

          {/* Products */}
          {!searchLoading && hasProducts && (
            <div>
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Products
              </p>

              {results.products.slice(0, 3).map((product) => (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => handleProductClick(product)}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <p className="truncate text-sm font-medium text-slate-800">
                    {product.productName}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {product.brand || product.category}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Stores */}
          {!searchLoading && hasStores && (
            <div
              className={
                hasProducts
                  ? "mt-2 border-t border-slate-100 pt-2"
                  : ""
              }
            >
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Stores
              </p>

              {results.stores.slice(0, 3).map((store) => (
                <button
                  key={store._id}
                  type="button"
                  onClick={() => handleStoreClick(store)}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                >
                  <p className="truncate text-sm font-medium text-slate-800">
                    {store.storeName}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {store.storeCategory} · {store.city}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* View All */}
          {!searchLoading && hasResults && (
            <button
              type="button"
              onClick={handleViewAllResults}
              className="mt-2 w-full border-t border-slate-100 px-3 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View all results for "{trimmedQuery}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;