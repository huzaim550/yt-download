import { Readable } from "node:stream";
import {
  getDownloadHeaders,
  getVideoInfo,
  isValidVideoInput,
  resolveFormat,
  streamVideo,
} from "@/lib/youtube";

/**
 * GET /api/download?url=<youtube-url>&quality=<quality>
 *
 * Streams the requested video quality straight to the browser. `quality` is
 * the value from the info endpoint (e.g. "hd1080"). If it is missing or does
 * not match a format, the highest available quality is used.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();
  const requestedQuality =
    searchParams.get("quality")?.trim() || "highestvideo";

  if (!url) {
    return Response.json(
      { error: "A YouTube URL is required." },
      { status: 400 }
    );
  }

  if (!isValidVideoInput(url)) {
    return Response.json(
      { error: "That doesn't look like a YouTube video URL." },
      { status: 400 }
    );
  }

  try {
    const info = await getVideoInfo(url);
    const format = resolveFormat(info, requestedQuality);

    if (!format) {
      return Response.json(
        { error: "No downloadable video format was found for this video." },
        { status: 404 }
      );
    }

    const stream = streamVideo(info, format);

    return new Response(Readable.toWeb(stream), {
      headers: getDownloadHeaders(format, info.videoDetails.title),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to download this video." },
      { status: 500 }
    );
  }
}
