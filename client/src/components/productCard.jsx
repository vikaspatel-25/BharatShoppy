import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Minus, Check } from "lucide-react";

function ProductCard({
  product,
  showCartAction = false,
  cartQuantity = 0,
  onAddToCart,
  onUpdateQuantity,
}) {
  const navigate = useNavigate();

  const {
    _id,
    productName,
    shortDescription,
    images,
    price,
    attributes,
    store,
  } = product;

  const [imageError, setImageError] = useState(false);

  const image = images?.[0];
  const minPrice = `₹${price?.min != null ? price.min.toLocaleString("en-IN") : "0"}`;

  const attributeEntries = Object.entries(attributes || {}).slice(0, 2);

  function handleClick() {
    navigate(`/product/${_id}`);
  }

  function handleAdd(e) {
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
    }
  }

  function handleDecrement(e) {
    e.stopPropagation();
    if (onUpdateQuantity) {
      onUpdateQuantity(_id, cartQuantity - 1);
    }
  }

  function handleIncrement(e) {
    e.stopPropagation();
    if (onUpdateQuantity) {
      onUpdateQuantity(_id, cartQuantity + 1);
    }
  }

  return (
    <article
      onClick={handleClick}
      className="group relative flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_5px_16px_rgba(15,23,42,0.07)]"
    >
      {/* Product Image */}
      <div className="relative flex h-36 sm:h-44 w-full items-center justify-center overflow-hidden bg-slate-50">
        {image && !imageError ? (
          <img
            src={image}
            alt={productName}
            onError={() => setImageError(true)}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <img
            src="/assets/images/placeholders/productPlaceholder.jpeg"
            alt="Product image unavailable"
            className="h-full w-full object-contain p-2"
          />
        )}

        {showCartAction && cartQuantity > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-white shadow-sm">
            <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            <span>{cartQuantity} in bag</span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <h2 className="line-clamp-2 min-h-[34px] sm:min-h-[44px] text-xs sm:text-[15px] font-semibold leading-4 sm:leading-5 text-slate-900">
          {productName}
        </h2>

        {/* Store */}
        {store?.storeName && (
          <p className="mt-0.5 sm:mt-1 truncate text-[10px] sm:text-[11px] font-medium text-purple-700">
            {store.storeName}
          </p>
        )}

        <p className="mt-1 line-clamp-2 min-h-[28px] sm:min-h-[36px] text-[11px] sm:text-[12px] leading-4 sm:leading-5 text-slate-500">
          {shortDescription}
        </p>

        {attributeEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {attributeEntries.map(([key, value], idx) => (
              <span
                key={key}
                className={`max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] sm:text-[10px] text-slate-600 ${
                  idx > 0 ? "hidden sm:inline-flex" : "inline-flex"
                }`}
              >
                <span className="font-medium">{key}</span>: {value}
              </span>
            ))}
          </div>
        )}

        {/* Price & Action */}
        <div className="mt-auto pt-2.5 sm:pt-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-slate-400">
                From
              </p>

              <p className="text-base sm:text-lg font-bold leading-tight tracking-tight text-emerald-800">
                {minPrice}
              </p>

              <p className="text-[9px] sm:text-[10px] text-slate-400">
                per {price?.unit || "piece"}
              </p>
            </div>

            {showCartAction && (
              <div className="w-full sm:w-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                {cartQuantity === 0 ? (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex h-7 sm:h-8 w-full sm:w-auto items-center justify-center gap-1 rounded-lg border border-slate-900 bg-white px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold text-slate-900 shadow-xs transition-all hover:bg-slate-900 hover:text-white active:scale-95"
                  >
                    <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span>Enquire</span>
                  </button>
                ) : (
                  <div className="flex h-7 sm:h-8 w-full sm:w-auto items-center justify-between sm:justify-start rounded-lg border border-slate-300 bg-slate-50 p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      aria-label="Decrease quantity"
                      className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[20px] px-1 text-center text-xs font-semibold text-slate-900">
                      {cartQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      aria-label="Increase quantity"
                      className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;