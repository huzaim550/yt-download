# YouTube Downloader

A small Next.js app that fetches YouTube video details and streams an MP4
download for the quality you pick.

## Requirements

- Node.js 22+ (the `@distube/ytdl-core` version used here requires a modern
  Node release)
- Network access to YouTube from the machine running the server

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
  ├─ GET /api/info?url=...          → title, thumbnail, duration, qualities
  │
  └─ GET /api/download?url=...&quality=hd1080
                                    → streams the selected video format
```

1. The page asks `/api/info` for the video.
2. `lib/youtube.js` lists the available MP4 qualities.
3. The browser shows the dropdown and download button.
4. `/api/download` fetches the video info again, picks the matching format and
   streams it straight to the browser with `Content-Disposition: attachment`.

## Project structure

| File | Responsibility |
| --- | --- |
| `app/page.jsx` | Page layout, client state, fetch/download handlers |
| `app/components/UrlForm.jsx` | URL input and "Fetch video" button |
| `app/components/VideoCard.jsx` | Preview, quality dropdown, download button |
| `app/api/info/route.js` | Thin `GET /api/info` handler |
| `app/api/download/route.js` | Thin `GET /api/download` handler |
| `lib/youtube.js` | Shared server-only YouTube logic (client, formats, files) |
| `next.config.mjs` | Next.js/Tailwind configuration |

Keep route handlers thin. Put reusable YouTube logic in `lib/youtube.js` so
both routes use the same rules.

## Where to make common changes

- **Change what appears in the dropdown** → `getAvailableQualities()` in
  `lib/youtube.js`. It currently advertises MP4 formats only.
- **Change how a requested quality maps to a stream** → `resolveFormat()` in
  `lib/youtube.js`.
- **Change the download file name or headers** → `getDownloadHeaders()` in
  `lib/youtube.js`.
- **Change the JSON shape returned to the page** → `toVideoSummary()` in
  `lib/youtube.js`, then the `VideoSummary` typedef right above it.
- **Change the look of the page** → `app/page.jsx` and `app/components/`.

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
const stream = ytdl.download(info, { format });
```

Each quality option includes its `itag`, so you can also select exactly by ID:

```js
ytdl.download(info, { quality: option.itag });
```

## Known limitation: no audio yet

YouTube serves video and audio as separate streams for most resolutions. The
current download route streams the video track only, so the downloaded file is
silent.

To add audio you would need to mux the two streams, for example with `ffmpeg`:

1. Resolve a video format and a matching audio format.
2. Spawn `ffmpeg` and pipe both ytdl streams into it.
3. Stream `ffmpeg`'s stdout back as the HTTP response.

Keep that code in `lib/` (for example `lib/mux.js`) and leave the route handler
focused on HTTP.

## Deployment notes

- Use the Node.js runtime (this project uses `cacheComponents`, so the runtime
  is Node anyway).
- YouTube may block requests from datacenter IPs; home/self-hosted servers
  usually work better than serverless hosts.
- Downloads can be large and long-running, so a platform with streaming
  responses and a generous timeout is required.
