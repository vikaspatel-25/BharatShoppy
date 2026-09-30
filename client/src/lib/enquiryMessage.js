export function buildEnquiryMessage(store, cart, userNote = "") {
  if (!store || !cart || cart.length === 0) return "";

  const storeLocation = [store.address?.area, store.city]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "🛍️ *NEW INQUIRY VIA BHARATSHOPPY*",
    `🏪 *Store:* ${store.storeName}`,
    storeLocation ? `📍 *Location:* ${storeLocation}` : "",
    "",
    `Hello ${store.storeName}, I would like to inquire about the following ${cart.length} item(s) from your shop on BharatShoppy:`,
    "──────────────────────────",
  ];

  let totalEst = 0;
  let totalUnits = 0;

  cart.forEach((item, index) => {
    const p = item.product;
    const qty = item.quantity;
    const minPrice = p.price?.min || 0;
    const unit = p.price?.unit || "piece";
    const subtotal = minPrice * qty;
    totalEst += subtotal;
    totalUnits += qty;

    const priceText =
      minPrice > 0
        ? `₹${minPrice.toLocaleString("en-IN")}/${unit}`
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
    lines.push(
      `💰 *Estimated Total Value:* ₹${totalEst.toLocaleString("en-IN")}`
    );
  }

  if (userNote && userNote.trim()) {
    lines.push("");
    lines.push(`📝 *Customer Request / Note:* "${userNote.trim()}"`);
  }

  lines.push("");
  lines.push(
    "Please confirm current stock availability, best offered price/discounts, and pickup or delivery details. Thank you!"
  );

  return lines.filter((line) => line !== null).join("\n");
}
