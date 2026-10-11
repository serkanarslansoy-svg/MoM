// Speech-to-text on this device with Whisper (transformers.js).
// The audio never leaves the device; only the model files are downloaded once
// from Hugging Face and then kept in the browser cache.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1";

env.allowLocalModels = false;

const SR = 16000;
const PRESETS = {
  base:  { model: "onnx-community/whisper-base",  device: "wasm", dtype: { encoder_model: "q8", decoder_model_merged: "q8" } },
  small: { model: "onnx-community/whisper-small", device: "wasm", dtype: { encoder_model: "q8", decoder_model_merged: "q8" } },
  turbo: { model: "onnx-community/whisper-large-v3-turbo", device: "webgpu", dtype: { encoder_model: "q4", decoder_model_merged: "q4" } },
};

// Phrases Whisper is known to invent on noise or silence (subtitle credits and the like).
const HALLUCINATIONS = /sottotitoli|amara\.org|qtss|grazie per la visione|iscriviti al canale|thanks? (you )?for watching|subtitles by|www\.\S+\.(it|com)/i;

let asr = null, loadedKey = null;

async function hasWebGPU() {
  try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch { return false; }
}

async function resolvePreset(name) {
  const gpu = await hasWebGPU();
  if (name === "auto") name = gpu ? "turbo" : "small";
  if (name === "turbo" && !gpu) name = "small";
  return name;
}

async function load(name) {
  if (asr && loadedKey === name) return;
  const p = PRESETS[name];
  const files = new Map();
  asr = await pipeline("automatic-speech-recognition", p.model, {
    device: p.device,
    dtype: p.dtype,
    progress_callback: (e) => {
      if (e.status === "progress" && e.total) {
        files.set(e.file, [e.loaded, e.total]);
        let loaded = 0, total = 0;
        for (const [l, t] of files.values()) { loaded += l; total += t; }
        postMessage({ type: "model", loaded, total });
      }
    },
  });
  loadedKey = name;
}

// Cut the recording into pieces of 20–30 s, ending each piece at the quietest
// moment near its end so words are rarely split in half.
function segments(audio) {
  const MAX = 30 * SR, MIN = 20 * SR, WIN = Math.round(0.1 * SR);
  const out = [];
  let start = 0;
  while (start < audio.length) {
    let end = Math.min(audio.length, start + MAX);
    if (end < audio.length) {
      let best = end, bestE = Infinity;
      for (let p = start + MIN; p + WIN <= end; p += WIN / 2) {
        let e = 0;
        for (let k = p; k < p + WIN; k += 4) e += audio[k] * audio[k];
        if (e < bestE) { bestE = e; best = p + WIN / 2; }
      }
      end = best;
    }
    out.push([start, end]);
    start = end;
  }
  return out;
}

function rms(a) { let s = 0; for (let i = 0; i < a.length; i += 8) s += a[i] * a[i]; return Math.sqrt(s / (a.length / 8)); }

function clean(text) {
  text = text.trim();
  if (!text || HALLUCINATIONS.test(text)) return "";
  // collapse a phrase repeated over and over (a classic Whisper loop)
  text = text.replace(/(\S.{4,120}?)(?:[\s,.]*\1){2,}/gi, "$1 […]");
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = [];
  for (const p of parts) if (kept.filter(k => k === p).length < 2) kept.push(p);
  return kept.join(" ");
}

self.onmessage = async ({ data }) => {
  if (data.type !== "run") return;
  try {
    let name = await resolvePreset(data.preset);
    postMessage({ type: "status", text: "Model yükleniyor", preset: name });
    try {
      await load(name);
    } catch (err) {
      if (name !== "turbo") throw err;
      // the large model can fail on weaker graphics cards: fall back
      name = "small";
      postMessage({ type: "status", text: "Büyük model açılamadı, orta modele geçildi", preset: name });
      await load(name);
    }
    const audio = data.audio;
    const segs = segments(audio);
    postMessage({ type: "start", total: segs.length, seconds: audio.length / SR, preset: name });
    for (let i = 0; i < segs.length; i++) {
      const [s, e] = segs[i];
      const piece = audio.slice(s, e);
      let text = "";
      if (rms(piece) > 0.002) {
        const out = await asr(piece, { language: data.language || null, task: "transcribe" });
        text = clean(out.text || "");
      }
      postMessage({ type: "piece", index: i, total: segs.length, endSec: e / SR, text });
    }
    postMessage({ type: "done" });
  } catch (err) {
    postMessage({ type: "error", message: String(err && err.message || err) });
  }
};
