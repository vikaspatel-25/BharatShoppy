import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Edit3, EyeOff, Loader2, Package, PlusCircle, Power } from "lucide-react";
import { EmptyState, FilterTabs, Modal, Notice, PageHeader, SearchInput, StatusBadge } from "@/components/panel/ui";
import { ItemThumb, PlanBanner } from "@/components/vendor/vendorParts";
import { useVendorSession } from "@/context/PanelSession";
import { useToast } from "@/context/ToastContext";
import { useVendorPlan } from "@/hooks/useVendorPlan";
import { apiFetch } from "@/lib/apiClient";
import { toMessage } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";
import { countActiveItems, formatItemPrice, getItemState, getUploadAllowance, itemWords } from "@/lib/vendorItems";

const STATE_BADGE = {
  active: { tone: "success", label: "Active" },
  inactive: { tone: "neutral", label: "Switched off" },
  hidden: { tone: "danger", label: "Hidden by BharatShopy" },
};

export default function VendorItems() {
  const { store, storeId, products, setProducts, reload } = useVendorSession();
  const { info } = useVendorPlan(storeId);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const words = itemWords(store?.entityType);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [notice, setNotice] = useState(() => location.state?.notice || null);
  const [confirmOff, setConfirmOff] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // A notice handed over from the item editor is shown once, then cleared from history,
  // so a refresh doesn't show it again.
  useEffect(() => {
    if (location.state?.notice) {
      navigate(location.pathname, { replace: true, state: null });
      scrollToTop();
    }
  }, [location.state, location.pathname, navigate]);

  // The list may have changed in another tab or by an admin; reload once on open.
  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const allowance = getUploadAllowance(store, countActiveItems(products));

  const counts = useMemo(() => {
    const c = { all: products.length, active: 0, inactive: 0, hidden: 0 };
    products.forEach((p) => {
      c[getItemState(p)] += 1;
    });
    return c;
  }, [products]);

  const q = search.trim().toLowerCase();
  const shown = products
    .filter((p) => tab === "all" || getItemState(p) === tab)
    .filter((p) => !q || `${p.productName || ""} ${p.category || ""} ${p.brand || ""}`.toLowerCase().includes(q));

  const setActive = async (product, isActive) => {
    setBusyId(product._id);
    setNotice(null);
    try {
      const res = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}/products/${encodeURIComponent(product._id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(toMessage(data, `“${product.productName}” couldn't be changed.`));
      setProducts((prev) => prev.map((p) => (p._id === product._id ? { ...p, ...(data.product || {}), isActive } : p)));
      const msg = isActive ? `“${product.productName}” is switched on and visible to customers.` : `“${product.productName}” is switched off. Customers can't see it now.`;
      setNotice({ tone: "success", message: msg });
      toast.success(msg);
      setConfirmOff(null);
    } catch (err) {
      const msg = toMessage(err);
      setNotice({ tone: "error", message: msg });
      toast.error(msg);
      setConfirmOff(null);
    } finally {
      setBusyId(null);
      scrollToTop();
    }
  };

  return (
    <>
      <PlanBanner store={store} sub={info?.subscription} />
      <PageHeader
        title={words.many === "services" ? "Services" : "Items"}
        description={`${counts.active} active of ${allowance.limit} allowed on your plan. Switched-off ${words.many} don't count.`}
        actions={
          allowance.allowed ? (
            <Link to="/vendor/items/new" className="btn btn-primary">
              <PlusCircle size={16} aria-hidden="true" /> Add {words.one}
            </Link>
          ) : null
        }
      />

      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {!allowance.allowed && products.length > 0 && (
        <Notice tone="warn" className="mb-6">
          {allowance.message}
        </Notice>
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={`No ${words.many} yet`}
          description={`Add your first ${words.one} so customers can find it and enquire on WhatsApp.`}
          action={
            allowance.allowed ? (
              <Link to="/vendor/items/new" className="btn btn-primary">
                <PlusCircle size={16} aria-hidden="true" /> Add {words.one}
              </Link>
            ) : (
              <p className="text-sm text-stone-600">{allowance.message}</p>
            )
          }
        />
      ) : (
        <>
          <FilterTabs
            label={`Filter ${words.many}`}
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "all", label: "All", count: counts.all },
              { key: "active", label: "Active", count: counts.active },
              { key: "inactive", label: "Switched off", count: counts.inactive },
              ...(counts.hidden > 0 ? [{ key: "hidden", label: "Hidden", count: counts.hidden }] : []),
            ]}
          />
          <SearchInput
            id="item-search"
            label={`Search ${words.many}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${words.many} by name or category`}
            className="mb-4 w-full sm:max-w-sm"
          />

          {shown.length === 0 ? (
            <EmptyState icon={Package} title={`No ${words.many} match`} description="Try a different search or filter." />
          ) : (
            <ul className="card divide-y divide-stone-100 overflow-hidden">
              {shown.map((item) => {
                const state = getItemState(item);
                const badge = STATE_BADGE[state];
                const busy = busyId === item._id;
                return (
                  <li key={item._id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3 sm:items-center">
                      <ItemThumb product={item} entityType={store?.entityType} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base font-medium text-stone-900" title={item.productName}>
                          {item.productName}
                        </p>
                        <p className="mt-0.5 text-sm text-stone-600">{formatItemPrice(item)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                          {item.inStock === false && <StatusBadge tone="warn">Out of stock</StatusBadge>}
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <ItemActions item={item} state={state} busy={busy} onOn={() => setActive(item, true)} onOff={() => setConfirmOff(item)} />
                      </div>
                    </div>
                    {state === "hidden" && (
                      <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                        <EyeOff size={14} className="mr-1.5 inline align-[-2px]" aria-hidden="true" />
                        The BharatShopy team hid this {words.one}
                        {item.moderation?.reason ? `: ${item.moderation.reason}` : "."} You can still edit it, but only the BharatShopy team can show it again.
                      </p>
                    )}
                    <div className="mt-3 flex gap-2 sm:hidden">
                      <ItemActions item={item} state={state} busy={busy} onOn={() => setActive(item, true)} onOff={() => setConfirmOff(item)} wide />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {confirmOff && (
        <Modal
          title={`Switch off this ${words.one}?`}
          icon={Power}
          busy={busyId === confirmOff._id}
          onClose={() => setConfirmOff(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOff(null)} disabled={busyId === confirmOff._id} className="btn btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={() => setActive(confirmOff, false)} disabled={busyId === confirmOff._id} className="btn btn-danger">
                {busyId === confirmOff._id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Power size={16} aria-hidden="true" />} Switch off
              </button>
            </div>
          }
        >
          <p className="text-sm text-stone-600">
            “<strong className="break-words text-stone-900">{confirmOff.productName}</strong>” will be hidden from your store and from search. Nothing is deleted, and you can switch it back on
            later if your plan has room.
          </p>
        </Modal>
      )}
    </>
  );
}

function ItemActions({ item, state, busy, onOn, onOff, wide = false }) {
  const grow = wide ? "flex-1" : "";
  return (
    <>
      <Link to={`/vendor/items/${encodeURIComponent(item._id)}`} className={`btn btn-secondary btn-sm ${grow}`} aria-label={`Edit ${item.productName || "item"}`}>
        <Edit3 size={15} aria-hidden="true" /> Edit
      </Link>
      {state === "inactive" ? (
        <button type="button" onClick={onOn} disabled={busy} className={`btn btn-secondary btn-sm ${grow}`} aria-label={`Switch on ${item.productName || "item"}`}>
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Power size={15} aria-hidden="true" />} Switch on
        </button>
      ) : (
        <button
          type="button"
          onClick={onOff}
          disabled={busy || state === "hidden"}
          title={state === "hidden" ? "Hidden by BharatShopy. You can't change this item's visibility." : undefined}
          className={`btn btn-ghost btn-sm ${grow}`}
          aria-label={`Switch off ${item.productName || "item"}`}
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Power size={15} aria-hidden="true" />} Switch off
        </button>
      )}
    </>
  );
}
