import { FIXED_CONSTANTS } from "./config";

export interface LowPassSpec {
  readonly cutoffHz: number;
  readonly order: number;
}

export interface SecondOrderSection {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

const EDGE_PAD_FACTOR = 3;

export function assertSampleRateHz(sampleRateHz: number): void {
  if (!(sampleRateHz > 0) || !Number.isFinite(sampleRateHz)) {
    throw new RangeError(`filter: sampleRateHz must be a positive finite number, got ${sampleRateHz}`);
  }
}

export function butterworthLowPass(
  sampleRateHz: number,
  spec: LowPassSpec = FIXED_CONSTANTS.lowPassFilter,
): SecondOrderSection[] {
  assertSampleRateHz(sampleRateHz);
  const { cutoffHz, order } = spec;
  if (!Number.isInteger(order) || order < 1) {
    throw new RangeError(`filter: order must be a positive integer, got ${order}`);
  }
  if (!(cutoffHz > 0) || cutoffHz >= sampleRateHz / 2) {
    throw new RangeError(
      `filter: cutoff ${cutoffHz} Hz must be above 0 and below the Nyquist frequency of ${sampleRateHz / 2} Hz`,
    );
  }
  const k = Math.tan((Math.PI * cutoffHz) / sampleRateHz);
  const k2 = k * k;
  const sections: SecondOrderSection[] = [];
  for (let p = 0; p < Math.floor(order / 2); p++) {
    const damping = 2 * Math.sin((Math.PI * (2 * p + 1)) / (2 * order));
    const a0 = 1 + damping * k + k2;
    sections.push({
      b0: k2 / a0,
      b1: (2 * k2) / a0,
      b2: k2 / a0,
      a1: (2 * (k2 - 1)) / a0,
      a2: (1 - damping * k + k2) / a0,
    });
  }
  if (order % 2 === 1) {
    const a0 = 1 + k;
    sections.push({ b0: k / a0, b1: k / a0, b2: 0, a1: (k - 1) / a0, a2: 0 });
  }
  return sections;
}

function runSection(x: readonly number[], s: SecondOrderSection): number[] {
  const gain = (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2);
  const start = x[0];
  let z1 = (gain - s.b0) * start;
  let z2 = (s.b2 - s.a2 * gain) * start;
  const y = new Array<number>(x.length);
  for (let i = 0; i < x.length; i++) {
    const out = s.b0 * x[i] + z1;
    z1 = s.b1 * x[i] - s.a1 * out + z2;
    z2 = s.b2 * x[i] - s.a2 * out;
    y[i] = out;
  }
  return y;
}

function cascade(x: readonly number[], sections: readonly SecondOrderSection[]): number[] {
  return sections.reduce<number[]>((signal, section) => runSection(signal, section), [...x]);
}

export function filtfilt(
  samples: readonly number[],
  sampleRateHz: number,
  spec: LowPassSpec = FIXED_CONSTANTS.lowPassFilter,
): number[] {
  const sections = butterworthLowPass(sampleRateHz, spec);
  const n = samples.length;
  if (n === 0) return [];
  const pad = Math.min(n - 1, EDGE_PAD_FACTOR * (2 * sections.length + 1));
  const first = samples[0];
  const last = samples[n - 1];
  const extended = [
    ...Array.from({ length: pad }, (_, i) => 2 * first - samples[pad - i]),
    ...samples,
    ...Array.from({ length: pad }, (_, i) => 2 * last - samples[n - 2 - i]),
  ];
  const forward = cascade(extended, sections);
  const backward = cascade(forward.reverse(), sections).reverse();
  return backward.slice(pad, pad + n);
}
