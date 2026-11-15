import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Package } from "lucide-react";
import { EmptyState, Field, FilterTabs, LoadingState, Modal, Notice, PageHeader, SearchInput, StatusBadge, inputClass } from "@/components/panel/ui";
import { ClampedName, EmailWarning, Pager } from "@/components/admin/adminParts";
import { ItemThumb } from "@/components/vendor/vendorParts";
import { useToast } from "@/context/ToastContext";
import { adminRequest } from "@/lib/adminApi";
import { scrollToTop } from "@/lib/scrollPanel";
import { formatItemPrice } from "@/lib/vendorItems";

const PAGE_SIZE = 25;

export default function AdminListings() {
  const { toast } = useToast();
  const [state, setState] = useState("all");
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState(null);
  const [hiding, setHiding] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Stores for the filter
  useEffect(() => {
    adminRequest("/api/admin/vendors?status=all&limit=100").then((r) => {
      if (r.ok) setStores((r.data.vendors || []).map((v) => ({ storeId: v.storeId, storeName: v.storeName || v.slug || v.storeId })).sort((a, b) => a.storeName.localeCompare(b.storeName)));
    });
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ skip: String((page - 1) * PAGE_SIZE), limit: String(PAGE_SIZE) });
    if (query) params.set("search", query);
    if (storeId) params.set("storeId", storeId);
    if (state !== "all") params.set("state", state);
    const r = await adminRequest(`/api/admin/listings?${params}`);
    if (r.ok) {
      setResult(r.data);
      setLoadError("");
    } else {
      setResult((prev) => prev || { listings: [], total: 0 });
      setLoadError(r.message);
    }
  }, [page, query, storeId, state]);

  useEffect(() => {
    load();
  }, [load]);

  const after = async (r, successText) => {
    if (r.ok) {
      setNotice({ tone: "success", message: successText, warning: r.warning });
      toast.success(successText);
    } else {
      setNotice({ tone: "error", message: r.message });
      toast.error(r.message);
    }
    scrollToTop();
    await load();
  };

  const hide = async () => {
    const text = reason.trim();
    if (text.length < 5 || text.length > 500) {
      setReasonError("Give the vendor a reason of 5 to 500 characters.");
      return;
    }
    const item = hiding;
    setBusyId(item.productId);
    const r = await adminRequest(`/api/admin/listings/${encodeURIComponent(item.productId)}/hide`, { method: "POST", body: { reason: text } });
    setBusyId(null);
    if (!r.ok && r.status === 400) {
      setReasonError(r.message);
      return;
    }
    setHiding(null);
    await after(r, `“${item.productName}” from ${item.storeName || "this store"} is hidden from customers.`);
  };

  const restore = async (item) => {
    setBusyId(item.productId);
    const r = await adminRequest(`/api/admin/listings/${encodeURIComponent(item.productId)}/restore`, { method: "POST", body: {} });
    setBusyId(null);
    await after(r, `“${item.productName}” is no longer hidden. It shows again if the vendor has it switched on.`);
  };

  const rows = result?.listings || [];
  const totalPages = result ? Math.max(1, Math.ceil((result.total || 0) / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader title="Listings" description="Hide an item that breaks the rules, with a reason the vendor sees. Admins can't add or edit items." />
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {notice?.warning && <EmailWarning className="mb-4" warning={notice.warning} />}
      {loadError && (
        <Notice tone="error" className="mb-4">
          {loadError}
        </Notice>
      )}
      <FilterTabs
        label="Moderation state"
        value={state}
        onChange={(k) => {
          setState(k);
          setPage(1);
        }}
        tabs={[
          { key: "all", label: "All" },
          { key: "visible", label: "Not hidden" },
          { key: "hidden", label: "Hidden" },
        ]}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput id="listing-search" label="Search listings" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Item or store name" className="w-full sm:max-w-sm" />
        <div className="w-full sm:max-w-xs">
          <label htmlFor="listing-store" className="sr-only">
            Store
          </label>
          <select
            id="listing-store"
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value);
              setPage(1);
            }}
            className={inputClass(false)}
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s.storeId} value={s.storeId}>
                {s.storeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {result === null ? (
        <LoadingState label="Loading listings…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} title="No listings match" description={query || storeId || state !== "all" ? "Try a different search or filter." : undefined} />
      ) : (
        <ul className="card divide-y divide-stone-100 overflow-hidden">
          {rows.map((item) => {
            const busy = busyId === item.productId;
            return (
              <li key={item.productId} className="flex flex-wrap items-start gap-3 px-4 py-4 sm:flex-nowrap sm:items-center sm:px-5">
                <ItemThumb product={{ images: item.image ? [item.image] : [], category: item.category }} entityType="shopkeeper" size="size-12" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900">
                    <ClampedName>{item.productName}</ClampedName>
                  </p>
                  <p className="text-sm text-stone-500">
                    <ClampedName>{item.storeName || item.storeId}</ClampedName>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-stone-600">{formatItemPrice(item)}</span>
                    {item.hidden ? <StatusBadge tone="danger">Hidden</StatusBadge> : <StatusBadge tone="success">Not hidden</StatusBadge>}
                    {!item.vendorActive && <StatusBadge tone="neutral">Switched off by vendor</StatusBadge>}
                  </div>
                  {item.hidden && item.moderation?.reason && <p className="mt-1 text-sm break-words text-red-800">Reason: {item.moderation.reason}</p>}
                </div>
                <div className="ml-auto shrink-0">
                  {item.hidden ? (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => restore(item)} aria-label={`Restore ${item.productName}`}>
                      {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />} Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy}
                      onClick={() => {
                        setReason("");
                        setReasonError("");
                        setHiding(item);
                      }}
                      aria-label={`Hide ${item.productName}`}
                    >
                      <EyeOff size={15} aria-hidden="true" /> Hide
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} totalPages={totalPages} onPage={setPage} total={result?.total} noun="listings" />

      {hiding && (
        <Modal
          title="Hide this listing?"
          subtitle="It disappears from the marketplace and the store straight away. The vendor is emailed the reason and can't show it again themselves."
          icon={EyeOff}
          busy={busyId === hiding.productId}
          onClose={() => setHiding(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" disabled={busyId === hiding.productId} onClick={() => setHiding(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={busyId === hiding.productId} onClick={hide}>
                {busyId === hiding.productId ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />} Hide
              </button>
            </div>
          }
        >
          <p className="text-sm font-medium break-words text-stone-900">{hiding.productName}</p>
          <p className="mb-4 text-sm break-words text-stone-500">{hiding.storeName}</p>
          <Field id="hide-reason" label="Reason for the vendor" error={reasonError} hint="5 to 500 characters.">
            <textarea
              id="hide-reason"
              data-autofocus
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? "hide-reason-error" : undefined}
              placeholder="For example, the photos show a different product."
              className={inputClass(reasonError)}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
