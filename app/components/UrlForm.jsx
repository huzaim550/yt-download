/**
 * URL input and fetch button.
 *
 * @param {Object} props
 * @param {string} props.url
 * @param {(value: string) => void} props.onUrlChange
 * @param {Function} props.onSubmit  Form submit handler.
 * @param {boolean} props.isLoading
 */
export default function UrlForm({ url, onUrlChange, onSubmit, isLoading }) {
  return (
    <form onSubmit={onSubmit} className="mt-4">
      <label htmlFor="url" className="text-sm font-medium text-paper">
        Video link
      </label>
      <input
        id="url"
        type="text"
        inputMode="url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        aria-label="YouTube video URL"
        autoComplete="off"
        spellCheck={false}
        className="mt-2 h-12 w-full rounded-xl border border-line bg-slate px-4 text-sm text-paper placeholder:text-muted/70 transition focus:border-signal/60 focus:outline-none focus:ring-4 focus:ring-signal/10"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-signal px-5 text-sm font-semibold text-ink transition hover:bg-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/70 focus-visible:ring-offset-2 focus-visible:ring-offset-coal disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Checking video..." : "Fetch video"}
      </button>
    </form>
  );
}
