import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { LoadingState } from "@/components/panel/ui";

/**
 * Session providers for the two panels. Each asks the server who is signed in once,
 * shows a spinner while it waits, and sends a signed-out visitor to the right sign-in page.
 */

const VendorSessionContext = createContext(null);
const AdminSessionContext = createContext(null);

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function VendorSessionProvider({ children }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, vendor: null, store: null, products: [], error: "" });

  const loadStore = useCallback(async (storeId) => {
    const res = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}`);
    const data = await readJson(res);
    if (!res.ok) throw new Error(data.message || "Your store could not be loaded.");
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/vendor/auth/me");
        if (res.status === 401 || res.status === 403) {
          navigate("/vendor/login", { replace: true });
          return;
        }
        const data = await readJson(res);
        if (!res.ok || !data.vendor) throw new Error(data.message || "Your session could not be checked.");
        if (!data.vendor.storeId) {
          if (!cancelled) setState({ loading: false, vendor: data.vendor, store: null, products: [], error: "No store is linked to this account yet. If your application was approved, sign out and sign in again." });
          return;
        }
        const storeData = await loadStore(data.vendor.storeId);
        if (!cancelled) setState({ loading: false, vendor: data.vendor, store: storeData.store, products: storeData.products || [], error: "" });
      } catch (err) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: err?.message || "Something went wrong." }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, loadStore]);

  /** Reloads the store and its items, for example after a save. */
  const reload = useCallback(async () => {
    const storeId = state.vendor?.storeId;
    if (!storeId) return;
    const storeData = await loadStore(storeId);
    setState((s) => ({ ...s, store: storeData.store, products: storeData.products || [] }));
  }, [state.vendor?.storeId, loadStore]);

  /** Applies a local change to the item list without a reload. */
  const setProducts = useCallback((updater) => {
    setState((s) => ({ ...s, products: typeof updater === "function" ? updater(s.products) : updater }));
  }, []);

  const setStore = useCallback((store) => setState((s) => ({ ...s, store })), []);

  const value = useMemo(
    () => ({ vendor: state.vendor, storeId: state.vendor?.storeId || null, store: state.store, products: state.products, reload, setProducts, setStore }),
    [state.vendor, state.store, state.products, reload, setProducts, setStore]
  );

  if (state.loading) return <div className="panel-root min-h-screen"><LoadingState label="Opening your store…" /></div>;
  if (state.error) return <SessionError message={state.error} signInPath="/vendor/login" />;
  return <VendorSessionContext.Provider value={value}>{children}</VendorSessionContext.Provider>;
}

export function useVendorSession() {
  const ctx = useContext(VendorSessionContext);
  if (!ctx) throw new Error("useVendorSession must be used inside VendorSessionProvider");
  return ctx;
}

export function AdminSessionProvider({ children }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, admin: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/admin/auth/me");
        if (res.status === 401 || res.status === 403) {
          navigate("/admin/login", { replace: true });
          return;
        }
        const data = await readJson(res);
        if (!res.ok || !data.admin) throw new Error(data.message || "Your session could not be checked.");
        if (!cancelled) setState({ loading: false, admin: data.admin, error: "" });
      } catch (err) {
        if (!cancelled) setState({ loading: false, admin: null, error: err?.message || "Something went wrong." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const value = useMemo(() => ({ admin: state.admin }), [state.admin]);
  if (state.loading) return <div className="panel-root min-h-screen"><LoadingState label="Checking your session…" /></div>;
  if (state.error) return <SessionError message={state.error} signInPath="/admin/login" />;
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession must be used inside AdminSessionProvider");
  return ctx;
}

function SessionError({ message, signInPath }) {
  return (
    <div className="panel-root flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold">We couldn’t open this page</h1>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
            Try again
          </button>
          <a href={signInPath} className="btn btn-secondary">
            Sign in again
          </a>
        </div>
      </div>
    </div>
  );
}
