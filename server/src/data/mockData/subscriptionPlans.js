/**
 * Default Subscription Plans for BharatShoppy
 * Configurable pricing, discount percentages, and product upload quotas.
 */

export const defaultPlans = [
  {
    planId: "starter_free",
    name: "Starter Trial Plan",
    originalPrice: 0,
    discountedPrice: 0,
    discountPercentage: 0,
    billingCycle: "Free Trial",
    badge: "Basic",
    productMonthlyLimit: 15,
    maxImagesPerProduct: 5,
    features: [
      "15 catalog products / services",
      "Standard marketplace search indexing",
      "Up to 5 photos per item",
      "Direct WhatsApp enquiry integration",
      "Basic storefront link",
    ],
    isActive: true,
    sortOrder: 1,
  },
  {
    planId: "yearly_standard",
    name: "Boutique & Farm Standard",
    originalPrice: 1800,
    discountedPrice: 1200,
    discountPercentage: 33,
    billingCycle: "Per Year",
    badge: "Popular Choice",
    productMonthlyLimit: 50,
    maxImagesPerProduct: 8,
    features: [
      "50 catalog products / services",
      "Priority discovery & category ranking",
      "Verified Entity Trust Badge",
      "High-resolution printable Counter QR Code",
      "Up to 8 photos per item",
      "Entity-specific metadata (Farm season / Specialist)",
      "Dedicated path & subdomain storefront",
    ],
    isActive: true,
    sortOrder: 2,
  },
  {
    planId: "yearly_pro",
    name: "Enterprise & Agri-Hub Pro",
    originalPrice: 3600,
    discountedPrice: 2400,
    discountPercentage: 33,
    billingCycle: "Per Year",
    badge: "Best Value",
    productMonthlyLimit: 200,
    maxImagesPerProduct: 12,
    features: [
      "200 catalog products / services",
      "Top-tier marketplace search placement",
      "Custom Subdomain Branding (*.bharatshopee.com)",
      "Unlimited WhatsApp Enquiry Cart",
      "Bulk produce / B2B order enquiry mode",
      "Comprehensive storefront analytics",
      "24/7 Priority Concierge Support",
    ],
    isActive: true,
    sortOrder: 3,
  },
];

export function calculateDiscount(originalPrice, discountedPrice) {
  if (!originalPrice || originalPrice <= discountedPrice) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}
