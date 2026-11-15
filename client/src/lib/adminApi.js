import { apiFetch } from "@/lib/apiClient";
import { conflictMessage } from "@/lib/adminFormat";
import { toMessage } from "@/lib/formatDate";

/**
 * Calls an admin route and always resolves with
 * { ok, status, data, message, warning }, where message and warning are strings.
 * A 409 gets plain wording from conflictMessage.
 */
export async function adminRequest(url, { method = "GET", body } = {}) {
  try {
    const res = await apiFetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data,
        message: typeof data.message === "string" ? data.message : "",
        warning: typeof data.warning === "string" && data.warning ? data.warning : "",
      };
    }
    const raw = toMessage(data, "That didn't work. Try again.");
    return { ok: false, status: res.status, data, message: res.status === 409 ? conflictMessage(raw) : raw, warning: "" };
  } catch (err) {
    return { ok: false, status: 0, data: {}, message: toMessage(err, "The server couldn't be reached. Check your connection."), warning: "" };
  }
}

/** Plans for the set-plan and activate dialogs. */
export async function loadPlans() {
  const r = await adminRequest("/api/subscription/plans");
  return r.ok && Array.isArray(r.data.plans) ? r.data.plans : [];
}
