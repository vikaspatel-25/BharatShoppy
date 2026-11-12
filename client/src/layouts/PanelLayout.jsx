import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CreditCard,
  ExternalLink,
  History,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Percent,
  PlusCircle,
  Store,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { BrandMark } from "@/components/panel/ui";
import { findPanelPage } from "@/routes/panelRoutes";
import { apiFetch } from "@/lib/apiClient";

const ICONS = { CreditCard, History, Layers, LayoutDashboard, Package, Percent, PlusCircle, Store, UserCheck, Users };

/**
 * Shared shell for the admin panel and the vendor portal: a sidebar of grouped links
 * with count badges, a header that names the current page, and sign-out.
 * On small screens the sidebar becomes a drawer that closes after navigating.
 *
 * nav: [{ heading, items: [{ to, label, icon, badgeKey }] }]
 * badges: { [badgeKey]: number }
 */
export default function PanelLayout({ portalName, nav, badges = {}, logoutUrl, loginPath, siteLink, headerExtras, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const current = findPanelPage(path);

  // Close the drawer after navigating
  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  // Close the drawer with Escape
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await apiFetch(logoutUrl, { method: "POST" });
    } catch {
      // Signing out locally still matters if the request fails
    } finally {
      navigate(loginPath, { replace: true });
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-stone-200 px-4">
        <BrandMark href="/" subtitle={portalName} />
        <button type="button" onClick={() => setMobileOpen(false)} className="btn btn-ghost btn-sm lg:hidden" aria-label="Close menu">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label={portalName}>
        {nav.map((group) => (
          <div key={group.heading} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-xs font-semibold text-stone-400">{group.heading}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon, badgeKey }) => {
                const Icon = ICONS[icon] || LayoutDashboard;
                const active = to === path || (current && current.to === path && to === current.to);
                const badge = badgeKey ? badges[badgeKey] : 0;
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                      }`}
                    >
                      <Icon size={17} aria-hidden="true" className={active ? "text-brand-700" : "text-stone-400"} />
                      <span className="flex-1">{label}</span>
                      {badge > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          <span className="sr-only">, </span>
                          {badge}
                          <span className="sr-only"> waiting</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <button type="button" onClick={signOut} disabled={signingOut} className="btn btn-ghost w-full justify-start text-stone-600">
          <LogOut size={17} aria-hidden="true" /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );

  // overflow-clip, not overflow-hidden: a browser can still scroll a hidden container to show a
  // focused element (such as a visually hidden file input), which shifts the whole panel.
  return (
    <div className="panel-root flex h-screen overflow-clip">
      <aside className="hidden w-64 shrink-0 border-r border-stone-200 bg-white lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-stone-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="animate-panel-in absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-(--shadow-raised)">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setMobileOpen(true)} className="btn btn-ghost btn-sm -ml-2 lg:hidden" aria-label="Open menu" aria-expanded={mobileOpen}>
              <Menu size={20} aria-hidden="true" />
            </button>
            <p className="truncate text-sm">
              <span className="hidden text-stone-500 sm:inline">{portalName} / </span>
              <span className="font-semibold text-stone-900">{current?.label || portalName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {headerExtras}
            {siteLink && (
              <a href={siteLink.href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <span className="hidden sm:inline">{siteLink.label}</span>
                <ExternalLink size={14} aria-hidden="true" />
                <span className="sr-only sm:hidden">{siteLink.label} (opens in a new tab)</span>
              </a>
            )}
          </div>
        </header>

        {/* relative: visually hidden labels and inputs stay inside this scroll area */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
