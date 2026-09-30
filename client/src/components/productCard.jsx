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
      <div className="relative flex h-[180px] min-h-[180px] items-center justify-center overflow-hidden bg-slate-50">
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
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            <Check className="h-3 w-3" />
            <span>{cartQuantity} in bag</span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col px-4 py-3.5">
        <h2 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-5 text-slate-900">
          {productName}
        </h2>

        {/* Store */}
        {store?.storeName && (
          <p className="mt-1 truncate text-[11px] font-medium text-purple-700">
            {store.storeName}
          </p>
        )}

        <p className="mt-1.5 line-clamp-2 min-h-[40px] text-[12px] leading-5 text-slate-500">
          {shortDescription}
        </p>

        {attributeEntries.length > 0 && (
          <div className="mt-3 flex min-h-[24px] gap-1.5">
            {attributeEntries.map(([key, value]) => (
              <span
                key={key}
                className="max-w-[50%] truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600"
              >
                <span className="font-medium">{key}</span>
                {" · "}
                {value}
              </span>
            ))}
          </div>
        )}

        {/* Price & Action */}
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] text-slate-400">
                From
              </p>

              <p className="text-[18px] font-semibold leading-5 tracking-tight text-green-800">
                {minPrice}
              </p>

              <p className="mt-1 text-[10px] text-slate-400">
                per {price?.unit || "piece"}
              </p>
            </div>

            {showCartAction && (
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                {cartQuantity === 0 ? (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="flex h-8 items-center gap-1 rounded-lg border border-slate-900 bg-white px-2.5 text-xs font-semibold text-slate-900 shadow-xs transition-all hover:bg-slate-900 hover:text-white active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Enquire
                  </button>
                ) : (
                  <div className="flex h-8 items-center rounded-lg border border-slate-300 bg-slate-50 p-0.5 shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      aria-label="Decrease quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold text-slate-900">
                      {cartQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      aria-label="Increase quantity"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-700 hover:bg-white transition-colors"
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