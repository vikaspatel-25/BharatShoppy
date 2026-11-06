import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  X,
  QrCode,
  Download,
  Copy,
  Check,
  Share2,
} from "lucide-react";
import { getTenantStoreUrl } from "@/lib/domainUtils";
import { getEntityConfig } from "@/lib/entityTypes";

export default function StoreQrModal({ store, isOpen, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const entityConfig = getEntityConfig(store?.entityType);
  const storeUrl = store ? getTenantStoreUrl(store) : "";

  useEffect(() => {
    if (!isOpen || !storeUrl) return;

    let isMounted = true;

    QRCode.toDataURL(storeUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to generate QR Code:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, storeUrl]);

  if (!isOpen || !store) return null;

  const handleCopy = () => {
    if (!storeUrl) return;
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `${store.slug || "store"}-qr-code.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleWhatsAppShare = () => {
    if (!storeUrl) return;
    const text = `Visit *${store.storeName}* on BharatShopy: ${storeUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-700">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-base leading-tight">
                Storefront QR & Direct Link
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Scan to open dedicated store directly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center space-y-4">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border ${entityConfig.badgeClass} mb-2`}
            >
              {entityConfig.badgeLabel}
            </span>
            <h4 className="text-lg font-bold text-stone-900">{store.storeName}</h4>
            <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
              {[store.address?.area, store.city].filter(Boolean).join(", ")}
            </p>
          </div>

          {/* QR Code Container */}
          <div className="mx-auto w-64 h-64 bg-stone-50 p-3 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center shadow-inner">
            {loading ? (
              <div className="animate-pulse text-stone-400 text-xs">
                Generating QR Code...
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${store.storeName}`}
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <p className="text-xs text-red-500">Failed to render QR Code</p>
            )}
          </div>

          {/* Direct URL Display */}
          <div className="flex items-center justify-between gap-2 p-2.5 bg-stone-50 rounded-xl border border-stone-200 text-left">
            <span className="text-xs font-mono text-stone-700 truncate select-all">
              {storeUrl}
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700 px-2 py-1 rounded hover:bg-orange-50 shrink-0 transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 transition active:scale-95 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download QR Sign
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition active:scale-95 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Share WhatsApp
            </button>
          </div>

          <p className="text-[11px] text-stone-400">
            Print this QR code for store counters, packaging, or market crates.
          </p>
        </div>
      </div>
    </div>
  );
}
