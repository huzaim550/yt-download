import { Ytdl } from "@distube/ytdl-core";

const yt = new Ytdl();

function parseQualityScore(label) {
  const match = String(label || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getAvailableQualities(formats) {
  const seen = new Map();

  for (const format of formats) {
    if (!format.hasVideo || !format.quality) continue;
    // The download endpoint serves MP4 files, so only advertise MP4 qualities.
    if (format.container !== "mp4") continue;

    const label = String(format.qualityLabel || format.quality || "").trim();
    const value = String(format.quality).trim();
    if (!label || !value || seen.has(value)) continue;

    seen.set(value, {
      label,
      value,
    });
  }

  return [...seen.values()].sort((a, b) => parseQualityScore(b.label) - parseQualityScore(a.label));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "A YouTube URL is required." }, { status: 400 });
  }

  try {
    const info = await yt.getInfo(url);
    const formats = info.formats || [];
    const qualities = getAvailableQualities(formats);
    const defaultQuality = qualities[0]?.value || "highestvideo";

    const title = info.videoDetails.title || "YouTube video";
    const thumbnail = info.videoDetails.thumbnails?.at(-1)?.url || "";
    const duration = info.videoDetails.lengthSeconds
      ? new Date(Number(info.videoDetails.lengthSeconds) * 1000)
          .toISOString()
          .slice(11, 19)
      : "Unknown";

    return Response.json({
      title,
      thumbnail,
      quality: qualities[0]?.label || "best available",
      duration,
      fileName: `${title.replace(/[\\/:*?\"<>|]/g, " ").trim() || "youtube-video"}.mp4`,
      qualities,
      defaultQuality,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to fetch this video." },
      { status: 500 }
    );
  }
}
