import { isStoreSubscriptionActive } from "./catalogVisibility.js";

/**
 * Monthly / Total Upload Quota Engine
 * Evaluates whether a vendor is permitted to upload new catalog items.
 */

export function checkProductUploadQuota(store, currentProductCount = 0) {
  if (!store) {
    return {
      allowed: false,
      reason: "STORE_NOT_FOUND",
      message: "Store not found.",
    };
  }

  // 1. Subscription Active Check
  if (!isStoreSubscriptionActive(store)) {
    return {
      allowed: false,
      reason: "SUBSCRIPTION_INACTIVE",
      message:
        "Your subscription plan is currently expired or pending payment. Please activate or renew your subscription to upload items.",
      currentCount: currentProductCount,
      limit: store.limits?.productMonthlyLimit || 50,
    };
  }

  // 2. Limit Threshold Check
  const limit = store.limits?.productMonthlyLimit || 50;

  if (currentProductCount >= limit) {
    return {
      allowed: false,
      reason: "QUOTA_EXCEEDED",
      message: `You have reached your plan limit of ${limit} catalog items. Please upgrade to a higher tier plan to list more items.`,
      currentCount: currentProductCount,
      limit,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    currentCount: currentProductCount,
    limit,
    remaining: Math.max(0, limit - currentProductCount),
  };
}
