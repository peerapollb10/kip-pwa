// Client-side compression → WebP before upload (spec: max width 1200px, quality 0.8).
// Every image that reaches Supabase Storage (composer, guest→account migration, payment slip) goes through here.
// The compressor is loaded on first use: keeps it out of the main bundle and lets Node tests import the pure helpers.
const loadCompressor = () => import('browser-image-compression').then((m) => m.default);

export const MAX_WIDTH = 1200;
export const QUALITY = 0.8;

// Per-use targets. Slips keep a little more quality so amounts/reference numbers stay legible.
export const PROFILES = {
  content: { maxWidth: MAX_WIDTH, quality: QUALITY, maxSizeKB: 300 },
  slip: { maxWidth: MAX_WIDTH, quality: 0.85, maxSizeKB: 500 },
};

const OUTPUT_TYPES = ['image/webp', 'image/jpeg'];

export class ImageError extends Error {
  constructor() {
    super('IMAGE_UNSUPPORTED');
    this.code = 'IMAGE_UNSUPPORTED';
  }
}

// browser-image-compression only caps the longest side, so derive that cap from the width limit.
export function longestSideFor(width, height, maxWidth = MAX_WIDTH) {
  const scale = Math.min(1, maxWidth / width);
  return Math.round(Math.max(width, height) * scale);
}

// Already small enough, narrow enough and in an upload format → re-encoding would only lose quality.
export function isAlreadyOptimized({ type, size, width }, profile = PROFILES.content) {
  return OUTPUT_TYPES.includes(type) && size <= profile.maxSizeKB * 1024 && width <= profile.maxWidth;
}

export const extFor = (type) => (type === 'image/webp' ? 'webp' : 'jpg');

async function dimensions(file) {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close?.();
    return size;
  } catch {
    throw new ImageError(); // e.g. HEIC on browsers that can't decode it
  }
}

// Accepts a File or Blob; `profile` is a key of PROFILES. Returns { blob, ext }.
export async function compressToWebp(file, profile = 'content') {
  const p = PROFILES[profile] || PROFILES.content;
  if (!file?.type?.startsWith('image/')) throw new ImageError();
  const { width, height } = await dimensions(file);
  if (isAlreadyOptimized({ type: file.type, size: file.size, width }, p)) return { blob: file, ext: extFor(file.type) };

  const imageCompression = await loadCompressor();
  const options = {
    maxWidthOrHeight: longestSideFor(width, height, p.maxWidth),
    maxSizeMB: p.maxSizeKB / 1024,
    initialQuality: p.quality,
    useWebWorker: true,
  };
  let blob = await imageCompression(file, { ...options, fileType: 'image/webp' });
  // Browsers without a WebP encoder return PNG; fall back to JPEG to keep size down.
  if (blob.type !== 'image/webp') blob = await imageCompression(file, { ...options, fileType: 'image/jpeg' });
  return { blob, ext: extFor(blob.type) };
}
