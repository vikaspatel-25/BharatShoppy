import mongoose from "mongoose";
import { defaultPlans, calculateDiscount } from "../data/mockData/subscriptionPlans.js";
import { resolveStoreByIdentifier } from "../middleware/authMiddleware.js";
import { findVendorByStoreId } from "./vendorAuthController.js";
import {
  sendSubscriptionActivationEmail,
  sendSubscriptionDiscontinuationEmail,
  sendRenewalReminderEmail,
} from "../services/emailService.js";

async function resolveVendorEmailForStore(store) {
  if (store?.contact?.email) return store.contact.email;
  if (store?._id) {
    const vendor = await findVendorByStoreId(store._id);
    if (vendor?.email) return vendor.email;
  }
  return null;
}

// In-memory fallback stores for subscription requests when DB collection is simulated
let inMemoryRequests = [];
let inMemoryPlans = [...defaultPlans];

export function resetInMemorySubscriptionRequests() {
  inMemoryRequests = [];
}

export function setInMemorySubscriptionRequest(req) {
  inMemoryRequests.push(req);
}

export function getInMemorySubscriptionRequests() {
  return inMemoryRequests;
}

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
    return res.status(500).json({ message: "Failed to load plans." });
  }
}

/**
 * Returns detailed subscription status, quotas, and request history for a store.
 */
export async function getStoreSubscriptionInfo(req, res) {
  try {
    const { storeId } = req.params;
    if (!storeId && !req.store) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    let store = req.store || (await resolveStoreByIdentifier(storeId));

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

    // Count active products only
    const productsCollection = mongoose.connection?.db?.collection("products");
    let totalProducts = 0;
    if (productsCollection) {
      totalProducts = await productsCollection.countDocuments({
        storeId: store._id,
        isActive: { $ne: false },
      });
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

    // Match plan metadata
    const activePlan =
      inMemoryPlans.find((p) => p.planId === subscription.plan) || defaultPlans[1];

    return res.json({
      subscription: {
        ...subscription,
        effectiveStatus,
        daysRemaining,
        planDetails: activePlan,
      },
      limits: {
        productMonthlyLimit: limits.productMonthlyLimit || activePlan.productMonthlyLimit,
        maxImagesPerProduct: limits.maxImagesPerProduct || activePlan.maxImagesPerProduct,
        currentProductCount: totalProducts,
        isUploadQuotaReached: totalProducts >= (limits.productMonthlyLimit || activePlan.productMonthlyLimit),
      },
      recentRequests: storeRequests.slice(0, 5),
    });
  } catch (error) {
    console.error("getStoreSubscriptionInfo error:", error);
    return res.status(500).json({ message: "Failed to load subscription info." });
  }
}

/**
 * Vendor submits offline subscription activation/renewal request.
 */
export async function submitSubscriptionRequest(req, res) {
  try {
    const { storeId } = req.params;
    const { planId, vendorNote = "" } = req.body || {};

    if (!planId || typeof planId !== "string") {
      return res.status(400).json({ message: "Plan selection is required" });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    let store = req.store || (await resolveStoreByIdentifier(storeId));

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // 1. Unknown plan check (reject with 400 instead of falling back to defaultPlans[1])
    const selectedPlan = inMemoryPlans.find((p) => p.planId === planId);
    if (!selectedPlan) {
      return res.status(400).json({ message: `Unknown subscription plan '${planId}'` });
    }

    // 2. Prevent duplicate pending requests for a store
    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    if (requestsCollection) {
      const existingPending = await requestsCollection.findOne({
        storeId: store._id,
        status: "pending",
      });
      if (existingPending) {
        return res.status(409).json({
          message: "A subscription request is already pending approval for this store.",
        });
      }
    } else {
      const existingPending = inMemoryRequests.find(
        (r) => r.storeId === store._id && r.status === "pending"
      );
      if (existingPending) {
        return res.status(409).json({
          message: "A subscription request is already pending approval for this store.",
        });
      }
    }

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
      vendorNote: typeof vendorNote === "string" ? vendorNote.trim() : "",
      status: "pending",
      createdAt: new Date().toISOString(),
      verifiedAt: null,
      adminNotes: "",
    };

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
    return res.status(500).json({ message: "Failed to submit subscription request." });
  }
}

/**
 * Admin: View all subscription requests.
 */
export async function getAdminPaymentRequests(req, res) {
  try {
    const { status } = req.query;
    const requestsCollection = mongoose.connection?.db?.collection("subscription_requests");
    let requests = [];

    if (requestsCollection) {
      const filter = status ? { status } : {};
      requests = await requestsCollection.find(filter).sort({ createdAt: -1 }).toArray();
    } else {
      requests = status
        ? inMemoryRequests.filter((r) => r.status === status)
        : [...inMemoryRequests];
    }

    const formattedRequests = requests.map((r) => ({
      requestId: r._id,
      storeId: r.storeId,
      storeName: r.storeName,
      planId: r.selectedPlan,
      planName: r.planName,
      amount: r.discountedPrice,
      vendorNote: r.vendorNote,
      status: r.status,
      createdAt: r.createdAt,
      verifiedAt: r.verifiedAt,
      adminNotes: r.adminNotes,
    }));

    return res.json({ requests: formattedRequests });
  } catch (error) {
    console.error("getAdminPaymentRequests error:", error);
    return res.status(500).json({ message: "Failed to fetch requests." });
  }
}

/**
 * Admin: 1-Click Approve (+durationDays) or Reject subscription request.
 */
export async function verifyPaymentRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { action, adminNotes = "", durationDays = 365 } = req.body || {};

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

    // 1. Atomically change requests from pending only, and return 409 otherwise
    if (request.status !== "pending") {
      return res.status(409).json({
        message: `Cannot ${action} request with status '${request.status}'. Only pending requests can be processed.`,
      });
    }

    const isApproval = action === "approve";

    if (isApproval) {
      // 2. Validate durationDays: integer between 1 and 366
      const days = Number(durationDays);
      if (!Number.isInteger(days) || days < 1 || days > 366) {
        return res.status(400).json({
          message: "durationDays must be an integer between 1 and 366",
        });
      }

      // 3. Return 400 for unknown plan
      const selectedPlan = inMemoryPlans.find((p) => p.planId === request.selectedPlan);
      if (!selectedPlan) {
        return res.status(400).json({
          message: `Unknown plan '${request.selectedPlan}'`,
        });
      }

      // 4. Early renewal: extend from the later of now and current expiry
      const now = new Date();
      let currentExpiry = 0;

      const storesCollection = mongoose.connection?.db?.collection("stores");
      let store = null;
      if (storesCollection) {
        store = await storesCollection.findOne({ _id: request.storeId });
      }
      if (!store) {
        store = await resolveStoreByIdentifier(request.storeId);
      }

      if (store?.subscription?.expiresAt) {
        const parsedExpiry = new Date(store.subscription.expiresAt).getTime();
        if (!isNaN(parsedExpiry)) {
          currentExpiry = parsedExpiry;
        }
      }

      const baseTime = Math.max(now.getTime(), currentExpiry);
      const expiresAt = new Date(baseTime + days * 86400000).toISOString();

      const updateData = {
        status: "approved",
        verifiedAt: now.toISOString(),
        adminNotes: adminNotes || `Approved by Administrator (+${days} days activated)`,
        durationDays: days,
        activatedExpiresAt: expiresAt,
      };

      // 1. Claim the request record first: atomically transition from pending
      if (requestsCollection) {
        const updateResult = await requestsCollection.updateOne(
          { _id: requestId, status: "pending" },
          { $set: updateData }
        );
        if (updateResult.matchedCount === 0) {
          return res.status(409).json({
            message: "Subscription request was already processed or is no longer pending.",
          });
        }
      } else {
        const reqRecord = inMemoryRequests.find((r) => r._id === requestId || r.id === requestId);
        if (reqRecord?.status !== "pending") {
          return res.status(409).json({
            message: "Subscription request was already processed or is no longer pending.",
          });
        }
        Object.assign(request, updateData);
      }

      // 2. Only after successfully claiming the request, activate/extend the store subscription
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

      if (store) {
        store.subscription = store.subscription || {};
        store.subscription.plan = request.selectedPlan;
        store.subscription.status = "active";
        store.subscription.startDate = now.toISOString();
        store.subscription.expiresAt = expiresAt;
        store.limits = store.limits || {};
        store.limits.productMonthlyLimit = selectedPlan.productMonthlyLimit || 50;
        store.limits.maxImagesPerProduct = selectedPlan.maxImagesPerProduct || 8;
        store.isActive = true;
      }

      Object.assign(request, updateData);

      // Send activation notification with failure handling
      let emailWarning = null;
      const vendorEmail = await resolveVendorEmailForStore(store);
      if (vendorEmail) {
        try {
          await sendSubscriptionActivationEmail(vendorEmail, {
            storeName: store?.storeName || request.storeName || "Store",
            planName: selectedPlan.name,
            durationDays: days,
            expiresAt,
          });
        } catch (emailErr) {
          console.error("Failed to send subscription activation email:", emailErr);
          emailWarning =
            "Subscription was activated in the database, but the notification email failed to deliver. You can resend it.";
        }
      }

      return res.json({
        success: true,
        message: emailWarning
          ? `Subscription approved (+${days} days), but notification email delivery failed.`
          : `Subscription approved! Store is now active until ${new Date(expiresAt).toLocaleDateString()}.`,
        warning: emailWarning,
        emailFailed: Boolean(emailWarning),
        request,
        resendEndpoint: `/api/admin/store/${request.storeId}/resend-subscription-email`,
      });
    } else {
      // Rejection
      const now = new Date().toISOString();
      const updateData = {
        status: "rejected",
        verifiedAt: now,
        adminNotes: adminNotes || "Payment could not be verified.",
      };

      if (requestsCollection) {
        const updateResult = await requestsCollection.updateOne(
          { _id: requestId, status: "pending" },
          { $set: updateData }
        );
        if (updateResult.matchedCount === 0) {
          return res.status(409).json({
            message: "Subscription request was already processed or is no longer pending.",
          });
        }
      } else {
        const reqRecord = inMemoryRequests.find((r) => r._id === requestId || r.id === requestId);
        if (reqRecord?.status !== "pending") {
          return res.status(409).json({
            message: "Subscription request was already processed or is no longer pending.",
          });
        }
        Object.assign(request, updateData);
      }

      Object.assign(request, updateData);

      return res.json({
        message: "Subscription request rejected.",
        request,
      });
    }
  } catch (error) {
    console.error("verifyPaymentRequest error:", error);
    return res.status(500).json({ message: "Verification failed." });
  }
}

/**
 * Admin: Direct Renew a store (+durationDays).
 */
export async function adminDirectRenew(req, res) {
  try {
    const { storeId } = req.params;
    const { planId = "yearly_standard", durationDays = 365, adminNotes = "" } = req.body || {};

    // 1. Validate durationDays: integer between 1 and 366
    const days = Number(durationDays);
    if (!Number.isInteger(days) || days < 1 || days > 366) {
      return res.status(400).json({
        message: "durationDays must be an integer between 1 and 366",
      });
    }

    // 2. Validate plan: return 400 for unknown plan
    const selectedPlan = inMemoryPlans.find((p) => p.planId === planId);
    if (!selectedPlan) {
      return res.status(400).json({
        message: `Unknown plan '${planId}'`,
      });
    }

    const storesCollection = mongoose.connection?.db?.collection("stores");
    let store = req.store || (await resolveStoreByIdentifier(storeId));

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    // 3. Early renewal: extend from the later of now and current expiry
    const now = new Date();
    let currentExpiry = 0;
    if (store.subscription?.expiresAt) {
      const parsedExpiry = new Date(store.subscription.expiresAt).getTime();
      if (!isNaN(parsedExpiry)) {
        currentExpiry = parsedExpiry;
      }
    }

    const baseTime = Math.max(now.getTime(), currentExpiry);
    const expiresAt = new Date(baseTime + days * 86400000).toISOString();

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
            "limits.maxImagesPerProduct": selectedPlan.maxImagesPerProduct || 8,
            isActive: true,
            updatedAt: now.toISOString(),
          },
        }
      );
    }

    store.subscription = store.subscription || {};
    store.subscription.plan = selectedPlan.planId;
    store.subscription.status = "active";
    store.subscription.startDate = now.toISOString();
    store.subscription.expiresAt = expiresAt;
    store.limits = store.limits || {};
    store.limits.productMonthlyLimit = selectedPlan.productMonthlyLimit || 50;
    store.limits.maxImagesPerProduct = selectedPlan.maxImagesPerProduct || 8;
    store.isActive = true;

    // Send activation notification with failure handling
    let emailWarning = null;
    const vendorEmail = await resolveVendorEmailForStore(store);
    if (vendorEmail) {
      try {
        await sendSubscriptionActivationEmail(vendorEmail, {
          storeName: store.storeName || "Store",
          planName: selectedPlan.name,
          durationDays: days,
          expiresAt,
        });
      } catch (emailErr) {
        console.error("Failed to send subscription renewal email:", emailErr);
        emailWarning =
          "Subscription renewed in the database, but notification email delivery failed. You can resend it.";
      }
    }

    return res.json({
      success: true,
      message: emailWarning
        ? `Store subscription directly renewed (+${days} days) under ${selectedPlan.name} (email warning).`
        : `Store subscription directly renewed (+${days} days) under ${selectedPlan.name}.`,
      warning: emailWarning,
      emailFailed: Boolean(emailWarning),
      expiresAt,
      status: "active",
      resendEndpoint: `/api/admin/store/${store._id}/resend-subscription-email`,
    });
  } catch (error) {
    console.error("adminDirectRenew error:", error);
    return res.status(500).json({ message: "Renewal failed." });
  }
}

/**
 * Admin: Direct Discontinue a store (immediately sets subscription to expired).
 */
export async function adminDirectDiscontinue(req, res) {
  try {
    const { storeId } = req.params;
    const storesCollection = mongoose.connection?.db?.collection("stores");
    let store = req.store || (await resolveStoreByIdentifier(storeId));

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

    store.subscription = store.subscription || {};
    store.subscription.status = "expired";
    store.subscription.expiresAt = now.toISOString();

    // Send discontinuation notification with failure handling
    let emailWarning = null;
    const vendorEmail = await resolveVendorEmailForStore(store);
    if (vendorEmail) {
      try {
        await sendSubscriptionDiscontinuationEmail(vendorEmail, {
          storeName: store.storeName || "Store",
        });
      } catch (emailErr) {
        console.error("Failed to send subscription discontinuation email:", emailErr);
        emailWarning =
          "Subscription discontinued, but notification email delivery failed.";
      }
    }

    return res.json({
      success: true,
      message: "Subscription discontinued. Products are now shielded from public discovery.",
      warning: emailWarning,
      emailFailed: Boolean(emailWarning),
      status: "expired",
    });
  } catch (error) {
    console.error("adminDirectDiscontinue error:", error);
    return res.status(500).json({ message: "Discontinuation failed." });
  }
}

/**
 * Admin: Sends manual renewal reminder to the vendor with a button click.
 */
export async function sendAdminRenewalReminder(req, res) {
  try {
    const { storeId } = req.params;
    let store = req.store || (await resolveStoreByIdentifier(storeId));
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const vendorEmail = await resolveVendorEmailForStore(store);
    if (!vendorEmail) {
      return res.status(400).json({ message: "No registered vendor email found for this store" });
    }

    const subscription = store.subscription || {};
    const expiresAt = subscription.expiresAt;
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    let daysRemaining = null;
    if (expiresAtDate) {
      daysRemaining = Math.ceil((expiresAtDate - Date.now()) / (1000 * 60 * 60 * 24));
    }

    await sendRenewalReminderEmail(vendorEmail, {
      storeName: store.storeName,
      planName: subscription.plan || "Standard Plan",
      daysRemaining,
      expiresAt,
    });

    return res.json({
      success: true,
      message: `Renewal reminder email sent successfully to ${vendorEmail}.`,
    });
  } catch (error) {
    console.error("sendAdminRenewalReminder error:", error);
    return res.status(500).json({ message: "Failed to send renewal reminder." });
  }
}

/**
 * Admin: Resends subscription activation email.
 */
export async function resendSubscriptionEmail(req, res) {
  try {
    const { storeId } = req.params;
    let store = req.store || (await resolveStoreByIdentifier(storeId));
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const vendorEmail = await resolveVendorEmailForStore(store);
    if (!vendorEmail) {
      return res.status(400).json({ message: "No registered vendor email found for this store" });
    }

    const subscription = store.subscription || {};
    const selectedPlan =
      inMemoryPlans.find((p) => p.planId === subscription.plan) || defaultPlans[1];

    await sendSubscriptionActivationEmail(vendorEmail, {
      storeName: store.storeName,
      planName: selectedPlan.name,
      durationDays: 365,
      expiresAt: subscription.expiresAt,
    });

    return res.json({
      success: true,
      message: `Subscription activation email resent to ${vendorEmail}.`,
    });
  } catch (error) {
    console.error("resendSubscriptionEmail error:", error);
    return res.status(500).json({ message: "Failed to resend subscription email." });
  }
}
