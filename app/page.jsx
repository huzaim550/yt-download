"use client";

import { useEffect, useRef, useState } from "react";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import Notes from "./components/Notes";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import VideoCard from "./components/VideoCard";
import VideoCardSkeleton from "./components/VideoCardSkeleton";

const INITIAL_STATUS = {
  tone: "idle",
  message: "Paste a link to get started.",
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

  const resultRef = useRef(null);

  // Bring the result into view after a successful fetch, unless it is already
  // visible. Respect the user's reduced-motion preference.
  useEffect(() => {
    if (!videoInfo) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    resultRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [videoInfo]);

  async function handleFetch(event) {
    event.preventDefault();
    if (isLoading) return;

    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      setStatus({ tone: "error", message: "Add a YouTube URL first." });
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "loading", message: "Checking the video..." });

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
      setStatus({
        tone: "success",
        message: `Ready to download: ${data.title}`,
      });
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
      message: `Downloading ${option?.label || selectedQuality}. Check your browser's downloads.`,
    });
  }

  return (
    <>
      <a
        href="#download"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to download
      </a>

      <SiteNav />

      <main id="top">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Hero
            url={url}
            onUrlChange={setUrl}
            onSubmit={handleFetch}
            status={status}
            isLoading={isLoading}
          />

          <div ref={resultRef}>
            {isLoading ? <VideoCardSkeleton /> : null}
            {!isLoading && videoInfo ? (
              <VideoCard
                video={videoInfo}
                selectedQuality={selectedQuality}
                onQualityChange={setSelectedQuality}
                onDownload={handleDownload}
              />
            ) : null}
          </div>

          <HowItWorks />
          <Notes />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
