import { CheckIcon } from "./Icons";
import UrlForm from "./UrlForm";

const DOT_STYLES = {
  idle: "bg-muted",
  loading: "bg-ember animate-pulse",
  success: "bg-ember",
  error: "bg-signal",
};

const TEXT_STYLES = {
  idle: "text-muted",
  loading: "text-muted",
  success: "text-paper",
  error: "text-signal",
};

/**
 * Hero copy plus the download form.
 *
 * @param {Object} props
 * @param {string} props.url
 * @param {(value: string) => void} props.onUrlChange
 * @param {Function} props.onSubmit
 * @param {{ tone: string, message: string }} props.status
 * @param {boolean} props.isLoading
 */
export default function Hero({
  url,
  onUrlChange,
  onSubmit,
  status,
  isLoading,
}) {
  return (
    <section className="grid gap-10 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-20 lg:pt-20">
      <div className="max-w-xl">
        <p className="rise-in text-sm text-muted">A small YouTube downloader</p>
        <h1 className="rise-in mt-4 font-display text-5xl font-semibold leading-[0.95] tracking-[-0.035em] text-paper sm:text-6xl lg:text-7xl">
          Watch it once.
          <br />
          Keep it forever.
        </h1>
        <p className="rise-in mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg">
          Paste a link, choose a quality, and save the video straight to your
          device. No account, no queue.
        </p>
        <p className="rise-in mt-8 flex items-start gap-2 text-sm text-muted">
          <CheckIcon className="mt-0.5 h-4 w-4 text-ember" />
          Works with youtube.com, youtu.be and Shorts links.
        </p>
      </div>

      <div
        id="download"
        className="rise-in-late scroll-mt-24 rounded-2xl border border-line bg-coal/90 p-5 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.95)] sm:p-6"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-paper">
            Download a video
          </h2>
          <span className="text-xs text-muted">MP4</span>
        </div>

        <UrlForm
          url={url}
          onUrlChange={onUrlChange}
          onSubmit={onSubmit}
          isLoading={isLoading}
        />

        <div className="mt-4 flex items-start gap-2.5 text-sm">
          <span
            className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${DOT_STYLES[status.tone]}`}
          />
          <p
            role="status"
            aria-live="polite"
            className={TEXT_STYLES[status.tone]}
          >
            {status.message}
          </p>
        </div>

        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
          Video and audio are muxed into one MP4 when the source provides both.
        </p>
      </div>
    </section>
  );
}
