import { Readable } from "node:stream";
import { Ytdl } from "@distube/ytdl-core";

const yt = new Ytdl();

function makeSafeFileName(title, fallback = "youtube-video") {
  const cleaned = String(title || fallback)
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const asciiName = (cleaned || fallback)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return asciiName || fallback;
}

function getQualityScore(format) {
  return Number(String(format.qualityLabel || format.quality || "0").match(/\d+/)?.[0] || 0);
}

function getCodecScore(format) {
  const codec = String(format.videoCodec || "");
  if (codec.startsWith("avc1")) return 2;
  if (codec.startsWith("av01")) return 1;
  return 0;
}

function matchesQuality(format, requested) {
  const normalized = requested.toLowerCase().replace(/p$/, "");
  const quality = String(format.quality || "").toLowerCase();
  const label = String(format.qualityLabel || "").toLowerCase();
  const requestedScore = Number(requested.match(/\d+/)?.[0] || 0);

  return (
    quality === normalized ||
    label === normalized ||
    quality.replace(/p$/, "") === normalized ||
    label.replace(/p$/, "") === normalized ||
    (requestedScore > 0 && getQualityScore(format) === requestedScore)
  );
}

function resolveVideoFormat(info, preferredQuality) {
  const formats = (info?.formats || []).filter(
    (format) => format.hasVideo && !format.isDrm && !format.isOtf
  );

  if (!formats.length) {
    return null;
  }

  // Prefer MP4 (the file we serve), then video-only streams, then fall back to
  // muxed formats when a quality only exists there.
  const mp4Formats = formats.filter((format) => format.container === "mp4");
  const pool = mp4Formats.length ? mp4Formats : formats;
  const videoOnly = pool.filter((format) => !format.hasAudio);
  const requested = String(preferredQuality || "").trim();

  const byPreference = (a, b) =>
    getCodecScore(b) - getCodecScore(a) || getQualityScore(b) - getQualityScore(a);

  if (requested) {
    for (const candidates of [videoOnly, pool]) {
      const exact = candidates
        .filter((format) => matchesQuality(format, requested))
        .sort(byPreference)[0];
      if (exact) return exact;
    }
  }

  return [...(videoOnly.length ? videoOnly : pool)].sort(byPreference)[0];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const requestedQuality = searchParams.get("quality") || "highestvideo";

  if (!url) {
    return Response.json({ error: "A YouTube URL is required." }, { status: 400 });
  }

  try {
    const info = await yt.getInfo(url);
    const title = info.videoDetails.title || "youtube-video";
    const selectedFormat = resolveVideoFormat(info, requestedQuality);

    if (!selectedFormat) {
      return Response.json(
        { error: "No downloadable video format was found for this video." },
        { status: 404 }
      );
    }

    // v5 only accepts `highest`/`lowest`/`highestvideo`/`lowestvideo`/itags as
    // `quality`; passing a format object selects the exact resolution instead.
    const stream = yt.download(info, { format: selectedFormat });
    const extension = selectedFormat.container === "webm" ? "webm" : "mp4";
    const contentType = extension === "webm" ? "video/webm" : "video/mp4";
    const fileName = `${makeSafeFileName(title)}.${extension}`;

    const webStream = Readable.toWeb(stream);
    return new Response(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to download this video." },
      { status: 500 }
    );
  }
}
