import { isFfmpegAvailable } from "@/lib/ffmpeg";
import {
  getVideoInfo,
  isValidVideoInput,
  toVideoSummary,
} from "@/lib/youtube";

const JSON_HEADERS = { "Cache-Control": "no-store" };

function json(body, status = 200) {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

function getYouTubeServerErrorMessage(error) {
  const code = error?.code || error?.name || "";
  const message = String(error?.message || "");

  if (code === "PLAYER_SOLVE_FAILED" || message.includes("Could not prepare player")) {
    return "YouTube blocked this server IP while preparing the video. This app needs a non-datacenter IP or a different hosting setup to fetch YouTube metadata.";
  }

  if (code === "ERR_NO_SUPPORTED_FORMATS" || message.includes("No video formats available")) {
    return "This video is not available for download from this server.";
  }

  if (message.includes("Could not play")) {
    return "YouTube refused to serve this video to this server environment.";
  }

  return error?.message || "Unable to fetch this video.";
}

/**
 * GET /api/info?url=<youtube-url>
 *
 * Returns the title, thumbnail, duration, audio metadata and available MP4
 * qualities for a video. The download page calls this before showing the
 * download button.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();

  if (!url) {
    return json({ error: "A YouTube URL is required." }, 400);
  }

  if (!isValidVideoInput(url)) {
    return json(
      { error: "That doesn't look like a YouTube video URL." },
      400
    );
  }

  try {
    const [info, audioAvailable] = await Promise.all([
      getVideoInfo(url, { signal: request.signal }),
      isFfmpegAvailable(),
    ]);

    return json(toVideoSummary(info, { audioAvailable }));
  } catch (error) {
    if (
      request.signal.aborted ||
      error?.name === "AbortError" ||
      error?.name === "ResponseAborted"
    ) {
      return new Response(null, { status: 499 });
    }

    console.error("[api/info] fetch failed", error);

    return json(
      {
        error: getYouTubeServerErrorMessage(error),
      },
      500
    );
  }
}
