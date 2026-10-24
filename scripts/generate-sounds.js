const fs = require("fs");
const path = require("path");

function createWavBuffer(sampleRate, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * 1 * 16 / 8)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const val = Math.max(-1, Math.min(1, samples[i]));
    const intVal = val < 0 ? val * 0x8000 : val * 0x7fff;
    buffer.writeInt16LE(Math.round(intVal), 44 + i * 2);
  }

  return buffer;
}

const SAMPLE_RATE = 44100;

function adsr(t, duration, attack = 0.01, decay = 0.05, sustain = 0.5, release = 0.1) {
  if (t < 0 || t > duration) return 0;
  if (t < attack) return t / attack;
  if (t < attack + decay) {
    const p = (t - attack) / decay;
    return 1 - p * (1 - sustain);
  }
  const sustainEnd = duration - release;
  if (t < sustainEnd) return sustain;
  const p = (t - sustainEnd) / release;
  return Math.max(0, sustain * (1 - p));
}

// ─── Tone Synthesizers ────────────────────────────────────────────────────────

function synthModern(type) {
  let duration, samplesCount;
  if (type === "success") {
    // Uplifting C5-E5-G5 triad chord (523Hz, 659Hz, 784Hz)
    duration = 0.38;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      // Staggered arpeggio
      const e1 = adsr(t, duration, 0.008, 0.08, 0.3, 0.15);
      const e2 = adsr(Math.max(0, t - 0.04), duration - 0.04, 0.008, 0.08, 0.3, 0.18);
      const e3 = adsr(Math.max(0, t - 0.08), duration - 0.08, 0.008, 0.09, 0.35, 0.22);
      
      const s1 = 0.45 * Math.sin(2 * Math.PI * 523.25 * t) * e1;
      const s2 = 0.40 * Math.sin(2 * Math.PI * 659.25 * t) * e2;
      const s3 = 0.50 * Math.sin(2 * Math.PI * 783.99 * t) * e3;
      const harm = 0.15 * Math.sin(2 * Math.PI * 1046.5 * t) * e3;
      samples[i] = (s1 + s2 + s3 + harm) * 0.75;
    }
    return samples;
  }

  if (type === "error") {
    // Sincere low warning buzz / descending interval (330Hz -> 260Hz)
    duration = 0.35;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const e = adsr(t, duration, 0.015, 0.1, 0.4, 0.15);
      const freq = 310 - 70 * (t / duration);
      const s = 0.6 * Math.sin(2 * Math.PI * freq * t) +
                0.25 * Math.sin(2 * Math.PI * (freq * 1.5) * t) +
                0.15 * Math.sin(2 * Math.PI * (freq * 2) * t);
      samples[i] = s * e * 0.8;
    }
    return samples;
  }

  if (type === "warning") {
    // Double subtle ping (A4 -> E5)
    duration = 0.32;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const e1 = adsr(t, 0.14, 0.005, 0.04, 0.2, 0.06);
      const e2 = adsr(Math.max(0, t - 0.11), 0.18, 0.005, 0.05, 0.2, 0.08);
      const s1 = 0.55 * Math.sin(2 * Math.PI * 587.33 * t) * e1;
      const s2 = 0.60 * Math.sin(2 * Math.PI * 739.99 * t) * e2;
      samples[i] = (s1 + s2) * 0.75;
    }
    return samples;
  }

  // Info: clean single crisp chime
  duration = 0.25;
  samplesCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    const t = i / SAMPLE_RATE;
    const e = adsr(t, duration, 0.006, 0.06, 0.2, 0.12);
    const s = 0.6 * Math.sin(2 * Math.PI * 659.25 * t) + 0.25 * Math.sin(2 * Math.PI * 1318.5 * t);
    samples[i] = s * e * 0.75;
  }
  return samples;
}

function synthChime(type) {
  let duration, samplesCount;
  if (type === "success") {
    // Resonant celestial bell chord (D5 + F#5 + A5)
    duration = 0.55;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 5.5);
      const s1 = 0.45 * Math.sin(2 * Math.PI * 587.33 * t);
      const s2 = 0.40 * Math.sin(2 * Math.PI * 739.99 * t);
      const s3 = 0.45 * Math.sin(2 * Math.PI * 880.00 * t);
      const shimmer = 0.15 * Math.sin(2 * Math.PI * 1760.0 * t);
      samples[i] = (s1 + s2 + s3 + shimmer) * env * 0.7;
    }
    return samples;
  }

  if (type === "error") {
    duration = 0.45;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 6.5);
      const s1 = 0.5 * Math.sin(2 * Math.PI * 277.18 * t);
      const s2 = 0.4 * Math.sin(2 * Math.PI * 329.63 * t);
      samples[i] = (s1 + s2) * env * 0.75;
    }
    return samples;
  }

  if (type === "warning") {
    duration = 0.42;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env1 = t < 0.18 ? Math.exp(-t * 12) : 0;
      const env2 = t >= 0.12 ? Math.exp(-(t - 0.12) * 10) : 0;
      const s1 = 0.55 * Math.sin(2 * Math.PI * 698.46 * t) * env1;
      const s2 = 0.60 * Math.sin(2 * Math.PI * 880.00 * t) * env2;
      samples[i] = (s1 + s2) * 0.75;
    }
    return samples;
  }

  // Info chime
  duration = 0.45;
  samplesCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 6.0);
    const s = 0.65 * Math.sin(2 * Math.PI * 880.0 * t) + 0.25 * Math.sin(2 * Math.PI * 1760.0 * t);
    samples[i] = s * env * 0.7;
  }
  return samples;
}

function synthPop(type) {
  let duration, samplesCount;
  if (type === "success") {
    // Quick ascending pitch sweep / bubble pop
    duration = 0.22;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = adsr(t, duration, 0.003, 0.05, 0.25, 0.08);
      const freq = 450 + 600 * Math.sqrt(t / duration);
      const s = 0.8 * Math.sin(2 * Math.PI * freq * t);
      samples[i] = s * env * 0.8;
    }
    return samples;
  }

  if (type === "error") {
    // Low hollow pop
    duration = 0.25;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = adsr(t, duration, 0.004, 0.06, 0.2, 0.1);
      const freq = 280 - 120 * (t / duration);
      const s = 0.8 * Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(2 * Math.PI * (freq * 2) * t);
      samples[i] = s * env * 0.8;
    }
    return samples;
  }

  if (type === "warning") {
    // Double bubble pop
    duration = 0.28;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env1 = adsr(t, 0.11, 0.003, 0.04, 0.15, 0.04);
      const env2 = adsr(Math.max(0, t - 0.09), 0.15, 0.003, 0.04, 0.15, 0.06);
      const s1 = Math.sin(2 * Math.PI * 520 * t) * env1;
      const s2 = Math.sin(2 * Math.PI * 680 * t) * env2;
      samples[i] = (s1 + s2) * 0.7;
    }
    return samples;
  }

  // Info
  duration = 0.18;
  samplesCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    const t = i / SAMPLE_RATE;
    const env = adsr(t, duration, 0.003, 0.04, 0.15, 0.06);
    const freq = 600 + 200 * (t / duration);
    const s = 0.8 * Math.sin(2 * Math.PI * freq * t);
    samples[i] = s * env * 0.75;
  }
  return samples;
}

function synthSubtle(type) {
  let duration, samplesCount;
  if (type === "success") {
    // High soft subtle tick (880Hz -> 1174Hz)
    duration = 0.12;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 35);
      const s = 0.65 * Math.sin(2 * Math.PI * 987.77 * t);
      samples[i] = s * env * 0.65;
    }
    return samples;
  }

  if (type === "error") {
    duration = 0.16;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 25);
      const s = 0.65 * Math.sin(2 * Math.PI * 261.63 * t);
      samples[i] = s * env * 0.7;
    }
    return samples;
  }

  if (type === "warning") {
    duration = 0.18;
    samplesCount = Math.floor(SAMPLE_RATE * duration);
    const samples = new Float32Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const t = i / SAMPLE_RATE;
      const env1 = t < 0.07 ? Math.exp(-t * 40) : 0;
      const env2 = t >= 0.06 ? Math.exp(-(t - 0.06) * 35) : 0;
      const s1 = 0.5 * Math.sin(2 * Math.PI * 784 * t) * env1;
      const s2 = 0.55 * Math.sin(2 * Math.PI * 880 * t) * env2;
      samples[i] = (s1 + s2) * 0.7;
    }
    return samples;
  }

  // Info
  duration = 0.1;
  samplesCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(samplesCount);
  for (let i = 0; i < samplesCount; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 38);
    const s = 0.6 * Math.sin(2 * Math.PI * 740 * t);
    samples[i] = s * env * 0.65;
  }
  return samples;
}

// ─── Directory generation ─────────────────────────────────────────────────────

const BASE_DIR = path.resolve(__dirname, "../public/sounds");
const THEMES = [
  { name: "modern", synth: synthModern },
  { name: "chime", synth: synthChime },
  { name: "pop", synth: synthPop },
  { name: "subtle", synth: synthSubtle },
];
const TYPES = ["success", "error", "warning", "info"];

for (const theme of THEMES) {
  const dir = path.join(BASE_DIR, theme.name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  for (const type of TYPES) {
    const samples = theme.synth(type);
    const wav = createWavBuffer(SAMPLE_RATE, samples);
    const filePath = path.join(dir, `${type}.wav`);
    fs.writeFileSync(filePath, wav);
    console.log(`Generated: ${theme.name}/${type}.wav (${wav.length} bytes)`);
  }
}

console.log("All audio assets generated successfully!");
