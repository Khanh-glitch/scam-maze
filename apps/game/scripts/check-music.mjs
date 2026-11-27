#!/usr/bin/env node
// Checks the background-music folder against `src/game/audio/musicManifest.json`.
//
// The owner composes the tracks; this script is the hand-off check. Missing files are warnings
// (the game is silent for that cue, nothing breaks). Wrong names, wrong extensions, files too big
// or too small are errors. When `ffprobe` is installed it also checks length, sample rate, channels
// and bitrate; without it those checks are skipped and said so.
//
//   node scripts/check-music.mjs           # warnings + errors
//   node scripts/check-music.mjs --strict  # warnings count as errors (use in CI once files exist)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const manifestPath = path.join(root, "src/game/audio/musicManifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const musicDir = path.join(root, "public", manifest.directory.replace(/^\/assets\//, "assets/"));

const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const notes = [];

const barSeconds = (bpm) => (60 / bpm) * 4;
const loopSeconds = (cue) => (cue.loop ? barSeconds(cue.bpm) * cue.bars : null);
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const fmt = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
};

function ffprobe(file) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

const cues = manifest.cues;
const byFile = new Map(cues.map((cue) => [cue.file, cue]));
const allowed = new Set(manifest.format.extensions.map((ext) => `.${ext}`));
const ignored = new Set([".gitkeep", "README.md", "readme.md", ".DS_Store"]);

let present = [];
if (!existsSync(musicDir)) {
  warnings.push(`Chưa có thư mục ${path.relative(root, musicDir)} — tạo thư mục và thả file vào.`);
} else {
  present = readdirSync(musicDir).filter((name) => !ignored.has(name));
}

const ffprobeBin = spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;
if (!ffprobeBin) {
  notes.push("Không có ffprobe: bỏ qua kiểm độ dài/bitrate/kênh. Cài ffmpeg để kiểm đầy đủ.");
}

console.log(`Nhạc nền — ${path.relative(root, musicDir)}`);
console.log("");

for (const cue of cues) {
  const file = path.join(musicDir, cue.file);
  const expected = cue.loop
    ? `loop ${cue.bars} ô @ ${cue.bpm} BPM = ${fmt(loopSeconds(cue))}`
    : `one-shot ${cue.bars} ô @ ${cue.bpm} BPM, ${cue.lengthRangeSeconds.join("–")} s`;

  if (!existsSync(file)) {
    warnings.push(`Thiếu ${cue.file} (${cue.id}) — cần ${expected}. Game sẽ im lặng ở cue này.`);
    console.log(`  · ${cue.file.padEnd(20)} THIẾU   ${expected}`);
    continue;
  }

  const size = statSync(file).size;
  const ext = path.extname(cue.file);
  const problems = [];

  if (!byFile.has(cue.file)) problems.push("không có trong manifest");
  if (!allowed.has(ext)) problems.push(`đuôi ${ext} không được phép`);
  if (size > manifest.format.maxBytes) problems.push(`quá lớn: ${kb(size)} (tối đa ${kb(manifest.format.maxBytes)})`);
  if (size < manifest.format.minBytes) problems.push(`quá nhỏ: ${kb(size)} (tối thiểu ${kb(manifest.format.minBytes)})`);

  let probeTail = "";
  if (ffprobeBin) {
    const info = ffprobe(file);
    if (info) {
      const stream = (info.streams ?? []).find((s) => s.codec_type === "audio");
      const duration = Number(info.format?.duration ?? stream?.duration ?? 0);
      const bitRate = Number(info.format?.bit_rate ?? stream?.bit_rate ?? 0);
      const sampleRate = Number(stream?.sample_rate ?? 0);
      const channels = Number(stream?.channels ?? 0);

      if (!duration) {
        problems.push("ffprobe không đọc được độ dài");
      } else if (cue.loop) {
        const want = loopSeconds(cue);
        if (Math.abs(duration - want) > 2) {
          problems.push(`độ dài ${fmt(duration)} lệch khỏi ${fmt(want)} (sai số cho phép 2 s)`);
        }
      } else if (cue.lengthRangeSeconds) {
        const [lo, hi] = cue.lengthRangeSeconds;
        if (duration < lo - 2 || duration > hi + 2) {
          problems.push(`độ dài ${fmt(duration)} ngoài khoảng ${lo}–${hi} s`);
        }
      }
      if (sampleRate && sampleRate !== manifest.format.sampleRate) {
        problems.push(`sample rate ${sampleRate} Hz, cần ${manifest.format.sampleRate} Hz`);
      }
      if (channels && channels !== manifest.format.channels) {
        problems.push(`${channels} kênh, cần ${manifest.format.channels} (stereo)`);
      }
      if (ext === ".mp3" && bitRate && bitRate < 256_000) {
        notes.push(`${cue.file}: bitrate ${Math.round(bitRate / 1000)} kbps — brief yêu cầu 320 kbps CBR.`);
      }
      probeTail = ` · ${fmt(duration)} · ${Math.round(bitRate / 1000)} kbps`;
    } else {
      notes.push(`${cue.file}: ffprobe không đọc được file (có thể hỏng hoặc không phải audio).`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) errors.push(`${cue.file}: ${problem}`);
    console.log(`  ✗ ${cue.file.padEnd(20)} LỖI     ${problems.join("; ")}`);
  } else {
    console.log(`  ✓ ${cue.file.padEnd(20)} OK      ${kb(size)}${probeTail}`);
  }
}

for (const name of present) {
  if (!byFile.has(name)) {
    errors.push(`${name}: file lạ trong thư mục nhạc (không có trong manifest)`);
  }
}

const missing = cues.filter((cue) => !existsSync(path.join(musicDir, cue.file))).length;
console.log("");
console.log(
  `Tổng: ${cues.length - missing}/${cues.length} file có mặt · ${errors.length} lỗi · ${warnings.length} cảnh báo`,
);

for (const note of notes) console.log(`  ghi chú: ${note}`);
for (const warning of warnings) console.log(`  cảnh báo: ${warning}`);
for (const error of errors) console.error(`  LỖI: ${error}`);

if (errors.length > 0 || (strict && warnings.length > 0)) {
  console.error("\nKhông đạt. Xem docs/gameplay/MUSIC_BRIEF.md (mục 4 — chuẩn kỹ thuật).");
  process.exit(1);
}
console.log("\nĐạt yêu cầu (file thiếu chỉ là cảnh báo).");
