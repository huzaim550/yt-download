/**
 * URL input + "Fetch video" button.
 *
 * @param {Object} props
 * @param {string} props.url
 * @param {(value: string) => void} props.onUrlChange
 * @param {Function} props.onSubmit  Form submit handler.
 * @param {boolean} props.isLoading
 */
export default function UrlForm({ url, onUrlChange, onSubmit, isLoading }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 md:flex-row">
      <input
        type="url"
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        aria-label="YouTube video URL"
        autoComplete="off"
        spellCheck={false}
        className="h-14 flex-1 rounded-2xl border border-white/10 bg-zinc-950/70 px-4 text-base text-white placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="h-14 rounded-2xl bg-red-600 px-6 text-base font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Loading..." : "Fetch video"}
      </button>
    </form>
  );
}
