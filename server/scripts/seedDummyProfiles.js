import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import locations from "../src/data/mockData/locations.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });

/**
 * 1. Dummy Store Profiles
 * Covers: Shopkeeper, Farmer, Independent Service Provider, Expired, and Quota-Capped.
 */
export const dummyStores = [
  {
    _id: "store_farmer_01",
    storeName: "Kisan Organic Produce & Farms",
    slug: "kisan-organics",
    subdomain: "kisan-organics",
    entityType: "farmer",
    storeCategory: "Groceries & Organics",
    description:
      "Direct-from-farm certified organic produce, heirloom grains, and cold-pressed oils harvested in Nashik valley. Zero chemical fertilizers, 100% trace-to-farm purity.",
    logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
    images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
    city: "Nashik",
    state: "Maharashtra",
    location: { latitude: 20.011, longitude: 73.79 },
    address: {
      area: "Dindori Agro Belt",
      city: "Nashik",
      state: "Maharashtra",
      pincode: "422004",
    },
    contact: { phone: "+916261667099", whatsapp: "+916261667099" },
    businessHours: {
      monday: { open: "06:00", close: "19:00" },
      tuesday: { open: "06:00", close: "19:00" },
      wednesday: { open: "06:00", close: "19:00" },
      thursday: { open: "06:00", close: "19:00" },
      friday: { open: "06:00", close: "19:00" },
      saturday: { open: "06:00", close: "20:00" },
      sunday: { open: "06:00", close: "14:00" },
    },
    metadata: {
      harvestSeason: "Kharif & Rabi 2026 Season",
      organicCertified: true,
      mandiPriceBenchmark: "Nashik APMC Grade-A Benchmark",
      fssaiLicense: "FSSAI-11524036000123",
      farmSize: "18 Acres Farm Holding",
      produceGuarantee: "100% Natural, Pesticide Free",
    },
    subscription: {
      plan: "yearly_pro",
      status: "active",
      startDate: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-10-24T00:00:00.000Z",
    },
    limits: {
      productMonthlyLimit: 200,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "store_service_01",
    storeName: "FixPro Expert Appliance Care & Repairs",
    slug: "fixpro-appliance-care",
    subdomain: "fixpro",
    entityType: "service_provider",
    storeCategory: "Services & Repairs",
    description:
      "Certified master technicians for inverter AC servicing, refrigerator repair, washing machine diagnostics, and home electrical audits. 90-day comprehensive service warranty.",
    logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
    images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
    city: "Bengaluru",
    state: "Karnataka",
    location: { latitude: 12.9352, longitude: 77.6245 },
    address: {
      area: "Koramangala 5th Block",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560095",
    },
    contact: { phone: "+916261667099", whatsapp: "+916261667099" },
    businessHours: {
      monday: { open: "08:30", close: "21:00" },
      tuesday: { open: "08:30", close: "21:00" },
      wednesday: { open: "08:30", close: "21:00" },
      thursday: { open: "08:30", close: "21:00" },
      friday: { open: "08:30", close: "21:00" },
      saturday: { open: "08:30", close: "21:00" },
      sunday: { open: "09:00", close: "18:00" },
    },
    metadata: {
      experienceYears: 12,
      licenseNumber: "KAR-EE-2018-9042",
      serviceAreas: "Koramangala, Indiranagar, HSR Layout, BTM, Bellandur",
      warrantyPolicy: "90-Day Comprehensive Warranty on parts & labor",
      emergencyService: true,
    },
    subscription: {
      plan: "yearly_standard",
      status: "active",
      startDate: "2026-03-01T00:00:00.000Z",
      expiresAt: "2027-10-24T00:00:00.000Z",
    },
    limits: {
      productMonthlyLimit: 50,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "store_0103",
    storeName: "Vastra Heritage Boutique",
    slug: "vastra-heritage-boutique",
    subdomain: "vastra",
    entityType: "shopkeeper",
    storeCategory: "Apparel & Fashion",
    description:
      "A premium apparel studio blending traditional Rajasthani craftsmanship with modern ethnic fashion. Specializing in hand-block prints, festive bridal wear, and bespoke tailoring.",
    logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
    images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
    city: "Jaipur",
    state: "Rajasthan",
    location: { latitude: 26.9184, longitude: 75.7903 },
    address: {
      area: "Johari Bazaar",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302003",
    },
    contact: { phone: "+916261667099", whatsapp: "+916261667099" },
    businessHours: {
      monday: { open: "11:00", close: "21:00" },
      tuesday: { open: "11:00", close: "21:00" },
      wednesday: { open: "11:00", close: "21:00" },
      thursday: { open: "11:00", close: "21:00" },
      friday: { open: "11:00", close: "21:00" },
      saturday: { open: "11:00", close: "21:00" },
      sunday: { open: "10:00", close: "16:00" },
    },
    metadata: {
      gstin: "08AABCV1234F1Z8",
      returnPolicy: "7 Days Hassle-Free Exchange on unworn garments",
      deliveryNotes: "Complimentary doorstep trial & custom alteration in Jaipur",
      customTailoringAvailable: true,
    },
    subscription: {
      plan: "yearly_standard",
      status: "active",
      startDate: "2026-02-15T00:00:00.000Z",
      expiresAt: "2027-10-24T00:00:00.000Z",
    },
    limits: {
      productMonthlyLimit: 50,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "store_expired_01",
    storeName: "The Vintage Attic Antiques",
    slug: "vintage-attic",
    subdomain: "vintage-attic",
    entityType: "shopkeeper",
    storeCategory: "Furniture & Home Decor",
    description:
      "Curators of colonial brass collectibles, hand-carved teakwood artifacts, and antique pendulum clocks. (Listing currently pending annual subscription renewal).",
    logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
    images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
    city: "Delhi",
    state: "Delhi",
    location: { latitude: 28.6139, longitude: 77.209 },
    address: {
      area: "Hauz Khas Village",
      city: "Delhi",
      state: "Delhi",
      pincode: "110016",
    },
    contact: { phone: "+916261667099", whatsapp: "+916261667099" },
    businessHours: {
      monday: { open: "10:00", close: "20:00" },
      tuesday: { open: "10:00", close: "20:00" },
      wednesday: { open: "10:00", close: "20:00" },
      thursday: { open: "10:00", close: "20:00" },
      friday: { open: "10:00", close: "20:00" },
      saturday: { open: "10:00", close: "20:00" },
      sunday: { open: "11:00", close: "18:00" },
    },
    metadata: {
      gstin: "07AAACR4567B1Z2",
      returnPolicy: "Antique appraisal certificate included with all orders",
      deliveryNotes: "Specialized fragile freight shipping with transit insurance",
    },
    subscription: {
      plan: "yearly_standard",
      status: "expired",
      startDate: "2025-08-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
    },
    limits: {
      productMonthlyLimit: 50,
    },
    isActive: true,
    createdAt: "2025-08-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "store_capped_01",
    storeName: "Daily Kirana & General Mart",
    slug: "daily-kirana",
    subdomain: "daily-kirana",
    entityType: "shopkeeper",
    storeCategory: "Groceries & Organics",
    description:
      "Your friendly neighborhood kirana store for fresh essentials, daily dairy, pulses, and snacks. (Operating on Starter Free Tier, quota ceiling of 15 items reached).",
    logo: "/assets/images/placeholders/storeLogoPlaceholder.svg",
    images: ["/assets/images/placeholders/storePlaceholder.jpeg"],
    city: "Indore",
    state: "Madhya Pradesh",
    location: { latitude: 22.7196, longitude: 75.8577 },
    address: {
      area: "Vijay Nagar",
      city: "Indore",
      state: "Madhya Pradesh",
      pincode: "452010",
    },
    contact: { phone: "+916261667099", whatsapp: "+916261667099" },
    businessHours: {
      monday: { open: "07:00", close: "22:00" },
      tuesday: { open: "07:00", close: "22:00" },
      wednesday: { open: "07:00", close: "22:00" },
      thursday: { open: "07:00", close: "22:00" },
      friday: { open: "07:00", close: "22:00" },
      saturday: { open: "07:00", close: "22:00" },
      sunday: { open: "07:00", close: "22:00" },
    },
    metadata: {
      gstin: "23AABCK8899P1Z9",
      deliveryNotes: "Free doorstep delivery on orders above ₹300 within 2km",
    },
    subscription: {
      plan: "starter_free",
      status: "active",
      startDate: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
    },
    limits: {
      productMonthlyLimit: 15,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * 2. Dummy Products & Services Data
 * Some items intentionally have `images: []` to test fallback SVG rendering!
 */
export const dummyProducts = [
  // --- A. FARMER PRODUCE (Kisan Organic Produce & Farms) ---
  {
    _id: "prod_farmer_01",
    storeId: "store_farmer_01",
    productName: "Certified Organic Desi Sharbati Gehun (Unpolished)",
    slug: "certified-organic-desi-sharbati-gehun",
    shortDescription: "Stone-ground golden grain wheat grown without chemical pesticides.",
    description: "Our authentic Sharbati wheat is cultivated using traditional Vedic farming methods in the fertile black soil of Nashik. High protein, natural sweetness, and perfect for soft, fluffy rotis.",
    category: "Groceries & Organics",
    subCategory: "Grains & Flours",
    brand: "Kisan Organics",
    images: [], // NO IMAGE: Showcases farmerProducePlaceholder.svg
    price: { min: 58, max: 75, currency: "INR", unit: "kg" },
    attributes: {
      "Harvest Season": "Rabi 2026",
      "Pesticide Free": "100% Certified Organic",
      "Moisture Level": "< 11.5%",
      "Mandi Benchmark": "Nashik APMC Grade-A",
    },
    tags: ["organic", "wheat", "atta", "grains", "farm-fresh"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_farmer_02",
    storeId: "store_farmer_01",
    productName: "Vedic Bilona A2 Desi Gir Cow Cultured Ghee",
    slug: "vedic-bilona-a2-desi-gir-cow-ghee",
    shortDescription: "Traditional curd-churned golden elixir from free-grazing Gir cows.",
    description: "Prepared using the ancient Bilona method: whole raw milk is set to curd, hand-churned in wooden churns at sunrise, and simmered slowly on dung-cake fire for an aromatic granular texture.",
    category: "Groceries & Organics",
    subCategory: "Dairy & Ghee",
    brand: "Kisan Organics",
    images: [
      "https://images.unsplash.com/photo-1589927986089-35812388d1f4?auto=format&fit=crop&w=600&q=80",
    ],
    price: { min: 1450, max: 1800, currency: "INR", unit: "kg" },
    attributes: {
      "Process": "Vedic Hand-Churned Bilona",
      "Source": "100% Grass-fed A2 Gir Cows",
      "Preservatives": "Zero Additives",
    },
    tags: ["a2 ghee", "bilona", "dairy", "pure", "superfood"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_farmer_03",
    storeId: "store_farmer_01",
    productName: "Direct Orchard Ratnagiri Alphonso Mangoes (Grade-1 Box)",
    slug: "direct-orchard-ratnagiri-alphonso-mangoes",
    shortDescription: "Naturally tree-ripened Alphonso mangoes with saffron pulp.",
    description: "Sourced directly from our family-managed orchards in Devgad/Ratnagiri. Never treated with synthetic carbide. Naturally matured under hay beds for rich sweetness and thin peel.",
    category: "Groceries & Organics",
    subCategory: "Fresh Fruits",
    brand: "Kisan Organics",
    images: [], // NO IMAGE: Showcases farmerProducePlaceholder.svg
    price: { min: 1100, max: 1400, currency: "INR", unit: "dozen" },
    attributes: {
      "Ripening": "100% Tree-Ripened in Grass Hay",
      "Avg Weight": "240g - 280g per fruit",
      "Chemical Treatment": "Zero Calcium Carbide",
    },
    tags: ["alphonso", "mangoes", "fresh fruits", "hapus"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_farmer_04",
    storeId: "store_farmer_01",
    productName: "Cold-Pressed Wood Churned Mustard Oil (Kachi Ghani)",
    slug: "cold-pressed-wood-churned-mustard-oil",
    shortDescription: "Single-origin pungent black mustard oil cold-pressed in wooden kolhu.",
    description: "Extracted without external heat or solvent refinement. Preserves all natural antioxidants, high pungent aroma, and omega-3 fatty acids for traditional Indian cooking and immunity.",
    category: "Groceries & Organics",
    subCategory: "Edible Oils",
    brand: "Kisan Organics",
    images: [], // NO IMAGE: Showcases farmerProducePlaceholder.svg
    price: { min: 220, max: 280, currency: "INR", unit: "liter" },
    attributes: {
      "Extraction": "Wooden Kolhu Cold-Pressed",
      "Filtration": "Double Cotton Filtered",
      "Free Fatty Acids": "< 0.8%",
    },
    tags: ["mustard oil", "kachi ghani", "cooking oil", "cold pressed"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_farmer_05",
    storeId: "store_farmer_01",
    productName: "Vine-Ripened Polyhouse Red Tomatoes (Farm Wholesale Crate)",
    slug: "vine-ripened-polyhouse-red-tomatoes-crate",
    shortDescription: "Firm, juicy salad and curry tomatoes freshly plucked daily.",
    description: "Grown in climate-controlled polyhouses using drip-fertigation. Extended shelf-life, firm pulp, and consistent acidity for commercial caterers, hotels, and retail bulk buyers.",
    category: "Groceries & Organics",
    subCategory: "Fresh Vegetables",
    brand: "Kisan Organics",
    images: [
      "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80",
    ],
    price: { min: 620, max: 750, currency: "INR", unit: "crate" },
    attributes: {
      "Crate Weight": "22kg - 24kg net",
      "Variety": "Abhinav Hybrid F1",
      "Pluck Status": "Fresh Morning Harvest",
    },
    tags: ["tomatoes", "fresh vegetables", "crate", "wholesale"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // --- B. SERVICE PROVIDER (FixPro Expert Appliance Care) ---
  {
    _id: "prod_svc_01",
    storeId: "store_service_01",
    productName: "Split & Inverter AC Deep Jet Power Foam Servicing",
    slug: "split-inverter-ac-deep-jet-power-servicing",
    shortDescription: "High-pressure jet wash for cooling coils, blower fan & drain tray.",
    description: "Thorough indoor & outdoor unit decontamination using anti-bacterial foam spray, high-pressure jet wash jacket, gas leak detection test, and electrical current audit. Restores peak 16°C cooling.",
    category: "Services & Repairs",
    subCategory: "Air Conditioner Services",
    brand: "FixPro Certified",
    images: [], // NO IMAGE: Showcases servicePlaceholder.svg
    price: { min: 599, max: 899, currency: "INR", unit: "service" },
    attributes: {
      "Service Duration": "45 - 60 Minutes",
      "Equipment": "High-Pressure Jet Washer & Anti-Fungal Foam",
      "Warranty": "60 Days Cooling Assurance",
      "Technician Tier": "Certified HVAC Specialist",
    },
    tags: ["ac service", "air conditioner", "cooling repair", "jet wash"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_svc_02",
    storeId: "store_service_01",
    productName: "Master Electrician Home Inspection & Safety Wiring Audit",
    slug: "master-electrician-home-inspection-wiring-audit",
    shortDescription: "Complete domestic electrical check, earthing test & load balancing.",
    description: "Licensed master electrician conducts a comprehensive 24-point audit: MCB distribution panel testing, earthing voltage check, thermal imaging for overheated points, and short-circuit prevention.",
    category: "Services & Repairs",
    subCategory: "Electrical Services",
    brand: "FixPro Certified",
    images: [], // NO IMAGE: Showcases servicePlaceholder.svg
    price: { min: 350, max: 500, currency: "INR", unit: "visit" },
    attributes: {
      "Service Scope": "Up to 3BHK Residence Inspection",
      "Testing Tools": "Digital Multimeter & Earth Tester",
      "Deliverable": "Digital Electrical Health Card",
    },
    tags: ["electrician", "home repair", "wiring", "inspection"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_svc_03",
    storeId: "store_service_01",
    productName: "Multi-Stage RO Water Purifier Membrane & Filter Overhaul",
    slug: "ro-water-purifier-membrane-filter-overhaul",
    shortDescription: "Sediment, Carbon, and 80 GPD RO Membrane replacement with TDS tuning.",
    description: "Complete water purifier restoration including replacement of spun sediment filter, activated carbon block, genuine Dow Filmtec RO membrane, alkaline post-carbon cartridge, and UV lamp sanitization.",
    category: "Services & Repairs",
    subCategory: "Water Purifier Repairs",
    brand: "FixPro Certified",
    images: [
      "https://images.unsplash.com/photo-1585837575652-267c041d77d4?auto=format&fit=crop&w=600&q=80",
    ],
    price: { min: 1299, max: 1699, currency: "INR", unit: "job" },
    attributes: {
      "Spare Parts": "Certified 100% Genuine NSF Rated Spares",
      "TDS Guarantee": "Targeted TDS Level (70 - 150 ppm)",
      "Warranty": "90 Days Leakage & Filtration Warranty",
    },
    tags: ["ro repair", "water purifier", "filter replacement", "technician"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_svc_04",
    storeId: "store_service_01",
    productName: "Front-Load Washing Machine Motor & Spin Drum Diagnostics",
    slug: "washing-machine-motor-spin-drum-diagnostics",
    shortDescription: "Vibration dampening, suspension shocker & spider drum repair.",
    description: "Specialized doorstep diagnosis for excessive shaking, drainage pump failure, error codes (OE, DE, UE), motor carbon brush wear, and belt alignment across Bosch, LG, Samsung & IFB washers.",
    category: "Services & Repairs",
    subCategory: "Washing Machine Repairs",
    brand: "FixPro Certified",
    images: [], // NO IMAGE: Showcases servicePlaceholder.svg
    price: { min: 799, max: 1100, currency: "INR", unit: "job" },
    attributes: {
      "Response Time": "Same-Day Within 3 Hours",
      "Supported Brands": "Bosch, LG, Samsung, Whirlpool, IFB",
      "Warranty": "90 Days Replacement Part Guarantee",
    },
    tags: ["washing machine", "appliance repair", "doorstep service"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // --- C. SHOPKEEPER BOUTIQUE (Vastra Heritage Boutique) ---
  {
    _id: "prod_shop_01",
    storeId: "store_0103",
    productName: "Hand-Block Printed Chanderi Silk Kurti with Palazzos",
    slug: "hand-block-chanderi-silk-kurti-palazzo-set",
    shortDescription: "Artisanal hand-carved teak block motifs on lustrous Chanderi silk.",
    description: "Crafted by master weavers in Sanganer using vegetable indigo dyes and delicate gold khari print. Comes with pure cotton matching flared palazzos and matching organza dupatta.",
    category: "Apparel & Fashion",
    subCategory: "Ethnic Wear",
    brand: "Vastra Couture",
    images: [
      "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80",
    ],
    price: { min: 2499, max: 3500, currency: "INR", unit: "set" },
    attributes: {
      "Fabric": "Pure Chanderi Silk & Mulmul Lining",
      "Craft": "Traditional Hand-Block Khari Print",
      "Sizes Available": "S, M, L, XL, XXL (Custom Stitching)",
    },
    tags: ["kurti", "chanderi", "ethnic wear", "handblock", "jaipuri"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_shop_02",
    storeId: "store_0103",
    productName: "Royal Bandhani Georgette Dupatta with Handcrafted Gota Patti",
    slug: "royal-bandhani-georgette-dupatta-gota-patti",
    shortDescription: "Vibrant dual-tone tie-and-dye dupatta with scalloped heritage border.",
    description: "Authentic Jamnagari tie-and-dye dots on featherweight georgette silk, bordered with elaborate silver gota work by Jaipur artisans. Perfect accompaniment for weddings and festive pujas.",
    category: "Apparel & Fashion",
    subCategory: "Dupattas & Shawls",
    brand: "Vastra Couture",
    images: [], // NO IMAGE: Showcases shopRetailPlaceholder.svg
    price: { min: 899, max: 1299, currency: "INR", unit: "piece" },
    attributes: {
      "Fabric": "Pure Viscose Georgette",
      "Border Work": "Traditional Gota Patti Scallops",
      "Length": "2.5 Meters Full Width",
    },
    tags: ["bandhani", "dupatta", "gota patti", "festive"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_shop_03",
    storeId: "store_0103",
    productName: "Sanganeri Floral Print 300TC King Size Pure Cotton Bedcover",
    slug: "sanganeri-floral-300tc-cotton-bedcover",
    shortDescription: "Export-grade 100% breathable cotton bedcover with 2 pillow shams.",
    description: "Breathable 300 thread count percale weave printed with hand-carved floral vine motifs. Fade-resistant reactive dyes that soften with every wash. Certified skin-safe.",
    category: "Apparel & Fashion",
    subCategory: "Home Furnishing",
    brand: "Vastra Home",
    images: [], // NO IMAGE: Showcases shopRetailPlaceholder.svg
    price: { min: 1499, max: 2199, currency: "INR", unit: "set" },
    attributes: {
      "Material": "100% Combed Cotton (300 Thread Count)",
      "Dimensions": "108 x 108 Inches (King Size)",
      "Set Includes": "1 King Bedcover + 2 Flanged Pillow Covers",
    },
    tags: ["bedcover", "cotton", "sanganeri", "home decor"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },

  // --- D. EXPIRED STOREFRONT (The Vintage Attic Antiques) ---
  {
    _id: "prod_exp_01",
    storeId: "store_expired_01",
    productName: "Restored 1940s His Master's Voice Brass Horn Gramophone",
    slug: "restored-1940s-hmv-brass-gramophone",
    shortDescription: "Working antique wind-up phonograph in handcrafted teak casing.",
    description: "Meticulously serviced spring-wound mechanical movement with original embossed brass morning-glory horn. Plays 78 RPM shellac records with distinct authentic analog warmth.",
    category: "Furniture & Home Decor",
    subCategory: "Antiques & Curios",
    brand: "Heritage Restorations",
    images: [], // NO IMAGE
    price: { min: 4800, max: 6500, currency: "INR", unit: "piece" },
    attributes: {
      "Era": "Circa 1940s British India",
      "Condition": "Restored Functional Mechanism",
      "Includes": "10 Steel Needles + 1 Vintage 78 RPM Record",
    },
    tags: ["antique", "gramophone", "brass", "vintage"],
    isActive: true,
    inStock: true,
    createdAt: "2025-08-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "prod_exp_02",
    storeId: "store_expired_01",
    productName: "Hand-Carved Sheesham Wood Jharokha Wall Mirror Frame",
    slug: "carved-sheesham-wood-jharokha-mirror",
    shortDescription: "Traditional Rajasthani arch window design with natural beeswax polish.",
    description: "Carved from aged Indian rosewood (Sheesham) featuring lattice jaali shutters that open to reveal a crystal-clear Saint-Gobain mirror. Heritage rustic home focal point.",
    category: "Furniture & Home Decor",
    subCategory: "Wall Decor",
    brand: "Heritage Restorations",
    images: [], // NO IMAGE
    price: { min: 1950, max: 2800, currency: "INR", unit: "piece" },
    attributes: {
      "Wood Type": "Seasoned Solid Sheesham",
      "Dimensions": "24 x 18 Inches",
      "Finish": "Walnut Matte Beeswax",
    },
    tags: ["jharokha", "mirror", "wood craft", "decor"],
    isActive: true,
    inStock: true,
    createdAt: "2025-08-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  },

  // --- E. QUOTA-CAPPED STORE (Daily Kirana - 15 items on 15 limit) ---
  ...Array.from({ length: 15 }, (_, i) => ({
    _id: `prod_capped_${String(i + 1).padStart(2, "0")}`,
    storeId: "store_capped_01",
    productName: [
      "Tata Salt Vacuum Evaporated (1kg)",
      "Aashirvaad Sharbati Whole Wheat Atta (5kg)",
      "Fortune Sunlite Refined Sunflower Oil (1L)",
      "Madhur Pure & Hygienic Sugar (1kg)",
      "Tata Sampann Unpolished Toor Dal (1kg)",
      "Everest Garam Masala Powder (100g)",
      "Catch Super Garam Masala & Haldi Combo",
      "Amul Pasteurized Table Butter (500g)",
      "Mother Dairy Cow Fresh Milk (1L Pouch)",
      "Parle-G Gold Glucose Biscuits Family Pack",
      "Britannia Good Day Butter Cookies (250g)",
      "Brooke Bond Red Label Strong CTC Tea (500g)",
      "Nescafe Classic 100% Pure Instant Coffee (50g)",
      "Dettol Original Germ Protection Bath Soap (4x125g)",
      "Surf Excel Quick Wash Detergent Powder (1kg)",
    ][i],
    slug: `daily-kirana-item-${i + 1}`,
    shortDescription: `Fresh essential household staple item #${i + 1} from Daily Kirana.`,
    description: `Guaranteed fresh stock sourced directly from authorized FMCG distributors.`,
    category: "Groceries & Organics",
    subCategory: "Daily Essentials",
    brand: "Daily Kirana Stock",
    images: i % 3 === 0 ? [] : [], // All without uploaded image to show fallbacks
    price: {
      min: [28, 290, 140, 52, 165, 88, 120, 275, 56, 40, 50, 260, 195, 180, 145][i],
      max: [30, 320, 160, 58, 185, 98, 135, 290, 60, 45, 55, 290, 220, 200, 165][i],
      currency: "INR",
      unit: "piece",
    },
    attributes: { "Pack Type": "Retail Sealed Pack", "Quality": "Grade-A Standard" },
    tags: ["kirana", "daily essential", "grocery"],
    isActive: true,
    inStock: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
];

/**
 * Guard function to prevent accidental seeding in production or without explicit consent.
 */
export function assertSeedAllowed(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Seeding is strictly prohibited in production environment (NODE_ENV=production).");
  }
  if (env.ALLOW_SEED !== "true") {
    throw new Error("Seeding requires ALLOW_SEED=true in environment.");
  }
}

/**
 * Main Seeding Routine
 */
export async function runSeed(options = {}) {
  const env = options.env || process.env;
  assertSeedAllowed(env);

  console.log("\n==========================================================");
  console.log("   BharatShopy: Dynamic Profile & Catalog Seeder Script   ");
  console.log("==========================================================\n");

  // 1. Sync Mock Data Files on Disk (Guarantees local & SSR availability)
  const storesPath = path.join(serverRoot, "src", "data", "mockData", "stores.js");
  const productsPath = path.join(serverRoot, "src", "data", "mockData", "products.js");

  try {
    let existingStores = [];
    if (fs.existsSync(storesPath)) {
      const storesModule = await import(`file://${storesPath}?t=${Date.now()}`);
      existingStores = storesModule.default || [];
    }

    let existingProducts = [];
    if (fs.existsSync(productsPath)) {
      const productsModule = await import(`file://${productsPath}?t=${Date.now()}`);
      existingProducts = productsModule.default || [];
    }

    // Merge: Filter out existing items with our dummy IDs and prepend our rich profiles
    const dummyStoreIds = new Set(dummyStores.map((s) => s._id));
    const mergedStores = [
      ...dummyStores,
      ...existingStores.filter((s) => !dummyStoreIds.has(s._id)),
    ];

    const dummyProductIds = new Set(dummyProducts.map((p) => p._id));
    const mergedProducts = [
      ...dummyProducts,
      ...existingProducts.filter((p) => !dummyProductIds.has(p._id)),
    ];

    fs.writeFileSync(
      storesPath,
      `const stores = ${JSON.stringify(mergedStores, null, 2)};\n\nexport default stores;\n`
    );
    console.log(`✓ Synchronized ${mergedStores.length} stores into mockData/stores.js`);

    fs.writeFileSync(
      productsPath,
      `const products = ${JSON.stringify(mergedProducts, null, 2)};\n\nexport default products;\n`
    );
    console.log(`✓ Synchronized ${mergedProducts.length} products into mockData/products.js`);
  } catch (err) {
    console.warn("⚠️ Warning writing mock data files:", err.message);
  }

  // 2. Connect to MongoDB if MONGO_URI is defined
  const mongoUri = process.env.MONGO_URI;
  if (mongoUri && !mongoUri.includes("<username>")) {
    try {
      console.log("\nConnecting to MongoDB at:", mongoUri.split("@")[1] || mongoUri);
      await mongoose.connect(mongoUri);
      console.log("✓ Connected to MongoDB successfully.");

      const db = mongoose.connection.db;
      const storesCol = db.collection("stores");
      const productsCol = db.collection("products");

      for (const s of dummyStores) {
        await storesCol.updateOne({ _id: s._id }, { $set: s }, { upsert: true });
      }
      console.log(`✓ Upserted ${dummyStores.length} dummy stores to MongoDB 'stores' collection.`);

      for (const p of dummyProducts) {
        await productsCol.updateOne({ _id: p._id }, { $set: p }, { upsert: true });
      }
      console.log(`✓ Upserted ${dummyProducts.length} dummy items to MongoDB 'products' collection.`);

      const locationsCol = db.collection("locations");
      for (const loc of locations) {
        await locationsCol.updateOne({ id: loc.id }, { $set: loc }, { upsert: true });
      }
      console.log(`✓ Upserted ${locations.length} locations to MongoDB 'locations' collection.`);

      await mongoose.disconnect();
      console.log("✓ MongoDB disconnected cleanly.");
    } catch (dbErr) {
      console.warn("ℹ Note: MongoDB connection skipped or failed (" + dbErr.message + "). Mock data remains fully populated.");
    }
  } else {
    console.log("\nℹ Note: No valid MONGO_URI configured in .env. Mock datasets populated for instant offline testing.");
  }

  // 3. Print Summary Table
  console.log("\n----------------------------------------------------------");
  console.log("             DUMMY PROFILES CREATED BY SCRIPT             ");
  console.log("----------------------------------------------------------");
  dummyStores.forEach((store) => {
    const prods = dummyProducts.filter((p) => p.storeId === store._id);
    const noImageCount = prods.filter((p) => !p.images || p.images.length === 0).length;
    console.log(`• Store: ${store.storeName}`);
    console.log(`  - ID: ${store._id}`);
    console.log(`  - Subdomain: ${store.subdomain} (e.g. http://${store.subdomain}.localhost:5173 or /shop/${store.slug})`);
    console.log(`  - Entity Type: ${store.entityType}`);
    console.log(`  - Subscription: ${store.subscription?.plan} [${store.subscription?.status}]`);
    console.log(`  - Total Items: ${prods.length} (${noImageCount} without image -> testing fallback SVGs)`);
    console.log("");
  });
  console.log("All dummy profiles and catalog items seeded successfully!\n");
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    process.argv[1].endsWith("seedDummyProfiles.js"));

if (isDirectRun) {
  runSeed().catch((err) => {
    console.error("Fatal seed script error:", err.message);
    process.exit(1);
  });
}
