import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, UserCheck, XCircle } from "lucide-react";
import { DetailList, EmptyState, Field, FilterTabs, LoadingState, Modal, Notice, PageHeader, SearchInput, StatusBadge, inputClass } from "@/components/panel/ui";
import { ClampedName, CopyButton, EmailWarning } from "@/components/admin/adminParts";
import { useToast } from "@/context/ToastContext";
import { adminRequest } from "@/lib/adminApi";
import { countByStatus, matchesApplication } from "@/lib/adminFormat";
import { getEntityConfig } from "@/lib/entityTypes";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { scrollToTop } from "@/lib/scrollPanel";

const STATUS_BADGE = {
  pending: { tone: "warn", label: "Waiting" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

export default function AdminApplications() {
  const { toast } = useToast();
  const [apps, setApps] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState(null); // { tone, message, warning, appId }
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const load = useCallback(async () => {
    const r = await adminRequest("/api/admin/vendor-applications");
    if (r.ok) {
      setApps(Array.isArray(r.data.applications) ? r.data.applications : []);
      setLoadError("");
    } else {
      setApps((prev) => prev || []);
      setLoadError(r.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const finish = (r, successText, appId) => {
    if (r.ok) {
      setNotice({ tone: "success", message: successText, warning: r.warning, appId });
      toast.success(successText);
    } else {
      setNotice({ tone: "error", message: r.message });
      toast.error(r.message);
    }
    scrollToTop();
    return load();
  };

  const approve = async (app) => {
    setBusyId(app._id);
    const r = await adminRequest(`/api/admin/vendor-applications/${encodeURIComponent(app._id)}/approve`, { method: "POST", body: {} });
    await finish(r, `Approved “${app.storeName}”. The store is created on the free starter plan.`, app._id);
    setBusyId(null);
  };

  const reject = async () => {
    const text = reason.trim();
    if (text.length < 5) {
      setReasonError("Give the applicant a reason of at least 5 characters.");
      return;
    }
    const app = rejecting;
    setBusyId(app._id);
    const r = await adminRequest(`/api/admin/vendor-applications/${encodeURIComponent(app._id)}/reject`, { method: "POST", body: { reason: text } });
    if (r.ok || r.status === 409) setRejecting(null);
    else setReasonError(r.message);
    if (r.ok || r.status === 409) await finish(r, `Rejected the application for “${app.storeName}”.`, app._id);
    setBusyId(null);
  };

  const resend = async (appId) => {
    const r = await adminRequest(`/api/admin/vendor-applications/${encodeURIComponent(appId)}/resend-email`, { method: "POST", body: {} });
    if (r.ok) {
      setNotice((n) => ({ ...n, warning: "" }));
      toast.success(r.message || "Email sent.");
    } else toast.error(r.message);
  };

  const counts = countByStatus(apps || [], ["pending", "approved", "rejected"]);
  const shown = (apps || []).filter((a) => (tab === "all" || a.status === tab) && matchesApplication(a, search));

  return (
    <>
      <PageHeader title="Applications" description="People who want to sell on BharatShopy. Approving creates their store on the free starter plan." />
      {notice && (
        <Notice tone={notice.tone} icon={notice.tone === "success" ? CheckCircle2 : undefined} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.message}
        </Notice>
      )}
      {notice?.warning && <EmailWarning className="mb-4" warning={notice.warning} onResend={() => resend(notice.appId)} />}
      {loadError && (
        <Notice tone="error" className="mb-4">
          {loadError}
        </Notice>
      )}

      <FilterTabs
        label="Application status"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Waiting", count: counts.pending },
          { key: "approved", label: "Approved", count: counts.approved },
          { key: "rejected", label: "Rejected", count: counts.rejected },
          { key: "all", label: "All", count: counts.all },
        ]}
      />
      <SearchInput id="app-search" label="Search applications" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, store, email, phone or city" className="mb-4 w-full sm:max-w-sm" />

      {apps === null ? (
        <LoadingState label="Loading applications…" />
      ) : shown.length === 0 ? (
        <EmptyState icon={UserCheck} title={search ? "No applications match" : tab === "pending" ? "Nothing waiting" : "No applications here"} description={search ? "Try a different search." : undefined} />
      ) : (
        <ul className="space-y-4">
          {shown.map((app) => {
            const badge = STATUS_BADGE[app.status] || { tone: "neutral", label: app.status };
            const busy = busyId === app._id;
            const address = [app.address?.area, app.address?.city, app.address?.state, app.address?.pincode].filter(Boolean).join(", ");
            return (
              <li key={app._id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold">
                      <ClampedName>{app.storeName}</ClampedName>
                    </h2>
                    <p className="text-sm text-stone-500">Applied {formatDisplayDateTime(app.createdAt)}</p>
                  </div>
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>
                <div className="mt-4">
                  <DetailList
                    rows={[
                      ["Applicant", app.name],
                      [
                        "Email",
                        app.email && (
                          <span key="value" className="inline-flex items-center gap-1">
                            {app.email} <CopyButton value={app.email} label="email" />
                          </span>
                        ),
                      ],
                      [
                        "Phone",
                        app.phone && (
                          <span key="value" className="inline-flex items-center gap-1">
                            {app.phone} <CopyButton value={app.phone} label="phone number" />
                          </span>
                        ),
                      ],
                      ["Seller type", app.entityType ? getEntityConfig(app.entityType).label : ""],
                      ["Category", app.storeCategory],
                      ["Store address", app.subdomain || app.slug ? `${app.subdomain || app.slug}.bharatshopy.com` : ""],
                      ["Location", address],
                      ["Description", app.description],
                      ["Reviewed", app.reviewedAt ? formatDisplayDateTime(app.reviewedAt) : ""],
                      ["Rejection reason", app.status === "rejected" ? app.rejectionReason : ""],
                    ]}
                  />
                </div>
                {app.status === "pending" && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setReason("");
                        setReasonError("");
                        setRejecting(app);
                      }}
                    >
                      <XCircle size={16} aria-hidden="true" /> Reject
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => approve(app)}>
                      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />} Approve
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rejecting && (
        <Modal
          title="Reject this application?"
          subtitle="The applicant is emailed the reason. They can apply again later."
          icon={XCircle}
          busy={busyId === rejecting._id}
          onClose={() => setRejecting(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" disabled={busyId === rejecting._id} onClick={() => setRejecting(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" disabled={busyId === rejecting._id} onClick={reject}>
                {busyId === rejecting._id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />} Reject
              </button>
            </div>
          }
        >
          <p className="mb-4 text-sm font-medium break-words text-stone-900">{rejecting.storeName}</p>
          <Field id="reject-reason" label="Reason for the applicant" error={reasonError}>
            <textarea
              id="reject-reason"
              data-autofocus
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError("");
              }}
              aria-invalid={Boolean(reasonError)}
              aria-describedby={reasonError ? "reject-reason-error" : undefined}
              className={inputClass(reasonError)}
            />
          </Field>
        </Modal>
      )}
    </>
  );
}
