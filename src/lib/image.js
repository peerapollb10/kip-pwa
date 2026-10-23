// Client-side compression → WebP before upload (spec: max width 1200px, quality 0.8).
import imageCompression from 'browser-image-compression';

export const MAX_WIDTH = 1200;
export const QUALITY = 0.8;

// browser-image-compression only caps the longest side, so derive that cap from the width limit.
export function longestSideFor(width, height, maxWidth = MAX_WIDTH) {
  const scale = Math.min(1, maxWidth / width);
  return Math.round(Math.max(width, height) * scale);
}

async function dimensions(file) {
  const bmp = await createImageBitmap(file);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return size;
}

export async function compressToWebp(file) {
  const { width, height } = await dimensions(file);
  const options = {
    maxWidthOrHeight: longestSideFor(width, height),
    initialQuality: QUALITY,
    useWebWorker: true,
  };
  let blob = await imageCompression(file, { ...options, fileType: 'image/webp' });
  // Browsers without a WebP encoder return PNG; fall back to JPEG to keep size down.
  if (blob.type !== 'image/webp') blob = await imageCompression(file, { ...options, fileType: 'image/jpeg' });
  return { blob, ext: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}
