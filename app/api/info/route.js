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

    return json(
      { error: error.message || "Unable to fetch this video." },
      500
    );
  }
}
