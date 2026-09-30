import { useState, useEffect, useCallback, useMemo } from "react";

function getStorageKey(storeId) {
  return `bharatshoppy_cart_${storeId}`;
}

import { buildEnquiryMessage } from "../lib/enquiryMessage.js";
export { buildEnquiryMessage };

export function useStoreCart(storeId) {
  const [cart, setCart] = useState(() => {
    if (!storeId || typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(getStorageKey(storeId));
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load store cart from localStorage", e);
      return [];
    }
  });

  // Reload cart whenever storeId changes
  useEffect(() => {
    if (!storeId || typeof window === "undefined") {
      setCart([]);
      return;
    }
    try {
      const stored = localStorage.getItem(getStorageKey(storeId));
      setCart(stored ? JSON.parse(stored) : []);
    } catch (e) {
      console.error("Failed to read store cart", e);
      setCart([]);
    }
  }, [storeId]);

  // Persist cart to localStorage
  const saveCart = useCallback(
    (newCart) => {
      setCart(newCart);
      if (!storeId || typeof window === "undefined") return;
      try {
        if (newCart.length === 0) {
          localStorage.removeItem(getStorageKey(storeId));
        } else {
          localStorage.setItem(getStorageKey(storeId), JSON.stringify(newCart));
        }
      } catch (e) {
        console.error("Failed to persist store cart", e);
      }
    },
    [storeId]
  );

  const addToCart = useCallback(
    (product, quantity = 1) => {
      if (!product?._id) return;
      setCart((currentCart) => {
        const existingIndex = currentCart.findIndex(
          (item) => item.product._id === product._id
        );
        let updated;
        if (existingIndex > -1) {
          updated = [...currentCart];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
        } else {
          updated = [...currentCart, { product, quantity }];
        }
        if (storeId && typeof window !== "undefined") {
          try {
            localStorage.setItem(
              getStorageKey(storeId),
              JSON.stringify(updated)
            );
          } catch (e) {
            console.error("Failed to save to localStorage", e);
          }
        }
        return updated;
      });
    },
    [storeId]
  );

  const updateQuantity = useCallback(
    (productId, quantity) => {
      setCart((currentCart) => {
        let updated;
        if (quantity <= 0) {
          updated = currentCart.filter(
            (item) => item.product._id !== productId
          );
        } else {
          updated = currentCart.map((item) =>
            item.product._id === productId ? { ...item, quantity } : item
          );
        }
        if (storeId && typeof window !== "undefined") {
          try {
            if (updated.length === 0) {
              localStorage.removeItem(getStorageKey(storeId));
            } else {
              localStorage.setItem(
                getStorageKey(storeId),
                JSON.stringify(updated)
              );
            }
          } catch (e) {
            console.error("Failed to save to localStorage", e);
          }
        }
        return updated;
      });
    },
    [storeId]
  );

  const removeFromCart = useCallback(
    (productId) => {
      updateQuantity(productId, 0);
    },
    [updateQuantity]
  );

  const clearCart = useCallback(() => {
    saveCart([]);
  }, [saveCart]);

  const getQuantity = useCallback(
    (productId) => {
      const item = cart.find((i) => i.product._id === productId);
      return item ? item.quantity : 0;
    },
    [cart]
  );

  const totalCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cart]);

  const totalEstimatedPrice = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product?.price?.min || 0;
      return sum + price * (item.quantity || 1);
    }, 0);
  }, [cart]);

  const sendWhatsAppEnquiry = useCallback(
    (store, userNote = "") => {
      if (!store?.contact?.whatsapp) {
        return false;
      }
      const rawNumber = store.contact.whatsapp.replace(/\D/g, "");
      const whatsappNumber =
        rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;

      const message = buildEnquiryMessage(store, cart, userNote);
      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        message
      )}`;

      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    },
    [cart]
  );

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getQuantity,
    totalCount,
    totalEstimatedPrice,
    sendWhatsAppEnquiry,
  };
}
