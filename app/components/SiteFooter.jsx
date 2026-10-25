import { DownloadIcon } from "./Icons";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-signal text-ink">
            <DownloadIcon className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm text-muted">
            <span className="font-display font-semibold text-paper">reel</span>{" "}
            is a small YouTube downloader.
          </p>
        </div>
        <p className="text-xs text-muted">
          Built with Next.js. Not affiliated with YouTube.
        </p>
      </div>
    </footer>
  );
}
