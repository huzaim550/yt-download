import Image from "next/image";

/**
 * Video preview, quality picker and download button.
 *
 * @param {Object} props
 * @param {Object} props.video  Video summary returned by GET /api/info.
 * @param {string} props.selectedQuality
 * @param {(value: string) => void} props.onQualityChange
 * @param {() => void} props.onDownload
 */
export default function VideoCard({
  video,
  selectedQuality,
  onQualityChange,
  onDownload,
}) {
  const selectedOption = video.qualities?.find(
    (option) => option.value === selectedQuality
  );
  const selectedLabel = selectedOption?.label || video.quality;
  const fileType = selectedOption?.container || "mp4";
  const isVideoOnly = selectedOption?.hasAudio === false;

  return (
    <section className="mt-8 grid gap-6 rounded-3xl border border-white/10 bg-zinc-950/60 p-5 shadow-xl shadow-black/20 md:grid-cols-[220px_1fr] md:p-6">
      <div className="relative min-h-[180px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
        {video.thumbnail ? (
          <Image
            src={video.thumbnail}
            alt=""
            fill
            sizes="(min-width: 768px) 220px, 100vw"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-col justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-red-300">
            Ready to download
          </p>
          <h2 className="text-2xl font-bold text-white">{video.title}</h2>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {selectedLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {video.duration}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {video.fileName}
            </span>
          </div>

          {video.qualities?.length ? (
            <div className="mt-5 max-w-xs">
              <label
                htmlFor="quality"
                className="mb-2 block text-sm text-zinc-300"
              >
                Choose quality
              </label>
              <select
                id="quality"
                value={selectedQuality}
                onChange={(event) => onQualityChange(event.target.value)}
                className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 text-base text-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                {video.qualities.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {isVideoOnly ? (
                <p className="mt-2 text-xs text-zinc-400">
                  Video only — audio is not included yet.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-red-600 to-orange-500 px-5 text-base font-semibold text-white shadow-lg shadow-red-900/40 transition hover:brightness-110 sm:w-auto sm:min-w-[220px]"
        >
          Download {fileType.toUpperCase()}
        </button>
      </div>
    </section>
  );
}
