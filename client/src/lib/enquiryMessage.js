import { getEntityConfig } from "./entityTypes.js";

export function buildEnquiryMessage(store, cart, userNote = "") {
  if (!store || !cart || cart.length === 0) return "";

  const entityConfig = getEntityConfig(store.entityType);

  const storeLocation = [store.address?.area, store.city]
    .filter(Boolean)
    .join(", ");

  let headerBanner = "🛍️ *NEW INQUIRY VIA BHARATSHOPY*";
  let greetingIntro = `Hello ${store.storeName}, I would like to inquire about the following ${cart.length} item(s) from your shop on BharatShopy:`;

  if (store.entityType === "farmer") {
    headerBanner = "🌾 *NEW FARM PRODUCE INQUIRY VIA BHARATSHOPY*";
    greetingIntro = `Hello ${store.storeName}, I would like to inquire about purchasing fresh harvest/produce from your farm via BharatShopy:`;
  } else if (store.entityType === "service_provider") {
    headerBanner = "🛠️ *NEW SERVICE INQUIRY VIA BHARATSHOPY*";
    greetingIntro = `Hello ${store.storeName}, I would like to inquire about booking/consultation for the following service(s) on BharatShopy:`;
  }

  const lines = [
    headerBanner,
    `🏪 *Store:* ${store.storeName}`,
    storeLocation ? `📍 *Location:* ${storeLocation}` : "",
    "",
    greetingIntro,
    "──────────────────────────",
  ];

  let totalEst = 0;
  let totalUnits = 0;

  cart.forEach((item, index) => {
    const p = item.product;
    const qty = item.quantity;
    const minPrice = p.price?.min || p.price || 0;
    const unit = p.price?.unit || p.unit || entityConfig.defaultUnit || "piece";
    const subtotal = (typeof minPrice === "number" ? minPrice : 0) * qty;
    totalEst += subtotal;
    totalUnits += qty;

    const priceText =
      minPrice > 0
        ? `₹${Number(minPrice).toLocaleString("en-IN")}/${unit}`
        : "Price on request";
    const subtotalText =
      minPrice > 0 ? ` [Est. ₹${subtotal.toLocaleString("en-IN")}]` : "";

    lines.push(`${index + 1}️⃣ *${p.productName}*`);
    lines.push(`   • Qty: *${qty} ${unit}*`);
    lines.push(`   • Price: ${priceText}${subtotalText}`);
    if (p.brand) {
      lines.push(`   • Brand: ${p.brand}`);
    }
    if (typeof window !== "undefined" && window.location?.origin && p._id) {
      lines.push(`   • Link: ${window.location.origin}/product/${p._id}`);
    }
    lines.push("");
  });

  lines.push("──────────────────────────");
  lines.push(`📦 *Total Items Count:* ${totalUnits} unit(s)`);
  if (totalEst > 0) {
    lines.push(`💰 *Estimated Total:* ~₹${totalEst.toLocaleString("en-IN")}`);
  }

  if (userNote && userNote.trim()) {
    lines.push("");
    lines.push(`📝 *Customer Request / Note:* "${userNote.trim()}"`);
  }

  lines.push("");
  lines.push("⚡ Sent directly via BharatShopy Storefront");

  return lines.filter((line) => line !== null && line !== undefined).join("\n");
}
