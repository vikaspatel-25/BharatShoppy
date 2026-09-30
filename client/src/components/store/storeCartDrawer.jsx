import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Trash2,
  Phone,
  Copy,
  Check,
  ShoppingBag,
  MessageSquare,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { buildEnquiryMessage } from "@/hooks/useStoreCart";

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

function StoreCartDrawer({
  isOpen,
  onClose,
  store,
  cart,
  onUpdateQuantity,
  onRemove,
  onClearCart,
  totalCount,
  totalEstimatedPrice,
  onSendWhatsApp,
}) {
  const [userNote, setUserNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasItems = cart.length > 0;
  const whatsappNumber = store?.contact?.whatsapp;
  const phoneNumber = store?.contact?.phone;

  function handleCopyMessage() {
    const message = buildEnquiryMessage(store, cart, userNote);
    if (!message) return;
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function handleSendEnquiry() {
    onSendWhatsApp(store, userNote);
  }

  function handleCallStore() {
    if (!phoneNumber) return;
    window.location.href = `tel:${phoneNumber}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <aside
        className="relative z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 animate-in slide-in-from-right sm:max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-label="Shop Enquiry Bag"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Shop Enquiry Bag
              </h2>
              <p className="truncate text-xs text-slate-500 max-w-[240px]">
                {store?.storeName || "Store"} · {totalCount} item{totalCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasItems && (
              <button
                type="button"
                onClick={onClearCart}
                className="text-xs font-medium text-slate-400 hover:text-red-600 transition-colors px-2 py-1"
                title="Clear enquiry bag"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close enquiry bag"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {!hasItems ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ShoppingBag className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-800">
                Your enquiry bag is empty
              </h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                Explore products in {store?.storeName} and tap &ldquo;+ Enquire&rdquo; to add items and request pricing or availability in one message.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 rounded-xl bg-[#0f2747] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#16365f] transition-colors"
              >
                Browse Shop Products
              </button>
            </div>
          ) : (
            <>
              {/* Informative banner */}
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-900">
                <Sparkles className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <p className="leading-5">
                  Select your items and click <strong>&ldquo;Send WhatsApp Enquiry&rdquo;</strong> to contact <strong>{store?.storeName}</strong> directly with a structured summary!
                </p>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Selected Items ({cart.length})
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {cart.map(({ product, quantity }) => {
                    const minPrice = product.price?.min || 0;
                    const unit = product.price?.unit || "piece";
                    const itemSubtotal = minPrice * quantity;
                    const image = product.images?.[0];

                    return (
                      <div
                        key={product._id}
                        className="flex gap-3.5 p-3.5 sm:gap-4 items-center"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                          {image ? (
                            <img
                              src={image}
                              alt={product.productName}
                              className="h-full w-full object-contain p-1"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  "/assets/images/placeholders/productPlaceholder.jpeg";
                              }}
                            />
                          ) : (
                            <img
                              src="/assets/images/placeholders/productPlaceholder.jpeg"
                              alt="Placeholder"
                              className="h-full w-full object-contain p-1"
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex flex-1 flex-col min-w-0">
                          <h4 className="line-clamp-1 text-sm font-semibold text-slate-800">
                            {product.productName}
                          </h4>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                            {minPrice > 0 ? (
                              <span className="font-medium text-emerald-700">
                                ₹{minPrice.toLocaleString("en-IN")}
                              </span>
                            ) : (
                              <span>Price on request</span>
                            )}
                            <span className="text-slate-300">·</span>
                            <span>per {unit}</span>
                          </div>

                          {/* Stepper + Item Subtotal */}
                          <div className="mt-2.5 flex items-center justify-between">
                            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateQuantity(product._id, quantity - 1)
                                }
                                aria-label="Decrease quantity"
                                className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded-l-lg transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-semibold text-slate-800">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateQuantity(product._id, quantity + 1)
                                }
                                aria-label="Increase quantity"
                                className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded-r-lg transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {minPrice > 0 && (
                                <span className="text-xs font-semibold text-slate-700">
                                  ₹{itemSubtotal.toLocaleString("en-IN")}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemove(product._id)}
                                aria-label="Remove item"
                                className="flex h-7 w-7 items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Buyer Note */}
              <div className="space-y-1.5">
                <label
                  htmlFor="enquiryNote"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Custom Request or Note for Store (Optional)
                </label>
                <textarea
                  id="enquiryNote"
                  rows={2}
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder="e.g. Any special size/color requirement, preferred pickup time, or home delivery query..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </div>

              {/* Message Structure Preview Toggle */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex w-full items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    Preview Structured Message
                  </span>
                  <span className="text-[11px] text-blue-600 font-semibold">
                    {showPreview ? "Hide" : "Show"}
                  </span>
                </button>

                {showPreview && (
                  <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700 border border-slate-200">
                    {buildEnquiryMessage(store, cart, userNote)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer with Actions */}
        {hasItems && (
          <div className="border-t border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            {/* Price Estimation Row */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  Total Estimated Value ({totalCount} items)
                </p>
                <p className="text-[10px] text-slate-400">
                  *Final price & store discounts confirmed via chat
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-900">
                  {totalEstimatedPrice > 0
                    ? `₹${totalEstimatedPrice.toLocaleString("en-IN")}`
                    : "On Request"}
                </span>
              </div>
            </div>

            {/* Primary Action: Send WhatsApp */}
            {whatsappNumber ? (
              <button
                type="button"
                onClick={handleSendEnquiry}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-[#20bd5a] hover:shadow-lg active:scale-[0.99]"
              >
                <WhatsAppIcon className="h-5 w-5" />
                <span>Send WhatsApp Enquiry</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>WhatsApp number not registered for this store. You can call directly or copy the enquiry text below.</span>
              </div>
            )}

            {/* Secondary Actions: Call & Copy */}
            <div className="flex items-center gap-2 pt-1">
              {phoneNumber && (
                <button
                  type="button"
                  onClick={handleCallStore}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call Store</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyMessage}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default StoreCartDrawer;
