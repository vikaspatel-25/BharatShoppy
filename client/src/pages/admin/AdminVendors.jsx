import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarPlus, CheckCircle2, ExternalLink, Loader2, Mail, Power, ShieldAlert, Trash2, Undo2, Users } from "lucide-react";
import { DetailList, EmptyState, FilterTabs, LoadingState, Modal, Notice, PageHeader, SearchInput, StatusBadge } from "@/components/panel/ui";
import { ClampedName, CopyButton, EmailWarning, Pager, PlanChoice } from "@/components/admin/adminParts";
import { useToast } from "@/context/ToastContext";
import { adminRequest, loadPlans } from "@/lib/adminApi";
import { isValidDuration } from "@/lib/adminFormat";
import { getTenantStoreUrl } from "@/lib/domainUtils";
import { getEntityConfig } from "@/lib/entityTypes";
import { formatDisplayDate } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";

const PAGE_SIZE = 25;

function statusBadge(row) {
  if (row.computedStatus === "removal_hold") return { tone: "danger", label: `Removal hold · ${row.removalDaysLeft} ${row.removalDaysLeft === 1 ? "day" : "days"}` };
  if (row.computedStatus === "active" && row.isExpiringSoon) return { tone: "warn", label: `Ends in ${row.remainingDays} ${row.remainingDays === 1 ? "day" : "days"}` };
  if (row.computedStatus === "active") return { tone: "success", label: "Active" };
  if (row.computedStatus === "expired") return { tone: "danger", label: "Ended" };
  return { tone: "neutral", label: "No plan" };
}

export default function AdminVendors() {
  const { toast } = useToast();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  // Wait for typing to pause before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: tab, skip: String((page - 1) * PAGE_SIZE), limit: String(PAGE_SIZE) });
    if (query) params.set("search", query);
    const r = await adminRequest(`/api/admin/vendors?${params}`);
    if (r.ok) {
      setResult(r.data);
      setLoadError("");
    } else {
      setResult((prev) => prev || { vendors: [], total: 0, totals: {} });
      setLoadError(r.message);
    }
    return r;
  }, [tab, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  /** Reloads one store's row from the server after an action. Never patched locally. */
  const reloadRow = useCallback(
    async (row) => {
      const params = new URLSearchParams({ status: "all", limit: "50", search: row.slug || row.storeName || "" });
      const [one] = await Promise.all([adminRequest(`/api/admin/vendors?${params}`), load()]);
      const fresh = one.ok ? (one.data.vendors || []).find((v) => v.storeId === row.storeId) : null;
      if (fresh) setSelected(fresh);
    },
    [load]
  );

  const totals = result?.totals || {};
  const rows = result?.vendors || [];
  const totalPages = result ? Math.max(1, Math.ceil((result.total || 0) / PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader title="Vendor directory" description="Every store with its plan status. Open a store to set a plan, send a reminder or remove the vendor." />
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {loadError && (
        <Notice tone="error" className="mb-4">
          {loadError}
        </Notice>
      )}
      <FilterTabs
        label="Plan status"
        value={tab}
        onChange={(k) => {
          setTab(k);
          setPage(1);
        }}
        tabs={[
          { key: "all", label: "All", count: totals.all },
          { key: "active", label: "Active", count: totals.active },
          { key: "expiring", label: "Ending soon", count: totals.expiring },
          { key: "expired", label: "Ended", count: totals.expired },
          { key: "none", label: "No plan", count: totals.none },
          { key: "removal_hold", label: "Removal hold", count: totals.removal_hold },
        ]}
      />
      <SearchInput id="vendor-search" label="Search vendors" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Store name, web address or email" className="mb-4 w-full sm:max-w-sm" />

      {result === null ? (
        <LoadingState label="Loading vendors…" />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={query ? "No vendors match" : "No vendors here"} description={query ? "Try a different search." : undefined} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Store
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
                  Plan
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                  Items
                </th>
                <th scope="col" className="hidden px-4 py-3 font-medium lg:table-cell">
                  Ends
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => {
                const b = statusBadge(row);
                return (
                  <tr key={row.storeId} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <button type="button" className="text-left" onClick={() => setSelected(row)}>
                        <span className="block font-medium text-ocean-700 hover:underline">
                          <ClampedName>{row.storeName || row.slug || row.storeId}</ClampedName>
                        </span>
                        <span className="block text-stone-500 break-all">{row.email || "No vendor email"}</span>
                      </button>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-700 md:table-cell">{row.planName || (row.planId ? "Unknown plan" : "None")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={b.tone}>{b.label}</StatusBadge>
                    </td>
                    <td className="hidden px-4 py-3 text-stone-700 lg:table-cell">
                      {row.activeItems} of {row.itemLimit || "?"}
                    </td>
                    <td className="hidden px-4 py-3 text-stone-700 lg:table-cell">{formatDisplayDate(row.expiresAt) || "None"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={totalPages} onPage={setPage} total={result?.total} noun="stores" />

      {selected && (
        <VendorDialog
          row={selected}
          onClose={() => setSelected(null)}
          onDone={async (outcome) => {
            setNotice({ tone: outcome.ok ? "success" : "error", message: outcome.message });
            if (outcome.ok) toast.success(outcome.message);
            else toast.error(outcome.message);
            await reloadRow(selected);
          }}
        />
      )}
    </>
  );
}

function VendorDialog({ row, onClose, onDone }) {
  const [view, setView] = useState("main"); // main | plan | end | remove
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(row.planId || "");
  const [days, setDays] = useState("365");
  const [impact, setImpact] = useState(null);
  const [understood, setUnderstood] = useState(false);
  const storeUrl = getTenantStoreUrl({ subdomain: row.subdomain, slug: row.slug, _id: row.storeId });
  const b = statusBadge(row);
  const inHold = row.computedStatus === "removal_hold";
  const sid = encodeURIComponent(row.storeId);

  useEffect(() => {
    loadPlans().then((list) => {
      setPlans(list);
      setPlanId((cur) => (cur && list.some((p) => p.planId === cur) ? cur : list[0]?.planId || ""));
    });
  }, []);

  const run = async (url, body, success) => {
    setBusy(true);
    setError("");
    const r = await adminRequest(url, { method: "POST", body });
    setBusy(false);
    if (r.ok) {
      setWarning(r.warning);
      setView("main");
      await onDone({ ok: true, message: success });
    } else {
      setError(r.message);
      if (r.status === 409) await onDone({ ok: false, message: r.message });
    }
    scrollToTop();
  };

  const openRemove = async () => {
    setView("remove");
    setUnderstood(false);
    setImpact(null);
    if (!row.vendorId) return;
    const r = await adminRequest(`/api/admin/vendors/${encodeURIComponent(row.vendorId)}/removal-impact`);
    setImpact(r.ok ? r.data.impact : { error: r.message });
  };

  const chosen = plans.find((p) => p.planId === planId);
  const name = row.storeName || row.slug || row.storeId;

  let title = name;
  let content;
  let footer;
  if (view === "plan") {
    title = row.computedStatus === "active" ? "Renew or change plan" : "Set plan";
    content = (
      <div className="space-y-5">
        <PlanChoice idPrefix="dir" plans={plans} planId={planId} onPlan={setPlanId} days={days} onDays={setDays} currentExpiresAt={row.computedStatus === "active" ? row.expiresAt : null} />
      </div>
    );
    footer = (
      <DialogButtons
        busy={busy}
        onBack={() => setView("main")}
        confirmLabel={chosen ? `Activate ${chosen.name}` : "Activate"}
        confirmIcon={CalendarPlus}
        disabled={!chosen || !isValidDuration(days)}
        onConfirm={() =>
          run(`/api/admin/store/${sid}/renew`, { planId, durationDays: Number(days) }, `${name} is on ${chosen?.name} for ${days} more days.`)
        }
      />
    );
  } else if (view === "end") {
    title = "End this plan now?";
    content = (
      <p className="text-sm text-stone-600">
        <strong className="text-stone-900">{name}</strong>'s plan ends straight away. The store page stays visible with its WhatsApp number, but its items are hidden until the plan is set again.
        Nothing is deleted, and the vendor is emailed.
      </p>
    );
    footer = <DialogButtons busy={busy} onBack={() => setView("main")} danger confirmLabel="End plan now" confirmIcon={Power} onConfirm={() => run(`/api/admin/store/${sid}/discontinue`, {}, `${name}'s plan has ended.`)} />;
  } else if (view === "remove") {
    title = "Remove this vendor?";
    content = (
      <div className="space-y-4 text-sm text-stone-600">
        {!row.vendorId ? (
          <Notice tone="warn">This store has no vendor account, so it can't be removed from here.</Notice>
        ) : impact === null ? (
          <LoadingState label="Working out what would be deleted…" />
        ) : impact.error ? (
          <Notice tone="error">{impact.error}</Notice>
        ) : (
          <>
            <p>
              <strong className="text-stone-900">{name}</strong> is hidden from customers straight away. After a <strong className="text-stone-900">7-day hold</strong>, the vendor's profile, the
              store, its <strong className="text-stone-900">{impact.items}</strong> {impact.items === 1 ? "item" : "items"} and <strong className="text-stone-900">{impact.photos}</strong>{" "}
              {impact.photos === 1 ? "photo" : "photos"} are deleted for good. You can cancel the removal during the hold.
            </p>
            <label className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
              <input type="checkbox" className="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>I understand this store is deleted permanently after the 7-day hold unless I cancel it.</span>
            </label>
          </>
        )}
      </div>
    );
    footer = (
      <DialogButtons
        busy={busy}
        onBack={() => setView("main")}
        danger
        confirmLabel="Remove vendor"
        confirmIcon={Trash2}
        disabled={!row.vendorId || !understood || !impact || impact.error}
        onConfirm={() => run(`/api/admin/vendors/${encodeURIComponent(row.vendorId)}/remove`, {}, `${name} is in the 7-day removal hold and hidden from customers.`)}
      />
    );
  } else {
    content = (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={b.tone}>{b.label}</StatusBadge>
          <a href={storeUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm break-all">
            {storeUrl} <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
        <DetailList
          rows={[
            ["Plan", row.planName || (row.planId ? "Unknown plan" : "None")],
            ["Plan ends", formatDisplayDate(row.expiresAt)],
            ["Items", `${row.activeItems} active of ${row.itemLimit || "?"} allowed`],
            ["Removal date", inHold ? formatDisplayDate(row.deleteAfter) : ""],
            ["Vendor", row.vendorName],
            [
              "Email",
              row.email && (
                <span key="value" className="inline-flex items-center gap-1">
                  {row.email} <CopyButton value={row.email} label="email" />
                </span>
              ),
            ],
            [
              "Phone",
              row.phone && (
                <span key="value" className="inline-flex items-center gap-1">
                  {row.phone} <CopyButton value={row.phone} label="phone number" />
                </span>
              ),
            ],
            [
              "WhatsApp",
              row.whatsapp && (
                <span key="value" className="inline-flex items-center gap-1">
                  {row.whatsapp} <CopyButton value={row.whatsapp} label="WhatsApp number" />
                </span>
              ),
            ],
            ["Seller type", row.entityType ? getEntityConfig(row.entityType).label : ""],
            ["City", row.city],
          ]}
        />
        {inHold ? (
          <div className="grid gap-2">
            <button
              type="button"
              className="btn btn-secondary justify-start"
              disabled={busy || !row.vendorId}
              onClick={() => run(`/api/admin/vendors/${encodeURIComponent(row.vendorId)}/cancel-removal`, {}, `Removal of ${name} is cancelled. Its items are back as they were.`)}
            >
              <Undo2 size={16} aria-hidden="true" /> Cancel removal
            </button>
            <p className="text-sm text-stone-500">A store in the removal hold can't have its plan changed.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-primary justify-start" disabled={busy} onClick={() => setView("plan")}>
              <CalendarPlus size={16} aria-hidden="true" /> {row.computedStatus === "active" ? "Renew or change plan" : "Set plan"}
            </button>
            <button
              type="button"
              className="btn btn-secondary justify-start"
              disabled={busy || !row.email}
              onClick={() => run(`/api/admin/store/${sid}/send-renewal-reminder`, {}, `Renewal reminder sent to ${row.email}.`)}
            >
              <BellRing size={16} aria-hidden="true" /> Send renewal reminder
            </button>
            <button
              type="button"
              className="btn btn-secondary justify-start"
              disabled={busy || !row.email || !row.planId}
              onClick={() => run(`/api/admin/store/${sid}/resend-subscription-email`, {}, `The last plan email was sent again to ${row.email}.`)}
            >
              <Mail size={16} aria-hidden="true" /> Resend last plan email
            </button>
            <button type="button" className="btn btn-secondary justify-start" disabled={busy || row.computedStatus !== "active"} onClick={() => setView("end")}>
              <Power size={16} aria-hidden="true" /> End plan now
            </button>
            <button type="button" className="btn btn-ghost justify-start text-red-700 sm:col-span-2" disabled={busy} onClick={openRemove}>
              <ShieldAlert size={16} aria-hidden="true" /> Remove vendor
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Modal title={title} subtitle={view === "main" ? undefined : name} size="lg" busy={busy} onClose={onClose} footer={footer}>
      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {warning && <EmailWarning className="mb-4" warning={warning} onResend={row.email ? () => run(`/api/admin/store/${sid}/resend-subscription-email`, {}, `Email sent again to ${row.email}.`) : null} />}
      {busy && view === "main" && <LoadingState label="Working…" />}
      {!(busy && view === "main") && content}
    </Modal>
  );
}

function DialogButtons({ busy, onBack, onConfirm, confirmLabel, confirmIcon: Icon, danger = false, disabled = false }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>
        Back
      </button>
      <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} disabled={busy || disabled} onClick={onConfirm}>
        {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />} {confirmLabel}
      </button>
    </div>
  );
}
