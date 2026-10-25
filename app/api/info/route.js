import {
  getVideoInfo,
  isValidVideoInput,
  toVideoSummary,
} from "@/lib/youtube";

/**
 * GET /api/info?url=<youtube-url>
 *
 * Returns the title, thumbnail, duration and available MP4 qualities for a
 * video. The download page calls this before showing the download button.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();

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
    return Response.json(toVideoSummary(info));
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to fetch this video." },
      { status: 500 }
    );
  }
}
