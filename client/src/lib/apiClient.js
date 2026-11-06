/**
 * Standard API client wrapper for same-origin requests with cookie credentials and 401 redirects.
 */
export async function apiFetch(url, options = {}) {
  const mergedOptions = {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, mergedOptions);

  if (response.status === 401) {
    const isBrowser = typeof window !== "undefined";
    const isAuthRoute = typeof url === "string" && url.includes("/auth/");
    if (isBrowser && !isAuthRoute) {
      if (url.includes("/api/admin")) {
        window.location.href = "/admin/login";
      } else if (url.includes("/api/vendor")) {
        window.location.href = "/vendor/login";
      }
    }
  }

  return response;
}
