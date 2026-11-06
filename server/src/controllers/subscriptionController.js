import mongoose from "mongoose";
import { defaultPlans, calculateDiscount } from "../data/mockData/subscriptionPlans.js";

// In-memory fallback stores for subscription requests when DB collection is simulated
let inMemoryRequests = [];
let inMemoryPlans = [...defaultPlans];

/**
 * Returns available subscription plans for vendors.
 */
export async function getSubscriptionPlans(req, res) {
  try {
    const plansCollection = mongoose.connection?.db?.collection("subscription_plans");
    let plansData = [];

    if (plansCollection) {
      plansData = await plansCollection.find({ isActive: true }).toArray();
    }

    if (!plansData || plansData.length === 0) {
      plansData = inMemoryPlans.filter((p) => p.isActive !== false);
    }

    // Ensure discount percentage is always up to date
    const formattedPlans = plansData.map((plan) => ({
      ...plan,
      discountPercentage: calculateDiscount(plan.originalPrice, plan.discountedPrice),
    }));

    return res.json({ plans: formattedPlans });
  } catch (error) {
    console.error("getSubscriptionPlans error:", error);
    return res.status(500).json({ message: "Failed to load plans", error: error.message });
  }
}

/**
 * Returns detailed subscription status, quotas, and request history for a store.
 */
export async function getStoreSubscriptionInfo(req, res) {
  try {
    const { storeId } = req.params;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    let store = null;

    if (storesCollection) {
      const normalized = storeId.trim().toLowerCase();
      store = await storesCollection.findOne({
        $or: [{ _id: storeId }, { slug: normalized }, { subdomain: normalized }],
      });
    }

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // Default subscription values if store record was created before subscription schema
    const subscription = store.subscription || {
      plan: "yearly_standard",
      status: "active",
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    };

    const limits = store.limits || {
      productMonthlyLimit: 50,
      maxImagesPerProduct: 8,
    };

    const expiresAtDate = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const now = new Date();
    const isExpired = expiresAtDate ? expiresAtDate <= now : false;

    // Days remaining calculation
    let daysRemaining = 0;
    if (expiresAtDate && !isExpired) {
      daysRemaining = Math.max(0, Math.ceil((expiresAtDate - now) / (1000 * 60 * 60 * 24)));
    }

    // Effective live status
    const effectiveStatus = isExpired ? "expired" : subscription.status || "active";

    // Count products
    const productsCollection = mongoose.connection?.db?.collection("products");
    let totalProducts = 0;
    if (productsCollection) {
      totalProducts = await productsCollection.countDocuments({ storeId: store._id });
    }

    // Fetch store's subscription requests
    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    let storeRequests = [];
    if (requestsCollection) {
      storeRequests = await requestsCollection
        .find({ storeId: store._id })
        .sort({ createdAt: -1 })
        .toArray();
    } else {
      storeRequests = inMemoryRequests.filter((r) => r.storeId === store._id);
    }

    return res.json({
      storeId: store._id,
      storeName: store.storeName,
      subscription: {
        ...subscription,
        status: effectiveStatus,
        daysRemaining,
        isExpired,
      },
      limits,
      usage: {
        totalProducts,
        limit: limits.productMonthlyLimit || 50,
        remaining: Math.max(0, (limits.productMonthlyLimit || 50) - totalProducts),
        percentageUsed: Math.min(
          100,
          Math.round((totalProducts / (limits.productMonthlyLimit || 50)) * 100)
        ),
      },
      requests: storeRequests,
    });
  } catch (error) {
    console.error("getStoreSubscriptionInfo error:", error);
    return res.status(500).json({ message: "Failed to load subscription info", error: error.message });
  }
}

/**
 * Vendor submits an activation or renewal request for a chosen plan.
 */
export async function submitSubscriptionRequest(req, res) {
  try {
    const { storeId } = req.params;
    const { planId, vendorNote = "" } = req.body;

    if (!planId) {
      return res.status(400).json({ message: "Plan selection is required" });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    const normalized = storeId.trim().toLowerCase();
    const store = await storesCollection?.findOne({
      $or: [{ _id: storeId }, { slug: normalized }, { subdomain: normalized }],
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const selectedPlan = inMemoryPlans.find((p) => p.planId === planId) || defaultPlans[1];

    const newRequest = {
      _id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      storeId: store._id,
      storeName: store.storeName,
      selectedPlan: selectedPlan.planId,
      planName: selectedPlan.name,
      originalPrice: selectedPlan.originalPrice,
      discountedPrice: selectedPlan.discountedPrice,
      billingCycle: selectedPlan.billingCycle,
      productMonthlyLimit: selectedPlan.productMonthlyLimit,
      vendorNote: vendorNote.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      adminNotes: "",
    };

    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    if (requestsCollection) {
      await requestsCollection.insertOne(newRequest);
    } else {
      inMemoryRequests.unshift(newRequest);
    }

    // Set store's pending payment reference
    if (storesCollection) {
      await storesCollection.updateOne(
        { _id: store._id },
        {
          $set: {
            "subscription.lastPaymentRequestId": newRequest._id,
            updatedAt: new Date().toISOString(),
          },
        }
      );
    }

    return res.status(201).json({
      message: "Subscription activation request submitted successfully. Awaiting admin approval.",
      request: newRequest,
    });
  } catch (error) {
    console.error("submitSubscriptionRequest error:", error);
    return res.status(500).json({ message: "Failed to submit request", error: error.message });
  }
}

/**
 * Admin: List all subscription requests with optional status filter.
 */
export async function getAdminPaymentRequests(req, res) {
  try {
    const { status } = req.query;
    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    let requests = [];

    if (requestsCollection) {
      const query = status && status !== "all" ? { status } : {};
      requests = await requestsCollection.find(query).sort({ createdAt: -1 }).toArray();
    } else {
      requests = status && status !== "all"
        ? inMemoryRequests.filter((r) => r.status === status)
        : [...inMemoryRequests];
    }

    const counts = {
      all: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };

    return res.json({ requests, counts });
  } catch (error) {
    console.error("getAdminPaymentRequests error:", error);
    return res.status(500).json({ message: "Failed to load requests", error: error.message });
  }
}

/**
 * Admin: 1-Click Approve (+365 days) or Reject subscription request.
 */
export async function verifyPaymentRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { action, adminNotes = "", durationDays = 365 } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'approve' or 'reject'" });
    }

    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    let request = null;

    if (requestsCollection) {
      request = await requestsCollection.findOne({ _id: requestId });
    } else {
      request = inMemoryRequests.find((r) => r._id === requestId);
    }

    if (!request) {
      return res.status(404).json({ message: "Subscription request not found" });
    }

    const now = new Date();
    const isApproval = action === "approve";

    if (isApproval) {
      const selectedPlan =
        inMemoryPlans.find((p) => p.planId === request.selectedPlan) || defaultPlans[1];

      const expiresAt = new Date(now.getTime() + durationDays * 86400000).toISOString();

      const storesCollection = mongoose.connection?.db?.collection("stores");
      if (storesCollection) {
        await storesCollection.updateOne(
          { _id: request.storeId },
          {
            $set: {
              "subscription.plan": request.selectedPlan,
              "subscription.status": "active",
              "subscription.startDate": now.toISOString(),
              "subscription.expiresAt": expiresAt,
              "subscription.lastPaymentReceivedDate": now.toISOString(),
              "limits.productMonthlyLimit": selectedPlan.productMonthlyLimit || 50,
              "limits.maxImagesPerProduct": selectedPlan.maxImagesPerProduct || 8,
              isActive: true,
              updatedAt: now.toISOString(),
            },
          }
        );
      }

      const updateData = {
        status: "approved",
        verifiedAt: now.toISOString(),
        adminNotes: adminNotes || "Approved by Administrator (+365 days activated)",
        durationDays,
        activatedExpiresAt: expiresAt,
      };

      if (requestsCollection) {
        await requestsCollection.updateOne({ _id: requestId }, { $set: updateData });
      }
      Object.assign(request, updateData);

      return res.json({
        message: `Subscription approved! Store is now active until ${new Date(expiresAt).toLocaleDateString()}.`,
        request,
      });
    } else {
      // Rejection
      const updateData = {
        status: "rejected",
        verifiedAt: now.toISOString(),
        adminNotes: adminNotes || "Payment could not be verified.",
      };

      if (requestsCollection) {
        await requestsCollection.updateOne({ _id: requestId }, { $set: updateData });
      }
      Object.assign(request, updateData);

      return res.json({
        message: "Subscription request rejected.",
        request,
      });
    }
  } catch (error) {
    console.error("verifyPaymentRequest error:", error);
    return res.status(500).json({ message: "Verification failed", error: error.message });
  }
}

/**
 * Admin: Direct Renew a store (+365 days).
 */
export async function adminDirectRenew(req, res) {
  try {
    const { storeId } = req.params;
    const { planId = "yearly_standard", durationDays = 365, adminNotes = "" } = req.body;

    const storesCollection = mongoose.connection?.db?.collection("stores");
    const normalized = storeId.trim().toLowerCase();
    const store = await storesCollection?.findOne({
      $or: [{ _id: storeId }, { slug: normalized }, { subdomain: normalized }],
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const selectedPlan = inMemoryPlans.find((p) => p.planId === planId) || defaultPlans[1];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 86400000).toISOString();

    if (storesCollection) {
      await storesCollection.updateOne(
        { _id: store._id },
        {
          $set: {
            "subscription.plan": selectedPlan.planId,
            "subscription.status": "active",
            "subscription.startDate": now.toISOString(),
            "subscription.expiresAt": expiresAt,
            "subscription.lastPaymentReceivedDate": now.toISOString(),
            "limits.productMonthlyLimit": selectedPlan.productMonthlyLimit || 50,
            isActive: true,
            updatedAt: now.toISOString(),
          },
        }
      );
    }

    return res.json({
      message: `Store subscription directly renewed (+${durationDays} days) under ${selectedPlan.name}.`,
      expiresAt,
      status: "active",
    });
  } catch (error) {
    console.error("adminDirectRenew error:", error);
    return res.status(500).json({ message: "Renewal failed", error: error.message });
  }
}

/**
 * Admin: Direct Discontinue a store (immediately sets subscription to expired).
 */
export async function adminDirectDiscontinue(req, res) {
  try {
    const { storeId } = req.params;
    const storesCollection = mongoose.connection?.db?.collection("stores");
    const normalized = storeId.trim().toLowerCase();
    const store = await storesCollection?.findOne({
      $or: [{ _id: storeId }, { slug: normalized }, { subdomain: normalized }],
    });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const now = new Date();

    if (storesCollection) {
      await storesCollection.updateOne(
        { _id: store._id },
        {
          $set: {
            "subscription.status": "expired",
            "subscription.expiresAt": now.toISOString(),
            updatedAt: now.toISOString(),
          },
        }
      );
    }

    return res.json({
      message: "Subscription discontinued. Products are now shielded from public discovery.",
      status: "expired",
    });
  } catch (error) {
    console.error("adminDirectDiscontinue error:", error);
    return res.status(500).json({ message: "Discontinuation failed", error: error.message });
  }
}
