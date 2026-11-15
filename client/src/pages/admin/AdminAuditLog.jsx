import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { DetailList, EmptyState, LoadingState, Modal, Notice, PageHeader, SearchInput, StatusBadge, inputClass } from "@/components/panel/ui";
import { ClampedName, Pager } from "@/components/admin/adminParts";
import { adminRequest } from "@/lib/adminApi";
import { AUDIT_ACTIONS, auditActionLabel, detailValue, humaniseKey, targetTypeLabel } from "@/lib/adminFormat";
import { formatDisplayDateTime } from "@/lib/formatDate";

const PAGE_SIZE = 25;
const TARGET_TYPES = ["application", "store", "vendor", "listing", "plan"];

export default function AdminAuditLog() {
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (action !== "all") params.set("action", action);
    if (targetType !== "all") params.set("targetType", targetType);
    if (query) params.set("search", query);
    const r = await adminRequest(`/api/admin/audit-log?${params}`);
    if (r.ok) {
      setResult(r.data);
      setError("");
    } else {
      setResult((prev) => prev || { entries: [], total: 0, totalPages: 1 });
      setError(r.message);
    }
  }, [page, action, targetType, query]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = result?.entries || [];

  return (
    <>
      <PageHeader title="Audit log" description="Every change an admin made, newest first. Codes, passwords and tokens are never recorded." />
      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SearchInput id="audit-search" label="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Store, item or vendor name" />
        <div>
          <label htmlFor="audit-action" className="sr-only">
            Action
          </label>
          <select
            id="audit-action"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className={inputClass(false)}
          >
            <option value="all">All actions</option>
            {Object.entries(AUDIT_ACTIONS).map(([key, v]) => (
              <option key={key} value={key}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-target" className="sr-only">
            Record type
          </label>
          <select
            id="audit-target"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPage(1);
            }}
            className={inputClass(false)}
          >
            <option value="all">All record types</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {targetTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {result === null ? (
        <LoadingState label="Loading the audit log…" />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No entries match" description={query || action !== "all" || targetType !== "all" ? "Try a different filter." : "Admin changes will appear here."} />
      ) : (
        <ul className="card divide-y divide-stone-100 overflow-hidden">
          {entries.map((e) => {
            const a = auditActionLabel(e.action);
            return (
              <li key={e._id}>
                <button type="button" onClick={() => setOpen(e)} className="flex w-full flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3.5 text-left hover:bg-stone-50 sm:flex-nowrap sm:items-center sm:px-5">
                  <span className="w-full shrink-0 sm:w-44">
                    <StatusBadge tone={a.tone}>{a.label}</StatusBadge>
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium text-stone-900">
                      <ClampedName>{e.targetName || e.targetId}</ClampedName>
                    </span>
                    <span className="block text-stone-500">
                      {targetTypeLabel(e.targetType)} · by {e.actorEmail || "admin"}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-stone-500">{formatDisplayDateTime(e.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={result?.page || page} totalPages={result?.totalPages} onPage={setPage} total={result?.total} noun="entries" />

      {open && (
        <Modal title={auditActionLabel(open.action).label} subtitle={formatDisplayDateTime(open.createdAt)} icon={History} size="lg" onClose={() => setOpen(null)}>
          <DetailList
            rows={[
              ["Record", open.targetName],
              ["Record type", targetTypeLabel(open.targetType)],
              ["Record ID", open.targetId],
              ["Admin", open.actorEmail],
              ["IP address", open.ipAddress],
              ...Object.entries(open.details || {}).map(([k, v]) => [humaniseKey(k), detailValue(v)]),
            ]}
          />
        </Modal>
      )}
    </>
  );
}
