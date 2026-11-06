import { signUploadParams } from "../services/cloudinaryService.js";

/**
 * POST /api/vendor/store/:storeId/media/sign
 * Generates signed Cloudinary upload credentials for direct browser upload.
 * Strictly scoped to bharatshopy/<store._id>, 5MB max, JPEG/PNG/WebP.
 */
export async function signMediaUpload(req, res) {
  try {
    const store = req.store;
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const signedParams = signUploadParams({ storeId: store._id });

    return res.status(200).json({
      success: true,
      ...signedParams,
    });
  } catch (error) {
    if (error.status === 503 || error.message.includes("not configured")) {
      return res.status(503).json({
        message: "Cloudinary media service is unconfigured. Media upload signing is disabled.",
      });
    }
    console.error("signMediaUpload error:", error);
    return res.status(500).json({ message: "Failed to generate media upload signature", error: error.message });
  }
}
