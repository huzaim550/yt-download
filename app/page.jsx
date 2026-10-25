"use client";

import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [status, setStatus] = useState("Paste a YouTube link and fetch the video.");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState("highest");

  async function fetchVideoInfo() {
    if (!url.trim()) {
      setStatus("Add a YouTube URL first.");
      return;
    }

    setIsLoading(true);
    setStatus("Checking video details...");

    try {
      const response = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Couldn't load this YouTube video.");
      }

      setVideoInfo(data);
      setSelectedQuality(data.defaultQuality || "highest");
      setStatus(`Ready to download: ${data.title}`);
    } catch (error) {
      setVideoInfo(null);
      setStatus(error.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDownload() {
    if (!videoInfo) {
      setStatus("Fetch the video details before downloading.");
      return;
    }

    const link = document.createElement("a");
    link.href = `/api/download?url=${encodeURIComponent(url)}&quality=${encodeURIComponent(selectedQuality)}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
    setStatus(`Downloading ${videoInfo.title} in ${selectedQuality}...`);
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
            Paste a YouTube URL, fetch the video, and download it directly from your browser.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row">
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="h-14 flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 text-base text-white placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
            <button
              type="button"
              onClick={fetchVideoInfo}
              disabled={isLoading}
              className="h-14 rounded-2xl bg-red-600 px-6 text-base font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? "Loading..." : "Fetch video"}
            </button>
          </div>

          <p className="mt-4 text-sm text-zinc-300">{status}</p>
        </section>

        {videoInfo ? (
          <section className="mt-8 grid gap-6 rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-xl shadow-black/20 md:grid-cols-[220px_1fr] md:p-6">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-red-300">
                  Ready to download
                </p>
                <h2 className="text-2xl font-bold text-white">{videoInfo.title}</h2>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-300">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {videoInfo.quality}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {videoInfo.duration}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {videoInfo.fileName}
                  </span>
                </div>

                {videoInfo.qualities?.length ? (
                  <div className="mt-5 max-w-xs">
                    <label htmlFor="quality" className="mb-2 block text-sm text-zinc-300">
                      Choose quality
                    </label>
                    <select
                      id="quality"
                      value={selectedQuality}
                      onChange={(event) => setSelectedQuality(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-base text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                    >
                      {videoInfo.qualities.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:brightness-110 sm:w-auto sm:min-w-[220px]"
              >
                Download MP4
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
