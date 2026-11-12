/**
 * The one place that decides a store's plan status. Every screen and API uses it,
 * so the dashboard, the directory and the public pages can't disagree.
 *
 * computedStatus:
 *   active        plan status is active or trial and the end date (if any) is in the future
 *   expired       a plan existed but has ended or was discontinued
 *   none          the store has no subscription record
 *   removal_hold  the vendor is in the 7-day removal hold
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 30;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when a subscription record is current: active or trial, and not past its end date. */
export function isSubscriptionCurrent(subscription, now = new Date()) {
  if (!subscription) return false;
  const { status } = subscription;
  if (status !== "active" && status !== "trial") return false;
  const expires = toDate(subscription.expiresAt);
  if (expires && expires <= now) return false;
  return true;
}

export function getSubscriptionState(store, now = new Date()) {
  const subscription = store?.subscription || null;
  const expires = toDate(subscription?.expiresAt);
  const remainingDays = expires && expires > now ? Math.ceil((expires.getTime() - now.getTime()) / DAY_MS) : 0;

  let computedStatus;
  if (store?.removalStatus === "pending_deletion") computedStatus = "removal_hold";
  else if (!subscription) computedStatus = "none";
  else if (isSubscriptionCurrent(subscription, now)) computedStatus = "active";
  else computedStatus = "expired";

  return {
    computedStatus,
    planId: subscription?.plan || null,
    storedStatus: subscription?.status || null,
    startDate: subscription?.startDate || null,
    expiresAt: subscription?.expiresAt || null,
    remainingDays: computedStatus === "active" ? remainingDays : 0,
    isExpiringSoon: computedStatus === "active" && Boolean(expires) && remainingDays <= EXPIRING_SOON_DAYS,
  };
}

/** Days left in a removal hold, or 0. */
export function getRemovalDaysLeft(store, now = new Date()) {
  const deleteAfter = toDate(store?.deleteAfter);
  if (!deleteAfter || deleteAfter <= now) return 0;
  return Math.ceil((deleteAfter.getTime() - now.getTime()) / DAY_MS);
}

/** The directory tab a store belongs to. "expiring" is a subset of "active". */
export function matchesStatusFilter(state, filter) {
  if (!filter || filter === "all") return true;
  if (filter === "expiring") return state.isExpiringSoon;
  return state.computedStatus === filter;
}
