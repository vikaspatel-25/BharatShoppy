import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { formatDisplayDateTime } from "@/lib/formatDate";

/** Admin notification menu in the panel header. Reloads on every page change. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/admin/notifications?limit=20")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) {
          setItems(Array.isArray(data.notifications) ? data.notifications : []);
          setUnread(Number(data.unreadCount) || 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Close on an outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAllRead = async () => {
    const res = await apiFetch("/api/admin/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => null);
    if (res?.ok) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const openItem = async (n) => {
    if (!n.read) {
      const res = await apiFetch("/api/admin/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n._id }),
      }).catch(() => null);
      if (res?.ok) {
        setUnread((u) => Math.max(0, u - 1));
        setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      }
    }
    setOpen(false);
    if (typeof n.link === "string" && n.link.startsWith("/admin")) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-secondary btn-sm relative px-2"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="card animate-panel-in absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden shadow-(--shadow-raised)">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">
              Notifications {unread > 0 && <span className="ml-1 font-normal text-stone-500">({unread} unread)</span>}
            </p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="link text-sm">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-stone-500">No notifications yet.</li>
            ) : (
              items.map((n) => (
                <li key={n._id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-stone-50 ${!n.read ? "bg-ocean-50/50" : ""}`}
                  >
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${!n.read ? "bg-ocean-600" : "bg-transparent"}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-stone-900">
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-sm text-stone-500">{n.message}</span>
                      <span className="mt-1 block text-xs text-stone-400">{formatDisplayDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
