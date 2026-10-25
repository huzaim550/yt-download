import Image from "next/image";
import { ChevronIcon, DownloadIcon } from "./Icons";

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
    <section
      aria-label="Selected video"
      className="card-in mt-8 overflow-hidden rounded-2xl border border-line bg-coal"
    >
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="relative flex items-center justify-center overflow-hidden bg-slate md:min-h-[248px]">
          {video.thumbnail ? (
            <>
              <Image
                src={video.thumbnail}
                alt=""
                fill
                sizes="(min-width: 768px) 260px, 100vw"
                className="scale-110 object-cover opacity-30 blur-2xl"
              />
              <div className="relative m-4 aspect-video w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-paper/10 shadow-2xl shadow-black/50">
                <Image
                  src={video.thumbnail}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 228px, 90vw"
                  className="object-cover"
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-paper sm:text-3xl">
              {video.title}
            </h2>

            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
              <div className="bg-coal px-4 py-3">
                <dt className="text-xs text-muted">Resolution</dt>
                <dd className="mt-1 text-sm font-medium text-paper">
                  {selectedLabel}
                </dd>
              </div>
              <div className="bg-coal px-4 py-3">
                <dt className="text-xs text-muted">Duration</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-paper">
                  {video.duration}
                </dd>
              </div>
              <div className="col-span-2 bg-coal px-4 py-3 sm:col-span-1">
                <dt className="text-xs text-muted">File</dt>
                <dd
                  className="mt-1 truncate text-sm font-medium text-paper"
                  title={video.fileName}
                >
                  {video.fileName}
                </dd>
              </div>
            </dl>

            {video.qualities?.length ? (
              <div className="mt-5 max-w-sm">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="quality"
                    className="text-sm font-medium text-paper"
                  >
                    Quality
                  </label>
                  <span className="text-xs text-muted">
                    {video.qualities.length} options
                  </span>
                </div>

                <div className="relative mt-2">
                  <select
                    id="quality"
                    value={selectedQuality}
                    onChange={(event) => onQualityChange(event.target.value)}
                    className="h-11 w-full appearance-none rounded-xl border border-line bg-slate px-4 pr-10 text-sm text-paper transition focus:border-signal/60 focus:outline-none focus:ring-4 focus:ring-signal/10"
                  >
                    {video.qualities.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>

                <p className="mt-2 text-xs text-muted">
                  {isVideoOnly
                    ? "Video only — audio is not available for this download."
                    : `Includes ${video.audio?.codec || "audio"}${
                        video.audio?.bitrate
                          ? ` at ${video.audio.bitrate} kbps`
                          : ""
                      }.`}
                </p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-signal px-5 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/70 focus-visible:ring-offset-2 focus-visible:ring-offset-coal sm:w-auto sm:min-w-[200px] sm:self-start"
          >
            <DownloadIcon className="h-4 w-4" />
            Download {fileType.toUpperCase()}
          </button>
        </div>
      </div>
    </section>
  );
}
