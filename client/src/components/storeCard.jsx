import { MapPin } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function StoreCard({ store }) {
  const navigate = useNavigate();

  const {
    _id,
    storeName,
    logo,
    storeCategory,
    city,
    address,
  } = store;

  const [imageError, setImageError] = useState(false);

  function handleClick() {
    navigate(`/store/${_id}`);
  }

  return (
    <article
      onClick={handleClick}
      className="group flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
    >
      {/* Store Image */}
      <div className="relative flex h-32 sm:h-44 w-full items-center justify-center overflow-hidden bg-slate-50">
        {logo && !imageError ? (
          <img
            src={logo}
            alt={storeName}
            onError={() => setImageError(true)}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <img
            src="/assets/images/placeholders/storePlaceholder.jpeg"
            alt="Store image unavailable"
            className="h-full w-full object-contain p-2"
          />
        )}
      </div>

      {/* Store Information */}
      <div className="relative flex flex-1 flex-col p-2.5 sm:p-3.5">
        {/* Category */}
        {storeCategory && (
          <span className="w-fit rounded-md bg-blue-50 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.06em] text-blue-600">
            {storeCategory}
          </span>
        )}

        {/* Store Name */}
        <h2 className="mt-1.5 line-clamp-2 min-h-[34px] sm:min-h-[40px] text-xs sm:text-[15px] font-semibold leading-4 sm:leading-5 text-slate-800 transition-colors group-hover:text-blue-700">
          {storeName}
        </h2>

        {/* Location */}
        <div className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] sm:text-[11px] text-slate-500">
          <MapPin
            className="h-3 w-3 shrink-0 text-slate-400"
            strokeWidth={1.8}
          />

          <p className="truncate">
            {city}
            {address?.area ? ` · ${address.area}` : ""}
          </p>
        </div>

        {/* Hover Accent */}
        <div className="absolute bottom-0 left-3 right-3 sm:left-4 sm:right-4 h-[2px] origin-left scale-x-0 rounded-full bg-blue-500 transition-transform duration-200 group-hover:scale-x-100" />
      </div>
    </article>
  );
}

export default StoreCard;