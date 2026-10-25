import { Readable } from "node:stream";
import { acquireDownloadSlot } from "@/lib/download-limiter";
import { isFfmpegAvailable, muxVideoAndAudio } from "@/lib/ffmpeg";
import {
  getDownloadHeaders,
  getVideoInfo,
  isValidVideoInput,
  resolveAudioFormat,
  resolveFormat,
  streamFormat,
} from "@/lib/youtube";

const JSON_HEADERS = { "Cache-Control": "no-store" };

function json(body, status = 200) {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

/**
 * Wrap a Node readable as a streaming Response and release the download slot
 * when the stream closes or fails.
 */
function streamResponse(stream, headers, release, signal) {
  const onAbort = () => stream.destroy();

  const cleanup = () => {
    signal?.removeEventListener("abort", onAbort);
    release();
  };

  signal?.addEventListener("abort", onAbort, { once: true });
  stream.once("close", cleanup);
  stream.once("error", (error) => {
    console.error("[api/download] stream error", error);
    cleanup();
  });

  // The client may have gone away while metadata was being fetched. Attach the
  // listener first, then check, so there is no gap between the two.
  if (signal?.aborted) {
    signal.removeEventListener("abort", onAbort);
    stream.destroy();
    release();
    return new Response(null, { status: 499 });
  }

  // A source can fail before the response is created (for example ffmpeg
  // rejecting the input). In that case there is no later close event to
  // release the slot.
  if (stream.destroyed) {
    signal?.removeEventListener("abort", onAbort);
    release();
    return new Response(null, { status: 502 });
  }

  return new Response(Readable.toWeb(stream), { headers });
}

/**
 * GET /api/download?url=<youtube-url>&quality=<quality>
 *
 * Streams the requested video quality with the best matching audio track muxed
 * in. `quality` is the value from the info endpoint (e.g. "hd1080"). If it is
 * missing or does not match a format, the highest available quality is used.
 *
 * Audio requires ffmpeg. If it is not installed, the route falls back to a
 * video-only stream instead of failing the download.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url")?.trim();
  const requestedQuality = (
    searchParams.get("quality")?.trim() || "highestvideo"
  ).slice(0, 64);

  if (!url) {
    return json({ error: "A YouTube URL is required." }, 400);
  }

  if (!isValidVideoInput(url)) {
    return json(
      { error: "That doesn't look like a YouTube video URL." },
      400
    );
  }

  const release = acquireDownloadSlot();
  if (!release) {
    return json(
      { error: "The server is busy. Try again in a moment." },
      503
    );
  }

  let handedOffToStream = false;

  try {
    const info = await getVideoInfo(url, { signal: request.signal });
    request.signal.throwIfAborted();

    const format = resolveFormat(info, requestedQuality);

    if (!format) {
      return json(
        { error: "No downloadable video format was found for this video." },
        404
      );
    }

    const headers = getDownloadHeaders(format, info.videoDetails.title);
    const canMuxAudio =
      format.container === "mp4" &&
      !format.hasAudio &&
      (await isFfmpegAvailable());

    // Audio is muxed only when ffmpeg is available and the chosen video format
    // does not already contain an audio track.
    const audioFormat = canMuxAudio
      ? resolveAudioFormat(info, format)
      : null;

    request.signal.throwIfAborted();

    const stream = audioFormat
      ? await muxVideoAndAudio({
          video: streamFormat(info, format, { signal: request.signal }),
          audio: streamFormat(info, audioFormat, { signal: request.signal }),
          audioFormat,
          signal: request.signal,
        })
      : streamFormat(info, format, { signal: request.signal });

    const response = streamResponse(
      stream,
      headers,
      release,
      request.signal
    );
    handedOffToStream = true;
    return response;
  } catch (error) {
    // Next.js reports a client disconnect as ResponseAborted; ytdl/our own
    // checks use AbortError. Neither is an application error worth logging.
    if (
      request.signal.aborted ||
      error?.name === "AbortError" ||
      error?.name === "ResponseAborted"
    ) {
      return new Response(null, { status: 499 });
    }

    const ffmpegMissing = error?.code === "ENOENT";

    console.error("[api/download]", error);

    return json(
      {
        error: ffmpegMissing
          ? "Audio muxing needs ffmpeg on the server. Install it or set FFMPEG_PATH."
          : error.message || "Unable to download this video.",
      },
      ffmpegMissing ? 503 : 500
    );
  } finally {
    if (!handedOffToStream) release();
  }
}
