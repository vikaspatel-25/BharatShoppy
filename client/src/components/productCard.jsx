import { useState } from "react";

function ProductCard({ product }) {
  const {
    productName,
    shortDescription,
    images,
    price,
    attributes,
    store,
  } = product;

  const [imageError, setImageError] = useState(false);

  const image = images?.[0];
  const minPrice = `₹${price.min.toLocaleString("en-IN")}`;

  const attributeEntries = Object.entries(attributes || {}).slice(0, 2);

  return (
    <article className="group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_5px_16px_rgba(15,23,42,0.07)]">

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
      </div>

      {/* Product Information */}
      <div className="flex flex-1 flex-col px-4 py-3.5">

        <h2 className="line-clamp-2 min-h-[44px] text-[15px] font-semibold leading-5 text-slate-900">
          {productName}
        </h2>

        {/* Store */}
        {store?.storeName && (
          <p className="mt-1 text-[11px] font-medium text-purple-700 truncate">
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

        {/* Price */}
        <div className="mt-auto pt-4">
          <p className="text-[10px] text-slate-400">From</p>

          <p className="text-[18px] font-semibold leading-5 tracking-tight text-green-800">
            {minPrice}
          </p>

          <p className="mt-1 text-[10px] text-slate-400">
            per {price.unit}
          </p>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;