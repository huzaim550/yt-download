const NOTES = [
  {
    title: "Video + audio",
    body: "YouTube serves video and audio separately, so the server muxes them with ffmpeg before sending the file. If ffmpeg is missing, downloads fall back to video only.",
  },
  {
    title: "Nothing is stored",
    body: "The server passes the file through to your browser. No copy is kept after the request ends.",
  },
  {
    title: "Source decides the quality",
    body: "The list shows the MP4 resolutions this video actually offers. If 4K is missing, the source does not have it.",
  },
  {
    title: "Download responsibly",
    body: "Use this for videos you own or have permission to save. Respect the creator's rights.",
  },
];

export default function Notes() {
  return (
    <section
      id="notes"
      className="scroll-mt-24 border-t border-line py-14 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Before you download.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            The small print, without the fine-print feeling.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
          {NOTES.map((note) => (
            <article key={note.title} className="bg-coal p-5 sm:p-6">
              <h3 className="font-display text-base font-semibold tracking-tight text-paper">
                {note.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {note.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
