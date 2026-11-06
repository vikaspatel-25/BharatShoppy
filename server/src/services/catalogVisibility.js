/**
 * Catalog Visibility Engine
 * Enforces strict subscription-based visibility across public discovery feeds
 * (/search, /products, /stores, /store/:id).
 *
 * Rules:
 * 1. Admin content / default legacy stores without explicit status are treated as active.
 * 2. Vendor stores with subscription.status === 'active' or 'trial' and expiresAt > now are visible.
 * 3. Expired or discontinued vendor stores are shielded from search results,
 *    preventing public ordering while preserving 100% of the underlying product data in DB.
 */

export function isStoreSubscriptionActive(store) {
  if (!store || store.isActive === false) {
    return false;
  }

  // If no subscription object exists yet (legacy/seeded mock data), default to active
  if (!store.subscription) {
    return true;
  }

  const { status, expiresAt } = store.subscription;

  // Active or trial statuses are eligible
  if (status !== "active" && status !== "trial") {
    return false;
  }

  // If expiration date is specified, verify it hasn't lapsed
  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    if (expiryDate <= new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Returns a list of store IDs whose subscriptions are currently active.
 */
export function getActiveStoreIds(stores = []) {
  return stores
    .filter((store) => isStoreSubscriptionActive(store))
    .map((store) => store._id);
}

/**
 * Filters an array of products to include only those whose parent store is active
 * and which are not soft-deleted or inactive (isActive !== false).
 */
export function filterProductsByActiveStores(products = [], stores = []) {
  const activeIds = new Set(getActiveStoreIds(stores));
  return products.filter(
    (product) => activeIds.has(product.storeId) && product.isActive !== false
  );
}

/**
 * Filters stores to include only those with active subscriptions.
 */
export function filterActiveStores(stores = []) {
  return stores.filter((store) => isStoreSubscriptionActive(store));
}
