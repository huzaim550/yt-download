const STEPS = [
  {
    title: "Paste the link",
    body: "Drop in a watch, share or Shorts URL. The video stays on YouTube until you ask for it.",
  },
  {
    title: "Pick a quality",
    body: "The list only shows MP4 resolutions this video actually offers, from 144p up to 4K when available.",
  },
  {
    title: "Keep the file",
    body: "Video and audio are muxed on the fly, then streamed straight to your device. No copy is left on the server.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-line py-14 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Three steps, start to file.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            No settings to learn. The quality list comes straight from the video
            you paste.
          </p>
        </div>

        <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col bg-coal p-5 sm:p-6"
            >
              <span className="font-display text-2xl font-semibold text-signal">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-8 font-display text-lg font-semibold tracking-tight text-paper">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
