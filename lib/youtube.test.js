import test from "node:test";
import assert from "node:assert/strict";

import {
  formatDuration,
  getAvailableQualities,
  getDownloadHeaders,
  resolveFormat,
  resolveAudioFormat,
  toFileName,
  isValidVideoInput,
} from "./youtube.js";

test("isValidVideoInput accepts a YouTube video ID", () => {
  assert.equal(isValidVideoInput("dQw4w9WgXcQ"), true);
  assert.equal(isValidVideoInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
});

test("isValidVideoInput rejects invalid input", () => {
  assert.equal(isValidVideoInput("not-a-video-url"), false);
  assert.equal(isValidVideoInput(""), false);
});

test("formatDuration formats seconds into HH:MM:SS", () => {
  assert.equal(formatDuration(3661), "01:01:01");
  assert.equal(formatDuration(65), "00:01:05");
  assert.equal(formatDuration("abc"), "Unknown");
});

test("toFileName sanitizes and adds a file extension", () => {
  assert.equal(toFileName("My/Video: Test? 1", "mp4"), "My Video Test 1.mp4");
  assert.equal(toFileName("", "mp4"), "youtube-video.mp4");
});

test("getDownloadHeaders sets attachment metadata", () => {
  const headers = getDownloadHeaders({ container: "mp4" }, "Example Title");

  assert.equal(headers["Content-Type"], "video/mp4");
  assert.match(headers["Content-Disposition"], /attachment;/);
  assert.match(headers["Cache-Control"], /no-store/);
});

test("getAvailableQualities keeps unique MP4 resolutions in descending order", () => {
  const formats = [
    { hasVideo: true, hasAudio: true, quality: "hd720", qualityLabel: "720p", container: "mp4", itag: 22, videoCodec: "avc1.4d4016", isDrm: false, isOtf: false },
    { hasVideo: true, hasAudio: false, quality: "hd1080", qualityLabel: "1080p", container: "mp4", itag: 137, videoCodec: "avc1.640028", isDrm: false, isOtf: false },
    { hasVideo: true, hasAudio: true, quality: "hd1080", qualityLabel: "1080p", container: "mp4", itag: 138, videoCodec: "avc1.640028", isDrm: false, isOtf: false },
    { hasVideo: true, hasAudio: true, quality: "small", qualityLabel: "240p", container: "webm", itag: 17, videoCodec: "vp9", isDrm: false, isOtf: false },
  ];

  const qualities = getAvailableQualities(formats, { audioAvailable: true });

  assert.deepEqual(
    qualities.map((option) => option.value),
    ["hd1080", "hd720"]
  );
  assert.equal(qualities[0].hasAudio, true);
});

test("resolveFormat prefers a matching video-only MP4 quality", () => {
  const info = {
    formats: [
      { hasVideo: true, hasAudio: true, quality: "hd720", qualityLabel: "720p", container: "mp4", isDrm: false, isOtf: false },
      { hasVideo: true, hasAudio: false, quality: "hd720", qualityLabel: "720p", container: "mp4", videoCodec: "avc1.640028", isDrm: false, isOtf: false },
      { hasVideo: true, hasAudio: false, quality: "hd1080", qualityLabel: "1080p", container: "mp4", videoCodec: "avc1.640028", isDrm: false, isOtf: false },
    ],
  };

  const format = resolveFormat(info, "720p");

  assert.equal(format.quality, "hd720");
  assert.equal(format.hasAudio, false);
});

test("resolveAudioFormat favors AAC audio in MP4", () => {
  const info = {
    formats: [
      { hasAudio: true, hasVideo: false, container: "mp4", audioCodec: "opus", audioBitrate: 128000, audioTrack: { audioIsDefault: true }, isDrm: false, isOtf: false },
      { hasAudio: true, hasVideo: false, container: "mp4", audioCodec: "mp4a.40.2", audioBitrate: 192000, audioTrack: { audioIsDefault: true }, isDrm: false, isOtf: false },
      { hasAudio: true, hasVideo: false, container: "webm", audioCodec: "vorbis", audioBitrate: 160000, audioTrack: { audioIsDefault: true }, isDrm: false, isOtf: false },
    ],
  };

  const audio = resolveAudioFormat(info, { container: "mp4" });

  assert.equal(audio.audioCodec, "mp4a.40.2");
});
