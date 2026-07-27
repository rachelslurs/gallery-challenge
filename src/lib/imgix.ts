/**
 * Thumbnail URLs for air-prod.imgix.net.
 *
 * Source assets are full-resolution originals: a 5616x3744 photo on the board
 * is 1.4 MB. Requesting the same image at the size it actually renders drops it
 * to roughly 30 KB, which is the difference between a gallery that scrolls and
 * one that stalls on a throttled CPU.
 */

/**
 * Widths are snapped to this ladder rather than requested exactly. Two cells a
 * few pixels apart would otherwise be two separate origin fetches and two
 * separate CDN entries, so snapping trades a little precision for cache hits.
 */
const WIDTHS = [160, 240, 320, 400, 560, 720, 960, 1280, 1600] as const;

function snap(width: number): number {
  for (const w of WIDTHS) {
    if (w >= width) return w;
  }
  return WIDTHS[WIDTHS.length - 1];
}

/** Device pixel ratio, capped at 2. Beyond that the bytes cost more than the sharpness returns. */
function pixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Build a thumbnail URL sized for a cell `cssWidth` CSS pixels wide.
 * `auto=format` lets imgix negotiate WebP or AVIF; `fit=max` prevents upscaling.
 */
export function thumbnail(src: string, cssWidth: number, dpr = pixelRatio()): string {
  if (!src) return src;
  const width = snap(Math.ceil(cssWidth * dpr));
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}w=${width}&auto=format&fit=max`;
}

/**
 * `srcSet` at 1x and 2x so the browser can pick, and so a cell that grows on
 * resize can upgrade without us recomputing anything.
 */
export function thumbnailSrcSet(src: string, cssWidth: number): string {
  if (!src) return "";
  return [
    `${thumbnail(src, cssWidth, 1)} 1x`,
    `${thumbnail(src, cssWidth, 2)} 2x`,
  ].join(", ");
}
