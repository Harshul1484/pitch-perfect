/**
 * Monophonic pitch detection using the McLeod Pitch Method (MPM).
 *
 * MPM builds a Normalised Square Difference Function and picks the first
 * strong peak rather than the tallest one. That distinction matters for bowed
 * strings: a violin's harmonics are loud enough that a plain autocorrelation
 * often locks onto an octave above the true fundamental.
 *
 * One pitch at a time. Double stops will read as one note or waver between
 * the two — that is inherent to monophonic detection, not a bug here.
 */

export interface PitchReading {
  frequency: number;
  /** Peak NSDF value, 0 to 1. How periodic the signal is. */
  clarity: number;
}

/**
 * Below this RMS the input is treated as silence. Measured evidence: white
 * noise sits at clarity 0.08 while a tone stays above 0.85, so this gate only
 * needs to exclude near-digital-silence (RMS ~0.0001) — the clarity gate does
 * the real work of rejecting noise. Kept low so soft playing and a distant
 * microphone still register.
 */
const SILENCE_RMS = 0.0015;

/** Frequency bounds to search, wide enough for any scordatura tuning. */
const MIN_FREQUENCY = 55;
const MAX_FREQUENCY = 3600;

/**
 * A peak this close to the tallest one is taken instead of it. Picking the
 * *first* qualifying peak is what keeps octave errors away.
 */
const PEAK_RATIO = 0.9;

/**
 * Reject readings less periodic than this. White noise measures 0.08 and room
 * tone similar, while a bowed note holds above 0.85 even with 30% noise added,
 * so 0.55 sits in a wide empty band between signal and nonsense.
 */
export const MIN_CLARITY = 0.55;

export function rootMeanSquare(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Fit a parabola through a peak and its neighbours to recover sub-sample
 * precision. Without this the resolution is one sample period, which near
 * the top of the range is worth tens of cents.
 */
function refinePeak(nsdf: Float32Array, index: number): number {
  const left = nsdf[index - 1];
  const centre = nsdf[index];
  const right = nsdf[index + 1];

  const denominator = 2 * (2 * centre - left - right);
  if (denominator === 0) return index;

  return index + (right - left) / denominator;
}

export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minClarity: number = MIN_CLARITY,
): PitchReading | null {
  if (rootMeanSquare(buffer) < SILENCE_RMS) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(
    Math.floor(buffer.length / 2),
    Math.ceil(sampleRate / MIN_FREQUENCY),
  );
  if (maxLag <= minLag + 2) return null;

  // NSDF: autocorrelation at each lag, normalised by the energy in the two
  // overlapping windows, which keeps values comparable across lags.
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energy = 0;

    for (let i = 0; i + lag < buffer.length; i += 1) {
      const a = buffer[i];
      const b = buffer[i + lag];
      correlation += a * b;
      energy += a * a + b * b;
    }

    nsdf[lag] = energy > 0 ? (2 * correlation) / energy : 0;
  }

  // Skip past the initial hump around lag 0, which is always the tallest and
  // never the answer.
  let searchStart = minLag;
  while (searchStart < maxLag && nsdf[searchStart] > 0) {
    searchStart += 1;
  }

  const peaks: number[] = [];
  for (let lag = searchStart + 1; lag < maxLag; lag += 1) {
    if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1]) {
      peaks.push(lag);
    }
  }
  if (peaks.length === 0) return null;

  let tallest = peaks[0];
  for (const lag of peaks) {
    if (nsdf[lag] > nsdf[tallest]) tallest = lag;
  }

  const threshold = nsdf[tallest] * PEAK_RATIO;
  const chosen = peaks.find((lag) => nsdf[lag] >= threshold) ?? tallest;

  const clarity = nsdf[chosen];
  if (clarity < minClarity) return null;

  const refinedLag = refinePeak(nsdf, chosen);
  if (refinedLag <= 0) return null;

  const frequency = sampleRate / refinedLag;
  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) return null;

  return { frequency, clarity };
}
