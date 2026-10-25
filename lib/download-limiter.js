/**
 * A small per-process cap on concurrent downloads.
 *
 * Each download holds a YouTube video stream (and usually an audio stream plus
 * an ffmpeg process) until the browser finishes reading it. Without a cap, a
 * burst of requests can exhaust file descriptors, CPU and bandwidth.
 *
 * This is intentionally in-memory and per-process. For a public deployment,
 * also put a per-IP rate limit and a request timeout at the reverse proxy or
 * hosting platform. Override the cap with MAX_CONCURRENT_DOWNLOADS.
 */

const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 3;
const configuredLimit = Number(process.env.MAX_CONCURRENT_DOWNLOADS);
const MAX_CONCURRENT_DOWNLOADS =
  Number.isInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_CONCURRENT_DOWNLOADS;

let activeDownloads = 0;

/**
 * Reserve a download slot.
 *
 * @returns {(() => void) | null} A release function, or null when the server is
 *   already at capacity.
 */
export function acquireDownloadSlot() {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) return null;

  activeDownloads += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeDownloads -= 1;
  };
}
