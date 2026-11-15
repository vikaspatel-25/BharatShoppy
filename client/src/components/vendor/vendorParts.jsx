import { Link } from "react-router-dom";
import { AlertTriangle, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import { Notice } from "@/components/panel/ui";
import { formatDisplayDate } from "@/lib/formatDate";
import { getProductFallbackImage, handleImgError } from "@/lib/imageFallback";

/**
 * The one banner a vendor most needs to see about their plan, with one action.
 * Removal hold wins over an ended plan, which wins over a plan ending soon.
 */
export function PlanBanner({ store, sub, className = "mb-6" }) {
  if (store?.removalStatus === "pending_deletion") {
    const ends = formatDisplayDate(store.deleteAfter);
    return (
      <Notice tone="error" icon={ShieldAlert} className={className}>
        <strong>Your store is being removed.</strong> Your items are hidden from customers
        {ends ? ` and the store will be deleted on ${ends}` : ""}. If you think this is a mistake, contact the BharatShopy team before then.
      </Notice>
    );
  }
  if (!sub) return null;
  if (sub.computedStatus === "expired") {
    return (
      <Notice tone="error" icon={Clock} className={className}>
        <BannerRow to="/vendor/plan" cta="Renew plan">
          <strong>Your plan has ended.</strong> Customers can still see your store and WhatsApp number, but your items are hidden until you renew.
        </BannerRow>
      </Notice>
    );
  }
  if (sub.computedStatus === "active" && sub.isExpiringSoon) {
    return (
      <Notice tone="warn" icon={AlertTriangle} className={className}>
        <BannerRow to="/vendor/plan" cta="Renew plan">
          <strong>
            Your plan ends in {sub.remainingDays} {sub.remainingDays === 1 ? "day" : "days"}
            {sub.expiresAt ? `, on ${formatDisplayDate(sub.expiresAt)}` : ""}.
          </strong>{" "}
          Renew it to keep your items visible.
        </BannerRow>
      </Notice>
    );
  }
  return null;
}

function BannerRow({ to, cta, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span>{children}</span>
      <Link to={to} className="btn btn-secondary btn-sm">
        {cta}
      </Link>
    </div>
  );
}

/** Item photo with the entity fallback when it is missing or fails to load. */
export function ItemThumb({ product, entityType, size = "size-14" }) {
  const fallback = getProductFallbackImage(entityType, product?.category);
  const src = (Array.isArray(product?.images) && product.images.find((u) => typeof u === "string" && u)) || fallback;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-lg border border-stone-200 bg-stone-100 object-cover`}
      onError={(e) => handleImgError(e, fallback)}
    />
  );
}

/** A card of quick links. links: [{ to, icon, label, hint }] */
export function LinkPanel({ title, links }) {
  return (
    <section className="card" aria-label={title}>
      <h2 className="border-b border-stone-100 px-5 py-4 text-base font-semibold">{title}</h2>
      <ul className="divide-y divide-stone-100">
        {links.map(({ to, icon: Icon, label, hint }) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-stone-50">
              {Icon && <Icon size={18} className="shrink-0 text-stone-500" aria-hidden="true" />}
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-stone-900">{label}</span>
                {hint && <span className="block text-stone-500">{hint}</span>}
              </span>
              <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
