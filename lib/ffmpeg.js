import { spawn } from "node:child_process";

/**
 * ffmpeg integration.
 *
 * YouTube serves video and audio as separate DASH streams, so a "video with
 * sound" download means muxing two streams into one file. We use ffmpeg with
 * `-c copy` where possible, which remuxes without re-encoding.
 *
 * Install ffmpeg and make sure it is on PATH, or set FFMPEG_PATH to the
 * executable. On hosts without ffmpeg the app still works, but downloads are
 * video-only.
 */

const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";

// ffmpeg does not need the server's environment (and any secrets in it). Keep
// only what a binary normally needs to resolve and run.
const CHILD_ENV = {
  PATH: process.env.PATH || "",
  LANG: process.env.LANG || "C",
  // Windows needs these to resolve system DLLs; they are harmless elsewhere.
  ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
  ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
};

let ffmpegAvailable;

/**
 * Check once whether ffmpeg can be executed. The info endpoint uses this so the
 * UI does not promise audio on a server that cannot mux it.
 *
 * @returns {Promise<boolean>}
 */
export function isFfmpegAvailable() {
  if (ffmpegAvailable) return ffmpegAvailable;

  ffmpegAvailable = new Promise((resolve) => {
    try {
      const probe = spawn(
        /*turbopackIgnore: true*/
        FFMPEG_PATH,
        ["-version"],
        { stdio: "ignore", env: CHILD_ENV, windowsHide: true }
      );
      const timer = setTimeout(() => {
        probe.kill("SIGKILL");
        resolve(false);
      }, 5000);
      timer.unref?.();

      probe.once("error", () => {
        clearTimeout(timer);
        resolve(false);
      });
      probe.once("close", (code) => {
        clearTimeout(timer);
        resolve(code === 0);
      });
    } catch {
      resolve(false);
    }
  });

  return ffmpegAvailable;
}

/**
 * Mux a video-only stream and an audio-only stream into one fragmented MP4.
 *
 * The video and audio arrive on file descriptors 3 and 4. ffmpeg reads both,
 * copies the codecs (AAC is re-encoded only if the source audio is not MP4),
 * and writes a fragmented MP4 to stdout so it can stream to the browser.
 *
 * @param {Object} options
 * @param {import("node:stream").Readable} options.video
 * @param {import("node:stream").Readable} options.audio
 * @param {{ container?: string } | null} options.audioFormat
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<import("node:stream").Readable>} ffmpeg's stdout.
 */
export async function muxVideoAndAudio({
  video,
  audio,
  audioFormat,
  signal,
}) {
  // Do not even start ffmpeg if the client disconnected while metadata was
  // loading. The caller creates the source streams before calling us.
  if (signal?.aborted) {
    video.destroy?.();
    audio.destroy?.();
    signal.throwIfAborted();
  }

  const copyAudio = audioFormat?.container === "mp4";

  const ffmpeg = spawn(
    /*turbopackIgnore: true*/
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      // fd 3 = video, fd 4 = audio.
      "-i",
      "pipe:3",
      "-i",
      "pipe:4",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      ...(copyAudio
        ? ["-c:a", "copy"]
        : ["-c:a", "aac", "-b:a", "192k"]),
      // Fragmented MP4 can be streamed without seeking and starts playing
      // before the whole file is downloaded.
      "-movflags",
      "+frag_keyframe+empty_moov+default_base_moof",
      "-f",
      "mp4",
      "pipe:1",
    ],
    {
      stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
      env: CHILD_ENV,
      windowsHide: true,
    }
  );

  try {
    // Resolve only once the process exists; a missing ffmpeg rejects here with
    // ENOENT, before we return any response headers.
    await new Promise((resolve, reject) => {
      const onSpawn = () => {
        ffmpeg.off("error", onError);
        resolve();
      };
      const onError = (error) => {
        ffmpeg.off("spawn", onSpawn);
        reject(error);
      };

      ffmpeg.once("spawn", onSpawn);
      ffmpeg.once("error", onError);
    });
  } catch (error) {
    video.destroy?.();
    audio.destroy?.();

    // Do not put the executable path or other spawn details in the HTTP
    // response. The original error is kept as the cause for server logs.
    const safeError = new Error("Unable to start audio muxing.");
    safeError.code = error?.code;
    safeError.cause = error;
    throw safeError;
  }

  // ffmpeg's stderr must be consumed or the pipe can stall. Keep a small tail
  // for the server log when the process fails.
  let stderr = "";
  ffmpeg.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;

    video.destroy?.();
    audio.destroy?.();
    if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
  };

  const onAbort = () => stop();

  // If the browser cancels the download, stop ffmpeg and both source streams.
  signal?.addEventListener("abort", onAbort, { once: true });

  // If the consumer cancels or destroys stdout, make sure ffmpeg and the
  // source streams go away too (destroying stdout alone does not kill it).
  ffmpeg.stdout.once("close", stop);

  // The request may have been aborted while the process was starting; in that
  // case the abort event has already fired and will not fire again.
  if (signal?.aborted) {
    stop();
    signal.throwIfAborted();
  }

  // Keep late process errors from becoming unhandled exceptions.
  ffmpeg.on("error", (error) => {
    console.error("[ffmpeg] process error", error);
    stop();
  });

  // If any pipe fails (for example ffmpeg exits early), clean everything up.
  video.on("error", stop);
  audio.on("error", stop);
  ffmpeg.stdio[3]?.on("error", stop);
  ffmpeg.stdio[4]?.on("error", stop);

  ffmpeg.on("close", (code) => {
    stopped = true;
    signal?.removeEventListener("abort", onAbort);

    video.destroy?.();
    audio.destroy?.();

    if (code !== 0 && code !== null) {
      console.error(`[ffmpeg] exited with code ${code}`, stderr.trim());
    }
  });

  video.pipe(ffmpeg.stdio[3]);
  audio.pipe(ffmpeg.stdio[4]);

  return ffmpeg.stdout;
}
