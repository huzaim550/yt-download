import { Ytdl, parseVideoId } from "@distube/ytdl-core";

/**
 * Shared YouTube helpers used by the API routes.
 *
 * This module is server-only. It owns the ytdl-core client, so don't import it
 * from a client component.
 *
 * The two things most changes touch:
 *   - getAvailableQualities(): decide what appears in the quality dropdown.
 *   - resolveFormat(): decide which YouTube stream backs a download.
 */

// Keep one client across dev-server reloads. Creating a new Ytdl instance on
// every hot reload would throw away its visitor data and PO-token state.
const globalCache = globalThis;
export const ytdl =
  globalCache.__ytdlClient ?? (globalCache.__ytdlClient = new Ytdl());

const MP4 = "mp4";
const CODEC_PRIORITY = ["avc1", "av01", "vp9", "vp09"];
const FALLBACK_FILE_NAME = "youtube-video";

/** @typedef {import("@distube/ytdl-core").VideoInfo} VideoInfo */
/** @typedef {import("@distube/ytdl-core").VideoFormat} VideoFormat */

/**
 * One entry in the quality dropdown.
 * @typedef {Object} QualityOption
 * @property {string} label     Human-readable resolution, e.g. "1080p".
 * @property {string} value     YouTube's quality key, e.g. "hd1080".
 * @property {number} itag      Exact YouTube format ID.
 * @property {string} container File container, e.g. "mp4".
 * @property {boolean} hasAudio False for video-only streams.
 */

/**
 * The JSON returned by GET /api/info.
 * @typedef {Object} VideoSummary
 * @property {string} title
 * @property {string} thumbnail
 * @property {string} quality
 * @property {string} duration
 * @property {string} fileName
 * @property {QualityOption[]} qualities
 * @property {string} defaultQuality
 */

/** True when the input is a YouTube video URL or an 11-character video ID. */
export function isValidVideoInput(input) {
  return Boolean(input && parseVideoId(String(input).trim()));
}

/** Fetch metadata and playable formats. Used by both API routes. */
export function getVideoInfo(input) {
  return ytdl.getInfo(input);
}

/** Stream one resolved format as a Node Readable. */
export function streamVideo(info, format) {
  return ytdl.download(info, { format });
}

/**
 * Extract the resolution from a format or label: "1080p" / "hd1080" -> 1080.
 * Returns 0 for named qualities such as "medium" or "tiny".
 */
export function getResolution(value) {
  return Number(String(value || "").match(/\d+/)?.[0] || 0);
}

/** Higher is better. AVC (H.264) plays everywhere; AV1 is the next safest. */
function getCodecRank(format) {
  const codec = String(format.videoCodec || "").toLowerCase();
  const index = CODEC_PRIORITY.findIndex((prefix) => codec.startsWith(prefix));
  return index === -1 ? 0 : CODEC_PRIORITY.length - index;
}

function getFormatResolution(format) {
  return getResolution(format.qualityLabel || format.quality);
}

/** Formats we can actually stream. DRM and OTF formats are listed by YouTube but unusable here. */
function getUsableVideoFormats(formats) {
  return (formats || []).filter(
    (format) => format.hasVideo && !format.isDrm && !format.isOtf
  );
}

/**
 * Does a format represent the requested quality?
 * Accepts YouTube keys ("hd1080"), labels ("1080p") and plain numbers ("1080").
 */
function matchesQuality(format, requestedQuality) {
  const requested = String(requestedQuality || "")
    .trim()
    .toLowerCase()
    .replace(/p$/, "");

  if (!requested) return false;

  const quality = String(format.quality || "").toLowerCase();
  const label = String(format.qualityLabel || "").toLowerCase();
  const requestedHeight = getResolution(requested);

  return (
    quality === requested ||
    label === requested ||
    quality.replace(/p$/, "") === requested ||
    label.replace(/p$/, "") === requested ||
    (requestedHeight > 0 && getFormatResolution(format) === requestedHeight)
  );
}

/** Same quality, best codec first. */
function compareExactCandidates(a, b) {
  return (
    getCodecRank(b) - getCodecRank(a) ||
    getFormatResolution(b) - getFormatResolution(a)
  );
}

/** Highest resolution first, then best codec. Used when no quality was requested. */
function compareHighestQuality(a, b) {
  return (
    getFormatResolution(b) - getFormatResolution(a) ||
    getCodecRank(b) - getCodecRank(a)
  );
}

/**
 * Build the dropdown options from YouTube formats.
 *
 * We only advertise MP4 qualities because the download endpoint serves MP4.
 * One option per resolution is kept, preferring the most compatible codec.
 *
 * @param {VideoFormat[]} formats
 * @returns {QualityOption[]} Sorted from highest to lowest resolution.
 */
export function getAvailableQualities(formats) {
  const bestByQuality = new Map();

  for (const format of formats || []) {
    if (!format.hasVideo || !format.quality) continue;
    if (format.isDrm || format.isOtf || format.container !== MP4) continue;

    const value = String(format.quality);
    const current = bestByQuality.get(value);

    if (!current || compareExactCandidates(format, current) < 0) {
      bestByQuality.set(value, format);
    }
  }

  return [...bestByQuality.values()]
    .map((format) => ({
      label: String(format.qualityLabel || format.quality).trim(),
      value: String(format.quality).trim(),
      itag: format.itag,
      container: format.container,
      hasAudio: Boolean(format.hasAudio),
    }))
    .sort((a, b) => getResolution(b.label) - getResolution(a.label));
}

/**
 * Pick the YouTube format that should be streamed for a requested quality.
 *
 * Selection order:
 *   1. exact quality among video-only MP4 formats
 *   2. exact quality among all usable MP4 formats
 *   3. highest-resolution video-only format
 *   4. highest-resolution usable format
 *
 * Video-only is preferred because that is what ytdl-core exposes for most
 * resolutions. See the README if you want to mux audio in later.
 *
 * @param {VideoInfo} info
 * @param {string} requestedQuality
 * @returns {VideoFormat | null}
 */
export function resolveFormat(info, requestedQuality) {
  const usable = getUsableVideoFormats(info?.formats);
  if (!usable.length) return null;

  const mp4Formats = usable.filter((format) => format.container === MP4);
  const pool = mp4Formats.length ? mp4Formats : usable;
  const videoOnly = pool.filter((format) => !format.hasAudio);

  const findExact = (candidates) =>
    candidates
      .filter((format) => matchesQuality(format, requestedQuality))
      .sort(compareExactCandidates)[0] ?? null;

  return (
    findExact(videoOnly) ||
    findExact(pool) ||
    [...videoOnly].sort(compareHighestQuality)[0] ||
    [...pool].sort(compareHighestQuality)[0] ||
    null
  );
}

/** Format seconds as HH:MM:SS, or "Unknown" when YouTube doesn't provide it. */
export function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return "Unknown";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.floor(seconds % 60);

  return [hours, minutes, remaining]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Remove characters that operating systems don't allow in file names. */
function sanitizeTitle(title) {
  return String(title || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a safe file name. The Unicode version is used in Content-Disposition's
 * `filename*` field; the ASCII version is used in the plain `filename` field.
 */
export function toFileName(title, extension = MP4) {
  const base = sanitizeTitle(title) || FALLBACK_FILE_NAME;
  return `${base}.${extension}`;
}

function toAsciiFileName(fileName) {
  return String(fileName || "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Response headers for a streaming download.
 * The extension and MIME type follow the actual container of the chosen format.
 */
export function getDownloadHeaders(format, title) {
  const extension = format.container === "webm" ? "webm" : MP4;
  const contentType = extension === "webm" ? "video/webm" : "video/mp4";
  const fileName = toFileName(title, extension);
  const asciiFileName = toAsciiFileName(fileName) || `${FALLBACK_FILE_NAME}.${extension}`;

  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  };
}

/**
 * Convert a ytdl-core VideoInfo into the small shape the browser needs.
 * Keep this in sync with the VideoSummary typedef and the UI components.
 *
 * @param {VideoInfo} info
 * @returns {VideoSummary}
 */
export function toVideoSummary(info) {
  const details = info.videoDetails;
  const qualities = getAvailableQualities(info.formats);
  const title = details.title || "YouTube video";

  return {
    title,
    thumbnail: details.thumbnails?.at(-1)?.url || "",
    quality: qualities[0]?.label || "Best available",
    duration: formatDuration(details.lengthSeconds),
    fileName: toFileName(title),
    qualities,
    // "highestvideo" is a valid ytdl-core quality and acts as a safe fallback.
    defaultQuality: qualities[0]?.value || "highestvideo",
  };
}
