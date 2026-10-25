# YouTube Downloader

A small Next.js app that fetches YouTube video details and streams an MP4
download with video and audio for the quality you pick.

## Requirements

- Node.js 22+ (the `@distube/ytdl-core` version used here requires a modern
  Node release)
- Network access to YouTube from the machine running the server
- [ffmpeg](https://ffmpeg.org/) for audio muxing. Without it the app still
  works, but downloads are video-only.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To open the dev server from another device on your network, set
`ALLOWED_DEV_ORIGINS` as a comma-separated list:

```bash
ALLOWED_DEV_ORIGINS=dev.example.com npm run dev
```

Other scripts:

```bash
npm run lint    # ESLint
npm run build   # production build
npm start       # run the production build
```

## How it works

```
Browser
  │
  ├─ GET /api/info?url=...          → title, thumbnail, duration, audio, qualities
  │
  └─ GET /api/download?url=...&quality=hd1080
                                    → streams video + audio as one MP4
```

1. The page asks `/api/info` for the video.
2. `lib/youtube.js` lists the available MP4 qualities and finds the best audio
   track for the summary.
3. The browser shows the dropdown and download button.
4. `/api/download` fetches the video info again and picks the matching video
   format plus an audio format.
5. `lib/ffmpeg.js` pipes both streams into ffmpeg, which remuxes them into one
   fragmented MP4. The result streams straight to the browser with
   `Content-Disposition: attachment`.

## Project structure

| File | Responsibility |
| --- | --- |
| `app/page.jsx` | Page composition, client state, fetch/download handlers |
| `app/components/SiteNav.jsx` | Sticky navigation and mobile menu |
| `app/components/Hero.jsx` | Hero copy, form panel and status message |
| `app/components/UrlForm.jsx` | URL input and "Fetch video" button |
| `app/components/VideoCard.jsx` | Preview, quality dropdown, download button |
| `app/components/VideoCardSkeleton.jsx` | Loading placeholder for the result card |
| `app/components/HowItWorks.jsx` | Three-step explainer section |
| `app/components/Notes.jsx` | Limitations and usage notes |
| `app/components/SiteFooter.jsx` | Footer |
| `app/components/Icons.jsx` | Inline SVG icon set |
| `app/globals.css` | Design tokens, fonts, background and motion |
| `app/layout.jsx` | Fonts, metadata and root layout |
| `app/api/info/route.js` | Thin `GET /api/info` handler |
| `app/api/download/route.js` | Thin `GET /api/download` handler |
| `lib/youtube.js` | Shared server-only YouTube logic (client, formats, files) |
| `lib/ffmpeg.js` | Audio muxing, ffmpeg process lifecycle and availability check |
| `lib/download-limiter.js` | Per-process cap on concurrent downloads |
| `next.config.mjs` | Next.js config, security headers, allowed thumbnail hosts |

Keep route handlers thin. Put reusable YouTube logic in `lib/youtube.js` so
both routes use the same rules.

## Where to make common changes

- **Change what appears in the dropdown** → `getAvailableQualities()` in
  `lib/youtube.js`. It currently advertises MP4 formats only.
- **Change how a requested quality maps to a stream** → `resolveFormat()` in
  `lib/youtube.js`.
- **Change which audio track is used** → `resolveAudioFormat()` in
  `lib/youtube.js`.
- **Change ffmpeg flags, cleanup or the audio fallback** → `lib/ffmpeg.js`.
- **Change the concurrent-download cap** → `MAX_CONCURRENT_DOWNLOADS` or
  `lib/download-limiter.js`.
- **Change the download file name or headers** → `getDownloadHeaders()` in
  `lib/youtube.js`.
- **Change the JSON shape returned to the page** → `toVideoSummary()` in
  `lib/youtube.js`, then the `VideoSummary` typedef right above it.
- **Change the palette, background or motion** → the `@theme` tokens and
  keyframes in `app/globals.css`.
- **Change the typefaces** → the `next/font` setup in `app/layout.jsx`.
- **Change a page section** → the matching component in `app/components/`.
- **Add a nav link** → `NAV_LINKS` in `app/components/SiteNav.jsx`, and give the
  target section a matching `id`.

### Design system

The UI uses a few custom Tailwind v4 tokens defined in `app/globals.css`:

- `ink`, `coal`, `slate` — backgrounds
- `paper`, `muted` — text
- `signal`, `ember` — red/orange accents
- `line` — hairline borders

Use the tokens instead of raw hex values so a palette change happens in one
place. Display headings use `font-display` (Bricolage Grotesque); body copy uses
the default `font-sans` (Instrument Sans).

## Important: `@distube/ytdl-core` v5 quality option

The `quality` option passed to `ytdl.download()` only accepts:

- `"highest"`, `"lowest"`
- `"highestvideo"`, `"lowestvideo"`
- `"highestaudio"`, `"lowestaudio"`
- an itag number, or an array of itag numbers

It does **not** accept resolution strings such as `"hd1080"` or `"720p"`.
Passing one throws `NO_FORMAT`.

That is why the download route resolves a format first and passes the format
object:

```js
const format = resolveFormat(info, requestedQuality);
const stream = streamFormat(info, format); // wraps ytdl.download({ format })
```

Each quality option includes its `itag`, so you can also select exactly by ID:

```js
ytdl.download(info, { quality: option.itag });
```

## Audio muxing

YouTube serves video and audio as separate DASH streams for most resolutions.
`/api/download` resolves both and pipes them into ffmpeg:

1. `resolveFormat()` picks the requested video format (MP4, AVC1/AV1 preferred).
2. `resolveAudioFormat()` picks the default audio track, preferring MP4/AAC and
   the highest bitrate.
3. `lib/ffmpeg.js` writes both streams to ffmpeg's input pipes. Video is copied
   without re-encoding, AAC audio is copied, and non-MP4 audio (for example
   Opus) is transcoded to AAC.
4. ffmpeg writes a fragmented MP4 to stdout, which is returned as the HTTP
   response. Fragmentation lets playback start before the download finishes and
   avoids needing a seekable output file.

If ffmpeg is not installed, or the source has no audio track, the same route
falls back to a video-only stream. `/api/info` reflects that in `hasAudio`, and
the UI says so instead of promising audio.

Set `FFMPEG_PATH` if the binary is not on `PATH`:

```bash
FFMPEG_PATH=/opt/ffmpeg/bin/ffmpeg npm run dev
```

Concurrent downloads are capped at 3 per process. Override it with:

```bash
MAX_CONCURRENT_DOWNLOADS=2 npm start
```

## Public deployment

This is a streaming proxy, not a file host. Every download uses server egress
and may spawn an ffmpeg process, so capacity and abuse prevention are part of
the deployment:

- Serve it behind HTTPS (Caddy or Nginx).
- Disable proxy buffering for `/api/download` and allow long read timeouts.
- Add per-IP rate limiting and connection limits at the proxy. The in-process
  `MAX_CONCURRENT_DOWNLOADS` cap only protects a single instance.
- Consider a captcha or authentication if the site is fully public.
- Use a host with a high or unmetered egress quota. YouTube may block
  datacenter IPs.
- Review YouTube's Terms of Service and the copyright rules that apply to you
  before launching a public service. This project is not affiliated with
  YouTube.

## Capacity and sizing

`MAX_CONCURRENT_DOWNLOADS` (default 3) is the main runtime limit. Media is not
stored; it is streamed through the server. In practice, egress bandwidth is the
first limit, then CPU for YouTube lookups and ffmpeg, then RAM.

| Tier | vCPU | RAM | Disk | Suggested cap | Notes |
| --- | --- | --- | --- | --- | --- |
| Launch | 2 | 2–4 GB | 40 GB SSD | 3 | low traffic; use CI or swap for builds |
| Growth | 4 | 4–8 GB | 80 GB SSD | 5–8 | steady public traffic |
| Scale | 8+ per node | 16 GB | 100 GB+ | 8–12 per node | multiple nodes and shared rate limiting |

Approximate egress:

- A 5-minute 1080p download is roughly 150–250 MB. 1,000 downloads/day is about
  5–8 TB/month.
- A 5-minute 4K download is roughly 0.7–1 GB. 1,000 downloads/day is about
  20–30 TB/month.

A single 2 vCPU / 4 GB node with a 1 Gbps port is a sensible starting point.
Raise the cap only after checking CPU, file descriptors, ffmpeg process count,
and monthly egress. Serverless platforms fit this design poorly because of
long-lived streams, child processes, and request timeouts.

## Security notes

- The URL is validated with ytdl-core's strict YouTube host allowlist before any
  network request, so the API cannot be pointed at arbitrary internal URLs
  (SSRF).
- ffmpeg is spawned directly (no shell), with fixed arguments and a minimal
  environment. User input never becomes part of the command line.
- File names strip control characters and quotes before being used in
  `Content-Disposition`, which prevents response-header injection.
- React escapes video titles and no component renders raw HTML. Production
  responses also send a CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options` and `Permissions-Policy`. `X-Powered-By` is disabled.
- API JSON and downloads send `Cache-Control: no-store`.
- The concurrent-download cap is per process, not per IP. For a public
  deployment, add per-IP rate limiting, request timeouts and authentication at
  a reverse proxy or hosting platform.
- `@distube/ytdl-core` executes YouTube's player JavaScript inside a restricted
  VM to solve signatures. Keep the dependency updated and treat it as trusted
  code.
- The app needs no secrets. `.env*` files are git-ignored.

## Deployment notes

- Use the Node.js runtime (this project uses `cacheComponents`, so the runtime
  is Node anyway).
- ffmpeg must be available in the runtime for audio. Many serverless platforms
  need a layer or a bundled static build, and some restrict spawning child
  processes at all.
- YouTube may block requests from datacenter IPs; residential/ISP egress IPs
  often work better than serverless or shared cloud hosts.
- Downloads can be large and long-running, so a platform with streaming
  responses and a generous timeout is required.
