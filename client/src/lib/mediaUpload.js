import { apiFetch } from "@/lib/apiClient";
import { compressImage } from "@/lib/imageCompressor";
import { toMessage } from "@/lib/formatDate";

/**
 * Uploads product photos straight to Cloudinary with a signature from our server.
 * Moved unchanged in behaviour from the old upload modal: compress to 1200px at 0.82,
 * sign once per batch, send the signed allowed_formats, and return { url, publicId } pairs.
 *
 * onProgress({ index, total, percent }) is called as each photo uploads.
 * Errors are always thrown as Error objects with a string message.
 */
export async function uploadProductPhotos(files, { storeId, onProgress } = {}) {
  if (!storeId) throw new Error("Your store could not be found. Refresh the page and try again.");
  const list = Array.from(files || []).filter((f) => f && typeof f.type === "string" && f.type.startsWith("image/"));
  if (list.length === 0) return [];

  const signRes = await apiFetch(`/api/vendor/store/${encodeURIComponent(storeId)}/media/sign`, { method: "POST" });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(toMessage(body, "Photo upload isn't available right now. Try again later."));
  }
  const sign = await signRes.json();

  const uploaded = [];
  for (let i = 0; i < list.length; i += 1) {
    onProgress?.({ index: i, total: list.length, percent: 0 });
    const dataUrl = await compressImage(list[i], { maxWidth: 1200, maxHeight: 1200, quality: 0.82 });
    if (!dataUrl) continue;

    const form = new FormData();
    form.append("file", dataUrl);
    form.append("api_key", sign.apiKey);
    form.append("timestamp", sign.timestamp);
    form.append("signature", sign.signature);
    form.append("folder", sign.folder);
    if (sign.allowed_formats) form.append("allowed_formats", sign.allowed_formats);

    const result = await postWithProgress(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, form, (percent) =>
      onProgress?.({ index: i, total: list.length, percent })
    );
    uploaded.push({ url: result.secure_url, publicId: result.public_id });
  }
  return uploaded;
}

function postWithProgress(url, body, onPercent) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPercent(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        onPercent(100);
        resolve(data);
      } else {
        reject(new Error(toMessage(data.error || data, "A photo couldn't be uploaded. Check your connection and try again.")));
      }
    };
    xhr.onerror = () => reject(new Error("A photo couldn't be uploaded. Check your connection and try again."));
    xhr.send(body);
  });
}
