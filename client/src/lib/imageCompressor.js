/**
 * Mobile-First Client-Side Image Compression Utility
 * Resizes heavy smartphone camera photos (often 5-15 MB) down to
 * lightweight, high-quality images (<250 KB) directly in the browser
 * before transmitting to the server.
 */

export async function compressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    mimeType = "image/jpeg",
  } = options;

  if (typeof window === "undefined" || !file) {
    return null;
  }

  // If already a small SVG or non-image, return as-is
  if (file.type === "image/svg+xml") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        // Calculate proportional scale
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(readerEvent.target.result);
        }

        // Fill background white for transparent PNGs converted to JPEG
        if (mimeType === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        // Fallback to uncompressed dataUrl on decode failure
        resolve(readerEvent.target.result);
      };

      img.src = readerEvent.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
