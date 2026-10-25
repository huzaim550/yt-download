/**
 * Placeholder shown while /api/info is loading.
 * The live status message handles the announcement for screen readers.
 */
export default function VideoCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="mt-8 overflow-hidden rounded-2xl border border-line bg-coal"
    >
      <div className="grid md:grid-cols-[260px_1fr]">
        <div className="aspect-video animate-pulse bg-slate md:min-h-[248px]" />

        <div className="space-y-4 p-5 sm:p-6">
          <div className="h-8 w-3/4 animate-pulse rounded-md bg-slate" />
          <div className="h-4 w-1/2 animate-pulse rounded-md bg-slate" />

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-2 bg-coal px-4 py-3">
                <div className="h-3 w-16 animate-pulse rounded bg-slate" />
                <div className="h-4 w-12 animate-pulse rounded bg-slate" />
              </div>
            ))}
          </div>

          <div className="h-11 w-full max-w-sm animate-pulse rounded-xl bg-slate" />
          <div className="h-12 w-full max-w-[200px] animate-pulse rounded-xl bg-slate" />
        </div>
      </div>
    </div>
  );
}
