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
 * @property {boolean} hasAudio True when the download will include an audio track.
 */

/**
 * Audio track metadata returned by GET /api/info.
 * @typedef {Object} AudioSummary
 * @property {string} codec
 * @property {number | null} bitrate Bitrate in kbps.
 * @property {string} container
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
 * @property {AudioSummary | null} audio Null when no audio track is available.
 */

/** True when the input is a YouTube video URL or an 11-character video ID. */
export function isValidVideoInput(input) {
  const text = String(input || "").trim();

  // Keep query strings comfortably below common proxy/header limits. YouTube
  // watch URLs are far shorter than this even with playlist parameters.
  if (!text || text.length > 2048) return false;

  return Boolean(parseVideoId(text));
}

/** Fetch metadata and playable formats. Used by both API routes. */
export function getVideoInfo(input, options) {
  return ytdl.getInfo(input, options);
}

/** Stream one resolved format (video or audio) as a Node Readable. */
export function streamFormat(info, format, options) {
  return ytdl.download(info, { format, ...options });
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
 * @param {{ audioAvailable?: boolean }} [options]
 * @returns {QualityOption[]} Sorted from highest to lowest resolution.
 */
export function getAvailableQualities(formats, { audioAvailable = false } = {}) {
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
      // This describes the final download (video + muxed audio), not the
      // individual video format, which is always video-only here.
      hasAudio: audioAvailable,
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
 * Video-only is preferred because ytdl-core exposes video and audio as
 * separate DASH streams. Audio is resolved separately with
 * resolveAudioFormat() and muxed by lib/ffmpeg.js.
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

/** Higher is better. AAC in MP4 is the safest, then Opus/Vorbis in WebM. */
function getAudioCodecRank(format) {
  const codec = String(format.audioCodec || "").toLowerCase();
  if (codec.startsWith("mp4a")) return 3;
  if (codec.startsWith("opus")) return 2;
  if (codec.startsWith("vorbis")) return 1;
  return 0;
}

/**
 * Pick the audio track to pair with a video format.
 *
 * Prefers:
 *   - an audio format in the same container as the video
 *   - the original/default audio track instead of a dub
 *   - non-DRC audio
 *   - AAC over Opus/Vorbis
 *   - the highest bitrate
 *
 * @param {VideoInfo} info
 * @param {VideoFormat | null} [videoFormat]
 * @returns {VideoFormat | null}
 */
export function resolveAudioFormat(info, videoFormat = null) {
  const usable = (info?.formats || []).filter(
    (format) =>
      format.hasAudio && !format.hasVideo && !format.isDrm && !format.isOtf
  );

  if (!usable.length) return null;

  const preferredContainer =
    videoFormat?.container === "webm" ? "webm" : MP4;
  const sameContainer = usable.filter(
    (format) => format.container === preferredContainer
  );
  const pool = sameContainer.length ? sameContainer : usable;

  const defaultTracks = pool.filter(
    (format) => format.audioTrack?.audioIsDefault !== false
  );
  const candidates = defaultTracks.length ? defaultTracks : pool;

  return (
    [...candidates].sort(
      (a, b) =>
        Number(a.isDrc) - Number(b.isDrc) ||
        getAudioCodecRank(b) - getAudioCodecRank(a) ||
        (b.audioBitrate || 0) - (a.audioBitrate || 0)
    )[0] ?? null
  );
}

/**
 * Convert a ytdl-core audio format into the small shape the UI needs.
 *
 * @param {VideoFormat | null} format
 * @returns {AudioSummary | null}
 */
export function toAudioSummary(format) {
  if (!format) return null;

  const codec = String(format.audioCodec || "").toLowerCase();
  const label = codec.startsWith("mp4a")
    ? "AAC"
    : codec.startsWith("opus")
      ? "Opus"
      : codec.startsWith("vorbis")
        ? "Vorbis"
        : "Audio";

  return {
    codec: label,
    bitrate: Number.isFinite(format.audioBitrate)
      ? Math.round(format.audioBitrate)
      : null,
    container: format.container,
  };
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
    // Downloads are generated per request and should never land in a shared
    // cache or the browser's HTTP cache.
    "Cache-Control": "private, no-store",
  };
}

/**
 * Convert a ytdl-core VideoInfo into the small shape the browser needs.
 * Keep this in sync with the VideoSummary typedef and the UI components.
 *
 * @param {VideoInfo} info
 * @param {{ audioAvailable?: boolean }} [options] Set false when ffmpeg is
 *   not installed, so the UI does not promise audio.
 * @returns {VideoSummary}
 */
export function toVideoSummary(info, { audioAvailable = true } = {}) {
  const details = info.videoDetails;
  const audioFormat = audioAvailable ? resolveAudioFormat(info) : null;
  const qualities = getAvailableQualities(info.formats, {
    audioAvailable: Boolean(audioFormat),
  });
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
    audio: toAudioSummary(audioFormat),
  };
}
