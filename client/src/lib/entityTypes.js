/**
 * Entity Types & Metadata definitions for Multi-Tenant BharatShopy profiles:
 * - Shopkeepers (Retail & Boutiques)
 * - Farmers (Organic & Fresh Harvest)
 * - Independent Service Providers (Artisans, Specialists, Technicians)
 */

export const ENTITY_TYPES = {
  shopkeeper: {
    id: "shopkeeper",
    label: "Boutique / Store",
    badgeLabel: "Verified Store",
    iconName: "Store",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Retail boutique or neighborhood shop selling products directly to customers.",
    defaultUnit: "piece",
    ctaLabel: "Shop Products",
    enquiryPrefix: "🛍️ Shop Order Enquiry",
  },
  farmer: {
    id: "farmer",
    label: "Local Organic Farmer",
    badgeLabel: "Direct from Farm",
    iconName: "Sprout",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Agricultural producer offering fresh harvest, organic staples, and bulk farm produce.",
    defaultUnit: "kg",
    ctaLabel: "View Fresh Harvest",
    enquiryPrefix: "🌾 Farm Produce Enquiry",
  },
  service_provider: {
    id: "service_provider",
    label: "Independent Specialist",
    badgeLabel: "Verified Specialist",
    iconName: "Wrench",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Independent artisan, tailor, electrician, or technician providing services & bookings.",
    defaultUnit: "service",
    ctaLabel: "Explore Services",
    enquiryPrefix: "🛠️ Service Consultation Enquiry",
  },
};

export function getEntityConfig(entityType) {
  const normalized = (entityType || "").toLowerCase().trim();
  if (ENTITY_TYPES[normalized]) {
    return ENTITY_TYPES[normalized];
  }
  // Inferred mappings
  if (normalized.includes("organic") || normalized.includes("farm") || normalized.includes("grocer")) {
    return ENTITY_TYPES.farmer;
  }
  if (normalized.includes("service") || normalized.includes("repair") || normalized.includes("tailor")) {
    return ENTITY_TYPES.service_provider;
  }
  return ENTITY_TYPES.shopkeeper;
}
