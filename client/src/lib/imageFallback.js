/**
 * Centralized Image Fallback Engine
 * Provides context-aware placeholder graphics when vendor photos are not uploaded
 * or fail to load across mobile/desktop browsers.
 */

export const PLACEHOLDERS = {
  farmer: "/assets/images/placeholders/farmerProducePlaceholder.svg",
  service_provider: "/assets/images/placeholders/servicePlaceholder.svg",
  shopkeeper: "/assets/images/placeholders/shopRetailPlaceholder.svg",
  productDefault: "/assets/images/placeholders/productPlaceholder.jpeg",
  storeLogo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
  storeBanner: "/assets/images/placeholders/storePlaceholder.jpeg",
};

/**
 * Returns an appropriate fallback image URL based on entity type and category.
 */
export function getProductFallbackImage(entityType, category = "") {
  const normalizedCategory = String(category || "").toLowerCase();

  if (
    entityType === "farmer" ||
    normalizedCategory.includes("organic") ||
    normalizedCategory.includes("farm") ||
    normalizedCategory.includes("produce") ||
    normalizedCategory.includes("grocer")
  ) {
    return PLACEHOLDERS.farmer;
  }

  if (
    entityType === "service_provider" ||
    normalizedCategory.includes("service") ||
    normalizedCategory.includes("repair") ||
    normalizedCategory.includes("consult") ||
    normalizedCategory.includes("technician")
  ) {
    return PLACEHOLDERS.service_provider;
  }

  if (
    entityType === "shopkeeper" ||
    normalizedCategory.includes("apparel") ||
    normalizedCategory.includes("fashion") ||
    normalizedCategory.includes("cloth") ||
    normalizedCategory.includes("handicraft") ||
    normalizedCategory.includes("boutique")
  ) {
    return PLACEHOLDERS.shopkeeper;
  }

  return PLACEHOLDERS.productDefault;
}

/**
 * Returns a fallback store logo / avatar URL.
 */
export function getStoreFallbackLogo(entityType = "shopkeeper") {
  return PLACEHOLDERS.storeLogo;
}

/**
 * Safe Image Error Handler that avoids looping onerror triggers.
 */
export function handleImgError(event, fallbackUrl = PLACEHOLDERS.productDefault) {
  if (!event || !event.currentTarget) return;
  event.currentTarget.onerror = null;
  event.currentTarget.src = fallbackUrl;
}
