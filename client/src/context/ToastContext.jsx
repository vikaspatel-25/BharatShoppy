import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { toMessage } from "@/lib/formatDate";

const ToastContext = createContext(null);
const DEFAULT_DURATION_MS = 5000;

const NO_TOAST = {
  toast: { error() {}, success() {}, warning() {}, info() {}, dismiss() {} },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((type, message, opts = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [
      ...prev.slice(-3),
      {
        id,
        type,
        title: typeof opts.title === "string" ? opts.title : "",
        // Callers sometimes pass an error object. Rendering an object crashes React, so always store a string.
        message: toMessage(message, ""),
        duration: typeof opts.duration === "number" ? opts.duration : DEFAULT_DURATION_MS,
      },
    ]);
    return id;
  }, []);

  const value = useMemo(
    () => ({
      toast: {
        error: (m, o) => add("error", m, o),
        success: (m, o) => add("success", m, o),
        warning: (m, o) => add("warning", m, o),
        info: (m, o) => add("info", m, o),
        dismiss: remove,
      },
    }),
    [add, remove]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed top-4 right-4 z-[1000] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Returns { toast }. Outside a provider it returns a no-op, so a shared component never crashes. */
export function useToast() {
  return useContext(ToastContext) || NO_TOAST;
}

const STYLES = {
  error: { Icon: AlertCircle, border: "border-red-200", icon: "bg-red-100 text-red-600" },
  success: { Icon: CheckCircle2, border: "border-emerald-200", icon: "bg-emerald-100 text-emerald-700" },
  warning: { Icon: AlertTriangle, border: "border-amber-200", icon: "bg-amber-100 text-amber-700" },
  info: { Icon: Info, border: "border-ocean-200", icon: "bg-ocean-100 text-ocean-700" },
};

function ToastItem({ toast, onRemove }) {
  const { id, type, title, message, duration } = toast;
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(timer);
  }, [paused, id, duration, onRemove]);

  const s = STYLES[type] || STYLES.info;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`animate-panel-in pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-(--shadow-raised) ${s.border}`}
    >
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${s.icon}`}>
        <s.Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {title && <p className="text-sm font-semibold text-stone-900">{title}</p>}
        {message && <p className="text-sm break-words whitespace-pre-line text-stone-600">{message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onRemove(id)}
        aria-label="Close notification"
        className="-mt-1 -mr-1 shrink-0 cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default ToastProvider;
