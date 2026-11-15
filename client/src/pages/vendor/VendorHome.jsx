import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Copy, CreditCard, EyeOff, Package, PackageX, PlusCircle, QrCode, Store } from "lucide-react";
import { Notice, PageHeader, StatCard, StatusBadge, UsageBar } from "@/components/panel/ui";
import { LinkPanel, PlanBanner } from "@/components/vendor/vendorParts";
import StoreQrModal from "@/components/store/storeQrModal";
import { useVendorSession } from "@/context/PanelSession";
import { useToast } from "@/context/ToastContext";
import { planStatusBadge, useVendorPlan } from "@/hooks/useVendorPlan";
import { getTenantStoreUrl } from "@/lib/domainUtils";
import { formatDisplayDate } from "@/lib/formatDate";
import { countActiveItems, getGettingStarted, getItemState, getUploadAllowance, itemWords } from "@/lib/vendorItems";

const SHARED_KEY = "bs-vendor-shared-link";

function readShared(storeId) {
  try {
    return window.localStorage.getItem(SHARED_KEY) === String(storeId);
  } catch {
    return false;
  }
}

function rememberShared(storeId) {
  try {
    window.localStorage.setItem(SHARED_KEY, String(storeId));
  } catch {
    // Storage can be blocked; the checklist step then just stays open.
  }
}

export default function VendorHome() {
  const { store, storeId, products } = useVendorSession();
  const { info, loading, error } = useVendorPlan(storeId);
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [shared, setShared] = useState(() => readShared(storeId));

  const words = itemWords(store?.entityType);
  const sub = info?.subscription;
  const active = countActiveItems(products);
  const hidden = products.filter((p) => getItemState(p) === "hidden").length;
  const inactive = products.length - active;
  const allowance = getUploadAllowance(store, active);
  const storeUrl = getTenantStoreUrl(store);
  const badge = planStatusBadge(sub);
  const start = getGettingStarted(store, products, { shared });

  const markShared = () => {
    rememberShared(storeId);
    setShared(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      markShared();
      toast.success("Store link copied.");
    } catch {
      toast.error("The link couldn't be copied. Select it and copy it yourself.");
    }
  };

  return (
    <>
      <PlanBanner store={store} sub={sub} />
      {error && (
        <Notice tone="error" className="mb-6">
          {error}
        </Notice>
      )}

      <PageHeader
        title={store?.storeName || "Dashboard"}
        description="Your items, your plan and your store link."
        actions={
          allowance.allowed ? (
            <Link to="/vendor/items/new" className="btn btn-primary">
              <PlusCircle size={16} aria-hidden="true" /> Add {words.one}
            </Link>
          ) : null
        }
      />

      {!start.complete && (
        <section className="card mb-6 p-5 sm:p-6" aria-labelledby="start-title">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="start-title" className="text-base font-semibold">
              Get your store ready
            </h2>
            <p className="text-sm text-stone-500">
              {start.done} of {start.steps.length} done
            </p>
          </div>
          <ol className="space-y-3">
            {start.steps.map((step) => (
              <li key={step.key} className="flex items-start gap-3">
                {step.done ? (
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Circle size={20} className="mt-0.5 shrink-0 text-stone-300" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? "text-stone-500 line-through" : "text-stone-900"}`}>
                    {step.label}
                    <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
                  </p>
                  {!step.done && <p className="text-sm text-stone-500">{step.hint}</p>}
                </div>
                {!step.done &&
                  (step.to ? (
                    <Link to={step.to} className="btn btn-secondary btn-sm shrink-0">
                      Start
                    </Link>
                  ) : (
                    <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm shrink-0">
                      Copy link
                    </button>
                  ))}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={`Active ${words.many}`} value={active} icon={Package} />
        <StatCard label={`Switched off`} value={inactive} icon={PackageX} />
        {hidden > 0 && <StatCard label="Hidden by BharatShopy" value={hidden} icon={EyeOff} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="plan-title">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="plan-title" className="text-base font-semibold">
                Your plan
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {loading ? "Loading…" : sub?.planName || (sub?.plan ? "Plan details unavailable" : "No plan yet")}
              </p>
              {sub?.expiresAt && (
                <p className="text-sm text-stone-500">
                  {sub.computedStatus === "active" ? "Ends on" : "Ended on"} {formatDisplayDate(sub.expiresAt)}
                </p>
              )}
            </div>
            {!loading && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
          </div>
          <UsageBar label={`Active ${words.many}`} used={active} limit={allowance.limit} />
          <Link to="/vendor/plan" className="link mt-4 inline-block text-sm">
            See plans and usage
          </Link>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="link-title">
          <h2 id="link-title" className="text-base font-semibold">
            Your store link
          </h2>
          <p className="mt-1 text-sm text-stone-500">Share it with customers, or print the QR code for your counter.</p>
          <p className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 font-mono text-sm break-all text-stone-800">{storeUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm">
              <Copy size={15} aria-hidden="true" /> Copy link
            </button>
            <button
              type="button"
              onClick={() => {
                markShared();
                setQrOpen(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              <QrCode size={15} aria-hidden="true" /> QR code
            </button>
            <a href={storeUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              Open store
            </a>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <LinkPanel
          title="Catalogue"
          links={[
            { to: "/vendor/items/new", icon: PlusCircle, label: `Add ${words.one === "service" ? "a service" : "an item"}` },
            { to: "/vendor/items", icon: Package, label: `Manage ${words.many}`, hint: "Edit, switch on or switch off" },
          ]}
        />
        <LinkPanel
          title="Account"
          links={[
            { to: "/vendor/store", icon: Store, label: "Store profile", hint: "Name, contact numbers and address" },
            { to: "/vendor/plan", icon: CreditCard, label: "Plan and usage", hint: "Renew or change your plan" },
          ]}
        />
      </div>

      {store && <StoreQrModal store={store} isOpen={qrOpen} onClose={() => setQrOpen(false)} />}
    </>
  );
}
