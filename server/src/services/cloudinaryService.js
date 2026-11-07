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
  const allowed_formats = "jpg,jpeg,png,webp";

  const paramsToSign = {
    allowed_formats,
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
    allowed_formats,
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
 * Validates product image assets and image URLs.
 * - Checks every entry in images array.
 * - Rejects null, non-string, or non-object entries with clear error.
 * - Rejects data: base64 URLs.
 * - Allows preexisting URLs on the product.
 * - Enforces new images are under https://res.cloudinary.com/<cloudName>/ and have matching imageAsset scoped to bharatshopy/<storeId>/.
 * - In production, fails closed if CLOUDINARY_CLOUD_NAME is unconfigured.
 */
export function validateProductMedia({ images = [], imageAssets = [], storeId, existingProduct = null }) {
  const isProduction = process.env.NODE_ENV === "production";
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (isProduction && !cloudName && !testCloudinaryClient) {
    return {
      valid: false,
      message: "Cloudinary configuration is missing in production environment.",
    };
  }

  if (!Array.isArray(images)) {
    return { valid: false, message: "Field 'images' must be an array." };
  }
  if (!Array.isArray(imageAssets)) {
    return { valid: false, message: "Field 'imageAssets' must be an array." };
  }

  const storeFolderPrefix = `bharatshopy/${storeId}/`;

  // Preexisting URLs allowed on the product
  const existingUrls = new Set(existingProduct?.images || []);
  if (Array.isArray(existingProduct?.imageAssets)) {
    for (const a of existingProduct.imageAssets) {
      if (a?.url && typeof a.url === "string") existingUrls.add(a.url);
    }
  }

  // 1. Validate imageAssets entries
  const assetsByUrl = new Map();
  for (const asset of imageAssets) {
    if (!asset || typeof asset !== "object") {
      return {
        valid: false,
        message: "Invalid image asset: asset entry must be a valid object.",
      };
    }

    if (typeof asset.url !== "string" || !asset.url.trim()) {
      return {
        valid: false,
        message: "Invalid image asset: url must be a non-empty string.",
      };
    }

    if (asset.url.trim().startsWith("data:")) {
      return {
        valid: false,
        message: "Base64 data URLs are not permitted. Please upload photos via Cloudinary.",
      };
    }

    // If URL already on existing product, allow
    if (existingUrls.has(asset.url)) {
      assetsByUrl.set(asset.url, asset);
      continue;
    }

    // Verify publicId
    if (typeof asset.publicId !== "string" || !asset.publicId.trim()) {
      return {
        valid: false,
        message: "Invalid image asset: publicId must be a non-empty string.",
      };
    }

    if (!asset.publicId.startsWith(storeFolderPrefix)) {
      return {
        valid: false,
        message: `Image publicId '${asset.publicId}' does not belong to store folder '${storeFolderPrefix}'.`,
      };
    }

    // Verify cloud origin
    if (cloudName) {
      const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
      if (!asset.url.startsWith(expectedPrefix)) {
        return {
          valid: false,
          message: `Unauthorized or foreign URL: Image URL '${asset.url}' does not originate from cloud '${cloudName}'.`,
        };
      }
    } else if (isProduction) {
      return {
        valid: false,
        message: "Cloudinary configuration is missing in production environment.",
      };
    } else {
      if (!asset.url.startsWith("https://res.cloudinary.com/")) {
        return {
          valid: false,
          message: `Unauthorized or foreign URL: Image URL '${asset.url}' does not originate from Cloudinary.`,
        };
      }
    }

    assetsByUrl.set(asset.url, asset);
  }

  // 2. Validate every entry in images array
  for (const img of images) {
    if (typeof img !== "string" || !img.trim()) {
      return {
        valid: false,
        message: "Invalid image: entry must be a non-empty string URL.",
      };
    }

    if (img.trim().startsWith("data:")) {
      return {
        valid: false,
        message: "Base64 data URLs are not permitted. Please upload photos via Cloudinary.",
      };
    }

    // Allowed if preexisting on the product
    if (existingUrls.has(img)) {
      continue;
    }

    // Must be under https://res.cloudinary.com/<cloud name>/
    if (cloudName) {
      const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
      if (!img.startsWith(expectedPrefix)) {
        return {
          valid: false,
          message: `Unauthorized or foreign URL: Image URL '${img}' does not originate from cloud '${cloudName}'.`,
        };
      }
    } else if (isProduction) {
      return {
        valid: false,
        message: "Cloudinary configuration is missing in production environment.",
      };
    } else {
      if (!img.startsWith("https://res.cloudinary.com/")) {
        return {
          valid: false,
          message: `Image URL '${img}' does not originate from Cloudinary.`,
        };
      }
    }

    // Must have a matching imageAssets entry whose publicId is in that store's folder
    const matchingAsset = assetsByUrl.get(img);
    if (!matchingAsset || !matchingAsset.publicId || !matchingAsset.publicId.startsWith(storeFolderPrefix)) {
      return {
        valid: false,
        message: `Image URL '${img}' must have a matching imageAsset whose publicId is in store folder '${storeFolderPrefix}'.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Verifies that newly uploaded assets do not exceed 5MB by querying the Cloudinary resource API.
 * Fails closed in production if Cloudinary is unconfigured, if the API call fails, or if bytes is missing.
 */
export async function verifyUploadedMediaSizes(imageAssets = [], maxBytes = 5 * 1024 * 1024) {
  if (!Array.isArray(imageAssets) || imageAssets.length === 0) {
    return { valid: true };
  }

  const isProduction = process.env.NODE_ENV === "production";

  for (const asset of imageAssets) {
    if (!asset?.publicId) continue;

    if (testCloudinaryClient?.resource) {
      try {
        const res = await testCloudinaryClient.resource(asset.publicId);
        if (typeof res?.bytes !== "number") {
          if (isProduction) {
            return {
              valid: false,
              message: `Unable to verify upload size for '${asset.publicId}': missing size metadata.`,
            };
          }
        } else if (res.bytes > maxBytes) {
          return {
            valid: false,
            message: `Image '${asset.publicId}' exceeds maximum allowed size of 5 MB (${res.bytes} bytes).`,
          };
        }
      } catch (err) {
        if (isProduction) {
          return {
            valid: false,
            message: `Unable to verify upload size for '${asset.publicId}': ${err.message || "Cloudinary API error"}.`,
          };
        }
      }
      continue;
    }

    if (!isCloudinaryConfigured()) {
      if (isProduction) {
        return {
          valid: false,
          message: `Cloudinary is not configured in production; cannot verify image size for '${asset.publicId}'.`,
        };
      }
      continue;
    }

    configureCloudinary();
    try {
      const resource = await cloudinary.api.resource(asset.publicId);
      if (typeof resource?.bytes !== "number") {
        if (isProduction) {
          return {
            valid: false,
            message: `Unable to verify upload size for '${asset.publicId}': missing size metadata from Cloudinary.`,
          };
        }
      } else if (resource.bytes > maxBytes) {
        return {
          valid: false,
          message: `Image '${asset.publicId}' exceeds maximum allowed size of 5 MB (${resource.bytes} bytes).`,
        };
      }
    } catch (err) {
      console.warn(`Could not verify Cloudinary size for ${asset.publicId}:`, err);
      if (isProduction) {
        return {
          valid: false,
          message: `Unable to verify upload size for '${asset.publicId}' through Cloudinary API.`,
        };
      }
    }
  }

  return { valid: true };
}
