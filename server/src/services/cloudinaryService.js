import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";

let testCloudinaryClient = null;

export function setTestCloudinaryClient(client) {
  testCloudinaryClient = client;
}

export function resetTestCloudinaryClient() {
  testCloudinaryClient = null;
}

/**
 * Checks whether Cloudinary environment variables are configured.
 */
export function isCloudinaryConfigured() {
  if (testCloudinaryClient) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Configures the active Cloudinary instance.
 */
function configureCloudinary() {
  if (testCloudinaryClient) return;
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is unconfigured. Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET."
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Generates signed parameters for direct-to-Cloudinary browser upload.
 * Limited to folder bharatshopy/<storeId>, max 5MB, formats jpeg, png, webp.
 */
export function signUploadParams({ storeId }) {
  if (!isCloudinaryConfigured()) {
    const error = new Error("Cloudinary media service is not configured. Media signing is disabled.");
    error.status = 503;
    throw error;
  }

  if (testCloudinaryClient?.signUploadParams) {
    return testCloudinaryClient.signUploadParams({ storeId });
  }

  configureCloudinary();

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `bharatshopy/${storeId}`;

  const paramsToSign = {
    folder,
    timestamp,
  };

  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  let signature;
  try {
    signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
  } catch {
    const sorted = Object.keys(paramsToSign)
      .sort()
      .map((k) => `${k}=${paramsToSign[k]}`)
      .join("&");
    signature = crypto.createHash("sha1").update(sorted + apiSecret).digest("hex");
  }

  return {
    signature,
    timestamp,
    folder,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    maxFileSize: 5 * 1024 * 1024, // 5 MB
  };
}

/**
 * Deletes a single image resource from Cloudinary by its publicId.
 */
export async function deleteCloudinaryMedia(publicId) {
  if (!publicId || typeof publicId !== "string") return null;

  if (testCloudinaryClient?.destroy) {
    return await testCloudinaryClient.destroy(publicId);
  }

  if (!isCloudinaryConfigured()) {
    console.warn("Cloudinary not configured; skipping media deletion for:", publicId);
    return null;
  }

  configureCloudinary();

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error(`Failed to delete media ${publicId} from Cloudinary:`, error);
    return null;
  }
}

/**
 * Deletes all media resources in a store's folder (used by A4 vendor removal).
 */
export async function deleteStoreMediaFolder(storeId) {
  if (!storeId) return null;

  if (testCloudinaryClient?.deleteResourcesByPrefix) {
    return await testCloudinaryClient.deleteResourcesByPrefix(`bharatshopy/${storeId}/`);
  }

  if (!isCloudinaryConfigured()) {
    console.warn("Cloudinary not configured; skipping store folder deletion for:", storeId);
    return null;
  }

  configureCloudinary();

  try {
    const prefix = `bharatshopy/${storeId}/`;
    await cloudinary.api.delete_resources_by_prefix(prefix);
    await cloudinary.api.delete_folder(`bharatshopy/${storeId}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to delete media folder for store ${storeId}:`, error);
    return null;
  }
}

/**
 * Validates product image assets.
 * - Rejects data: URLs with error.
 * - Allows preexisting URLs on the product.
 * - Enforces new images are from https://res.cloudinary.com/<cloudName>/ with publicId in bharatshopy/<storeId>/.
 */
export function validateProductMedia({ images = [], imageAssets = [], storeId, existingProduct = null }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const storeFolderPrefix = `bharatshopy/${storeId}/`;

  // Existing URLs allowed on product
  const existingUrls = new Set(existingProduct?.images || []);
  if (Array.isArray(existingProduct?.imageAssets)) {
    for (const a of existingProduct.imageAssets) {
      if (a?.url) existingUrls.add(a.url);
    }
  }

  // Check images array for base64
  for (const img of images) {
    if (typeof img === "string" && img.trim().startsWith("data:")) {
      return {
        valid: false,
        message: "Base64 data URLs are not permitted. Please upload photos via Cloudinary.",
      };
    }
  }

  // Check imageAssets
  if (Array.isArray(imageAssets)) {
    for (const asset of imageAssets) {
      if (typeof asset.url === "string" && asset.url.trim().startsWith("data:")) {
        return {
          valid: false,
          message: "Base64 data URLs are not permitted. Please upload photos via Cloudinary.",
        };
      }

      // If URL already on existing product, allow
      if (existingUrls.has(asset.url)) {
        continue;
      }

      // Verify publicId belongs to this store
      if (!asset.publicId || !String(asset.publicId).startsWith(storeFolderPrefix)) {
        return {
          valid: false,
          message: `Image publicId '${asset.publicId}' does not belong to store folder '${storeFolderPrefix}'.`,
        };
      }

      // If cloudName configured, verify URL host
      if (cloudName && typeof asset.url === "string") {
        const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
        if (!asset.url.startsWith(expectedPrefix)) {
          return {
            valid: false,
            message: `Image URL '${asset.url}' does not originate from cloud '${cloudName}'.`,
          };
        }
      }
    }
  }

  return { valid: true };
}
