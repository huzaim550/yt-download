"use client";

import { useState } from "react";
import UrlForm from "./components/UrlForm";
import VideoCard from "./components/VideoCard";

const INITIAL_STATUS = {
  tone: "idle",
  message: "Paste a YouTube link and fetch the video.",
};

const STATUS_STYLES = {
  idle: "text-zinc-300",
  loading: "text-zinc-300",
  success: "text-emerald-300",
  error: "text-red-300",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState("highestvideo");
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [isLoading, setIsLoading] = useState(false);

  // Remember which URL produced the current videoInfo. If the user edits the
  // input afterwards, downloads still use the URL that was actually fetched.
  const [fetchedUrl, setFetchedUrl] = useState("");

  async function handleFetch(event) {
    event.preventDefault();
    if (isLoading) return;

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setStatus({ tone: "error", message: "Add a YouTube URL first." });
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "loading", message: "Checking video details..." });

    try {
      const response = await fetch(
        `/api/info?url=${encodeURIComponent(trimmedUrl)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Couldn't load this YouTube video.");
      }

      setVideoInfo(data);
      setFetchedUrl(trimmedUrl);
      setSelectedQuality(data.defaultQuality || "highestvideo");
      setStatus({ tone: "success", message: `Ready to download: ${data.title}` });
    } catch (error) {
      setVideoInfo(null);
      setFetchedUrl("");
      setStatus({
        tone: "error",
        message: error.message || "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownload() {
    if (!videoInfo || !fetchedUrl) {
      setStatus({
        tone: "error",
        message: "Fetch the video details before downloading.",
      });
      return;
    }

    const downloadUrl =
      `/api/download?url=${encodeURIComponent(fetchedUrl)}` +
      `&quality=${encodeURIComponent(selectedQuality)}`;

    // Using an anchor keeps the download in the browser without fetching the
    // whole file into JavaScript memory.
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();

    const option = videoInfo.qualities?.find(
      (quality) => quality.value === selectedQuality
    );
    setStatus({
      tone: "success",
      message: `Download started (${option?.label || selectedQuality}).`,
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#18181b,_#09090b_50%)] px-4 py-10 text-zinc-50 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="mb-3 inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-red-300">
            YouTube Downloader
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Download videos in seconds
          </h1>
          <p className="mt-4 text-base text-zinc-300 sm:text-lg">
            Paste a YouTube URL, fetch the video, and download it directly from
            your browser.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-8">
          <UrlForm
            url={url}
            onUrlChange={setUrl}
            onSubmit={handleFetch}
            isLoading={isLoading}
          />

          <p
            role="status"
            aria-live="polite"
            className={`mt-4 text-sm ${STATUS_STYLES[status.tone]}`}
          >
            {status.message}
          </p>
        </section>

        {videoInfo ? (
          <VideoCard
            video={videoInfo}
            selectedQuality={selectedQuality}
            onQualityChange={setSelectedQuality}
            onDownload={handleDownload}
          />
        ) : null}
      </div>
    </main>
  );
}
