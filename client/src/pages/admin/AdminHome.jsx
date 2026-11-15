import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, EyeOff, History, Layers, Package, ShieldAlert, Store, UserCheck, Users } from "lucide-react";
import { Notice, PageHeader, StatCard } from "@/components/panel/ui";
import { LinkPanel } from "@/components/vendor/vendorParts";
import { adminRequest } from "@/lib/adminApi";

export default function AdminHome() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminRequest("/api/admin/overview").then((r) => {
      if (cancelled) return;
      if (r.ok) setData(r.data);
      else setError(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = !data && !error;
  const s = data?.stores || {};
  const apps = data?.applicationsWaiting || 0;
  const reqs = data?.planRequestsWaiting || 0;

  return (
    <>
      <PageHeader title="Dashboard" description="What needs your attention, and how the marketplace stands." />
      {error && (
        <Notice tone="error" className="mb-6">
          {error}
        </Notice>
      )}
      {(apps > 0 || reqs > 0) && (
        <Notice tone="warn" icon={AlertTriangle} className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Waiting for you:{" "}
              {[apps > 0 && `${apps} ${apps === 1 ? "application" : "applications"}`, reqs > 0 && `${reqs} plan ${reqs === 1 ? "request" : "requests"}`].filter(Boolean).join(" and ")}.
            </span>
            <span className="flex gap-2">
              {apps > 0 && (
                <Link to="/admin/applications" className="btn btn-secondary btn-sm">
                  Review applications
                </Link>
              )}
              {reqs > 0 && (
                <Link to="/admin/plan-requests" className="btn btn-secondary btn-sm">
                  Review plan requests
                </Link>
              )}
            </span>
          </div>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Applications waiting" value={apps} icon={UserCheck} loading={loading} />
        <StatCard label="Plan requests waiting" value={reqs} icon={Layers} loading={loading} />
        <StatCard label="Active items" value={data?.activeItems ?? 0} icon={Package} loading={loading} />
        <StatCard label="Hidden by moderation" value={data?.hiddenItems ?? 0} icon={EyeOff} loading={loading} />
      </div>

      <h2 className="mt-8 mb-3 text-base font-semibold">Stores</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="All stores" value={s.all ?? 0} icon={Store} loading={loading} />
        <StatCard label="Plan active" value={s.active ?? 0} icon={Users} loading={loading} />
        <StatCard label="Ending in 30 days" value={s.expiring ?? 0} icon={Clock} loading={loading} />
        <StatCard label="Plan ended" value={s.expired ?? 0} icon={AlertTriangle} loading={loading} />
        <StatCard label="In removal hold" value={s.removal_hold ?? 0} icon={ShieldAlert} loading={loading} />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <LinkPanel
          title="Vendors"
          links={[
            { to: "/admin/applications", icon: UserCheck, label: "Applications", hint: apps ? `${apps} waiting` : "None waiting" },
            { to: "/admin/vendors", icon: Users, label: "Vendor directory", hint: s.expiring ? `${s.expiring} ending soon` : "Plans, reminders and removal" },
          ]}
        />
        <LinkPanel
          title="Plans and catalogue"
          links={[
            { to: "/admin/plan-requests", icon: Layers, label: "Plan requests", hint: reqs ? `${reqs} waiting` : "None waiting" },
            { to: "/admin/listings", icon: Package, label: "Listings", hint: "Hide or restore items" },
            { to: "/admin/audit-log", icon: History, label: "Audit log", hint: "Every admin change" },
          ]}
        />
      </div>
    </>
  );
}
