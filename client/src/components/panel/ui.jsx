import { useEffect, useRef } from "react";
import { AlertCircle, Search, X } from "lucide-react";

/** Label + control + hint or error, wired up for screen readers. */
export function Field({ id, label, optional = false, hint, error, children, className = "" }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {optional && <span className="ml-1 font-normal text-stone-400">(optional)</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="field-error flex items-start gap-1">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          <span>{String(error)}</span>
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Class string for a text input, select or textarea, with the invalid state. */
export function inputClass(invalid, extra = "") {
  return `input ${invalid ? "input-invalid" : ""} ${extra}`.trim();
}

/** A form section in its own card, optionally numbered. */
export function FormSection({ step, title, description, aside, children, id }) {
  return (
    <section id={id} className="card" aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {step != null && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800 ring-1 ring-brand-200">
              {step}
            </span>
          )}
          <div>
            <h2 id={id ? `${id}-title` : undefined} className="text-base font-bold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
          </div>
        </div>
        {aside}
      </header>
      <div className="card-body space-y-5">{children}</div>
    </section>
  );
}

/** Banner for a result or a warning. tone: info | success | warn | error */
export function Notice({ tone = "info", icon: Icon = AlertCircle, children, className = "", onDismiss }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`notice notice-${tone} ${className}`}>
      <Icon size={18} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-current opacity-60 hover:opacity-100" aria-label="Dismiss">
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered dialog with a title bar. Closes on Escape, keeps Tab inside the dialog,
 * moves focus in when it opens and gives it back when it closes.
 * Pass busy to stop it closing while a request is running.
 */
export function Modal({ title, subtitle, icon: Icon, onClose, children, footer, size = "md", busy = false }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    const first = panel?.querySelector("[data-autofocus]") || panel?.querySelector(FOCUSABLE);
    (first || panel)?.focus();

    const onKey = (e) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && typeof previous.focus === "function") previous.focus();
    };
  }, []);

  const width = size === "lg" ? "max-w-3xl" : "max-w-md";
  return (
    <div
      className="panel-root fixed inset-0 z-50 flex items-center justify-center !bg-stone-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className={`card animate-panel-in flex max-h-[90vh] w-full ${width} flex-col shadow-(--shadow-raised) outline-none`}>
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon size={18} aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="text-base font-bold break-words">{title}</h3>
              {subtitle && <p className="mt-0.5 text-sm break-words text-stone-500">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-ghost btn-sm -mr-2" aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="rounded-b-(--radius-card) border-t border-stone-100 bg-stone-50/60 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

/** BharatShopy name lockup used in the sidebar and on sign-in pages. */
export function BrandMark({ className = "", href = "/", subtitle }) {
  return (
    <a href={href} className={`inline-flex items-center gap-2.5 ${className}`} aria-label="BharatShopy home">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-base font-extrabold text-white" aria-hidden="true">
        B
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-tight text-stone-900">
          Bharat<span className="text-brand-700">Shopy</span>
        </span>
        {subtitle && <span className="block text-xs text-stone-500">{subtitle}</span>}
      </span>
    </a>
  );
}

/** Page shell for sign-in, application and other standalone account pages. */
export function AuthLayout({ title, subtitle, children, footer, wide = false, backHref = "/", backLabel = "Back to BharatShopy" }) {
  return (
    <div className="panel-root flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="page-container flex h-16 items-center justify-between">
          <BrandMark />
          <a href={backHref} className="text-sm font-medium text-stone-600 hover:text-stone-900">
            {backLabel}
          </a>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-14">
        <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-2 text-base text-stone-600">{subtitle}</p>}
          </div>
          {wide ? children : <div className="card p-6 sm:p-8">{children}</div>}
          {footer && <div className="mt-6 text-center text-sm text-stone-600">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** Title row at the top of every panel page. */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold break-words">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Single number with a label. */
export function StatCard({ label, value, icon: Icon, loading = false, hint }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-bold text-stone-900">
          {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-stone-200" /> : value}
        </p>
        <p className="text-sm text-stone-500">{label}</p>
        {hint && <p className="text-xs text-stone-400">{hint}</p>}
      </div>
    </div>
  );
}

/** Shown when a list has nothing in it. */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="card px-6 py-14 text-center">
      {Icon && (
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-500">
          <Icon size={22} aria-hidden="true" />
        </span>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Centered spinner with a short message. */
export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-stone-500" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-stone-300 border-t-brand-700" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Used / limit bar. The item quota is a total, so nothing here mentions a month. */
export function UsageBar({ label, used = 0, limit = 0 }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-brand-600";
  const left = Math.max(0, limit - used);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-stone-800">{label}</span>
        <span className="text-stone-500">
          <span className="font-semibold text-stone-900">{used}</span> of {limit} used
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={label}
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-stone-500">{left === 0 ? "No space left on this plan" : `${left} left`}</p>
    </div>
  );
}

/** Status pill with a fixed colour per meaning. tone: success | warn | danger | info | brand | neutral */
export function StatusBadge({ tone = "neutral", children }) {
  const cls =
    {
      success: "badge-success",
      warn: "badge-warn",
      danger: "badge-danger",
      info: "badge-ocean",
      brand: "badge-brand",
      neutral: "badge-neutral",
    }[tone] || "badge-neutral";
  return <span className={`badge ${cls}`}>{children}</span>;
}

/** Search box with a magnifier icon and a visually hidden label. */
export function SearchInput({ id, label, value, onChange, placeholder, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-400" aria-hidden="true" />
      <input id={id} type="search" value={value} onChange={onChange} placeholder={placeholder} className={inputClass(false, "pl-9")} />
    </div>
  );
}

/** Row of filter tabs with counts. tabs: [{ key, label, count }] */
export function FilterTabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-stone-200">
      {tabs.map((t) => {
        const on = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              on ? "border-brand-700 text-brand-800" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-brand-100 text-brand-800" : "bg-stone-100 text-stone-600"}`}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Label and value rows in a bordered list. rows: [[label, value]] ; empty values are skipped. */
export function DetailList({ rows }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (shown.length === 0) return null;
  return (
    <dl className="divide-y divide-stone-100 rounded-lg border border-stone-200 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 px-3 py-2.5">
          <dt className="shrink-0 text-stone-500">{k}</dt>
          <dd className="min-w-0 text-right break-words text-stone-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
