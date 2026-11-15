import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Layers, Loader2, XCircle } from "lucide-react";
import { DetailList, EmptyState, Field, FilterTabs, LoadingState, Modal, Notice, PageHeader, SearchInput, StatusBadge, inputClass } from "@/components/panel/ui";
import { ClampedName, CopyButton, EmailWarning, PlanChoice } from "@/components/admin/adminParts";
import { useToast } from "@/context/ToastContext";
import { adminRequest } from "@/lib/adminApi";
import { isValidDuration } from "@/lib/adminFormat";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";
import { formatRupees } from "@/lib/vendorItems";

const STATUS_BADGE = {
  pending: { tone: "warn", label: "Waiting" },
  approved: { tone: "success", label: "Activated" },
  rejected: { tone: "danger", label: "Declined" },
};

export default function AdminPlanRequests() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null);
  const [dialog, setDialog] = useState(null); // { mode: "approve" | "reject", request }

  const load = useCallback(async () => {
    const r = await adminRequest("/api/admin/subscription-requests");
    if (r.ok) {
      setData(r.data);
      setLoadError("");
    } else {
      setData((prev) => prev || { requests: [], counts: {} });
      setLoadError(r.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDone = async (outcome) => {
    setNotice(outcome);
    if (outcome.tone === "error") toast.error(outcome.message);
    else toast.success(outcome.message);
    setDialog(null);
    scrollToTop();
    await load();
  };

  const resend = async (storeId) => {
    const r = await adminRequest(`/api/admin/store/${encodeURIComponent(storeId)}/resend-subscription-email`, { method: "POST", body: {} });
    if (r.ok) {
      setNotice((n) => ({ ...n, warning: "" }));
      toast.success("Email sent again.");
    } else toast.error(r.message);
  };

  const counts = data?.counts || {};
  const q = search.trim().toLowerCase();
  const shown = (data?.requests || []).filter(
    (r) => (tab === "all" || r.status === tab) && (!q || [r.storeName, r.vendorEmail, r.planName].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  );

  return (
    <>
      <PageHeader title="Plan requests" description="Vendors ask for a plan here, then pay the team directly. Activate a request once payment is confirmed." />
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {notice?.warning && <EmailWarning className="mb-4" warning={notice.warning} onResend={() => resend(notice.storeId)} />}
      {loadError && (
        <Notice tone="error" className="mb-4">
          {loadError}
        </Notice>
      )}
      <FilterTabs
        label="Request status"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Waiting", count: counts.pending },
          { key: "approved", label: "Activated", count: counts.approved },
          { key: "rejected", label: "Declined", count: counts.rejected },
          { key: "all", label: "All", count: counts.total },
        ]}
      />
      <SearchInput id="req-search" label="Search plan requests" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Store, email or plan" className="mb-4 w-full sm:max-w-sm" />

      {data === null ? (
        <LoadingState label="Loading plan requests…" />
      ) : shown.length === 0 ? (
        <EmptyState icon={Layers} title={q ? "No requests match" : tab === "pending" ? "Nothing waiting" : "No requests here"} />
      ) : (
        <ul className="space-y-4">
          {shown.map((r) => {
            const b = STATUS_BADGE[r.status] || { tone: "neutral", label: r.status };
            return (
              <li key={r.requestId} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold">
                      <ClampedName>{r.storeName || r.storeId}</ClampedName>
                    </h2>
                    <p className="text-sm text-stone-600">
                      {r.planName || "Unknown plan"} · {formatRupees(r.amount)}
                    </p>
                  </div>
                  <StatusBadge tone={b.tone}>{b.label}</StatusBadge>
                </div>
                <div className="mt-4">
                  <DetailList
                    rows={[
                      [
                        "Vendor email",
                        r.vendorEmail && (
                          <span key="value" className="inline-flex items-center gap-1">
                            {r.vendorEmail} <CopyButton value={r.vendorEmail} label="email" />
                          </span>
                        ),
                      ],
                      ["Sent", formatDisplayDateTime(r.createdAt)],
                      ["Vendor's note", r.vendorNote],
                      ["Decided", r.verifiedAt ? formatDisplayDateTime(r.verifiedAt) : ""],
                      ["Days added", r.status === "approved" && r.durationDays ? String(r.durationDays) : ""],
                      ["New end date", r.status === "approved" ? formatDisplayDate(r.activatedExpiresAt) : ""],
                      ["Reason", r.status === "rejected" ? r.rejectionReason : ""],
                    ]}
                  />
                </div>
                {r.status === "pending" && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn btn-secondary" onClick={() => setDialog({ mode: "reject", request: r })}>
                      <XCircle size={16} aria-hidden="true" /> Decline
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setDialog({ mode: "approve", request: r })}>
                      <CalendarPlus size={16} aria-hidden="true" /> Activate
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {dialog && <RequestDialog key={dialog.request.requestId} {...dialog} onClose={() => setDialog(null)} onDone={onDone} />}
    </>
  );
}

function RequestDialog({ mode, request, onClose, onDone }) {
  const [days, setDays] = useState("365");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentExpiry, setCurrentExpiry] = useState(undefined);
  const approve = mode === "approve";

  // The new end date extends from the store's current end date, so look it up
  useEffect(() => {
    if (!approve) return;
    const params = new URLSearchParams({ status: "all", limit: "50", search: request.storeName || "" });
    adminRequest(`/api/admin/vendors?${params}`).then((r) => {
      const row = r.ok ? (r.data.vendors || []).find((v) => v.storeId === request.storeId) : null;
      setCurrentExpiry(row ? row.expiresAt || null : null);
    });
  }, [approve, request.storeId, request.storeName]);

  const submit = async () => {
    if (!approve && text.trim().length < 5) {
      setError("Give the vendor a reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const body = approve ? { action: "approve", durationDays: Number(days), adminNotes: text.trim() } : { action: "reject", adminNotes: text.trim() };
    const r = await adminRequest(`/api/admin/subscription-requests/${encodeURIComponent(request.requestId)}/verify`, { method: "POST", body });
    setBusy(false);
    if (r.ok) {
      await onDone({
        tone: "success",
        message: approve ? `${request.planName} is active for ${request.storeName}.` : `Declined the request from ${request.storeName}.`,
        warning: r.warning,
        storeId: request.storeId,
      });
    } else if (r.status === 409) {
      await onDone({ tone: "error", message: r.message });
    } else {
      setError(r.message);
    }
  };

  return (
    <Modal
      title={approve ? `Activate ${request.planName || "plan"}?` : "Decline this request?"}
      subtitle={request.storeName}
      icon={approve ? CalendarPlus : XCircle}
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={`btn ${approve ? "btn-primary" : "btn-danger"}`} disabled={busy || (approve && !isValidDuration(days))} onClick={submit}>
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />} {approve ? "Activate" : "Decline"}
          </button>
        </div>
      }
    >
      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      {approve ? (
        <div className="space-y-5">
          <p className="text-sm text-stone-600">Only activate once the vendor's payment has reached the team. The vendor is emailed.</p>
          {currentExpiry === undefined ? (
            <LoadingState label="Checking the store's current end date…" />
          ) : (
            <PlanChoice idPrefix="req" plans={[]} showPlans={false} days={days} onDays={setDays} currentExpiresAt={currentExpiry} />
          )}
          <Field id="req-note" label="Note for the record" optional>
            <input id="req-note" type="text" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} className={inputClass(false)} />
          </Field>
        </div>
      ) : (
        <Field id="req-reason" label="Reason for the vendor" error={error ? undefined : ""}>
          <textarea
            id="req-reason"
            data-autofocus
            rows={3}
            maxLength={500}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            className={inputClass(false)}
          />
        </Field>
      )}
    </Modal>
  );
}
