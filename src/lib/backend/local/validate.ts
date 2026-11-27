import { FIXED_CONSTANTS, OPEN_CONSTANTS } from "@/lib/analysis/config";
import type { SessionSummary, Waveform } from "@/lib/domain/types";
import { BackendError, type NewCalibration } from "../types";

const { minSd, maxSd, stepSd } = FIXED_CONSTANTS.deviationHistogram;
const HISTOGRAM_BINS = Math.round((maxSd - minSd) / stepSd);
const CALIBRATION_EXTREMA = 3;

const invalid = (field: string, problem: string) => new BackendError("invalid-input", `${field}: ${problem}`);

export function checkSessionContract(summary: SessionSummary, waveform: Waveform): void {
  const maxMarkers = FIXED_CONSTANTS.maxEventMarkersPerOpenSession;
  if (summary.mode === "open" && waveform.markers.length > maxMarkers) {
    throw invalid("markers", `an open session allows at most ${maxMarkers}, got ${waveform.markers.length}`);
  }

  for (const key of ["peaks", "troughs"] as const) {
    const values = waveform.calibration[key];
    if (values !== undefined && values.length !== CALIBRATION_EXTREMA) {
      throw invalid(`calibration.${key}`, `expected ${CALIBRATION_EXTREMA} values, got ${values.length}`);
    }
  }

  const histogram = summary.paced?.histogram;
  if (histogram) {
    for (const key of ["timing", "depth"] as const) {
      if (histogram[key].length !== HISTOGRAM_BINS) {
        throw invalid(`paced.histogram.${key}`, `expected ${HISTOGRAM_BINS} bins, got ${histogram[key].length}`);
      }
    }
  }

  if (summary.skillLevel !== undefined && !Object.hasOwn(OPEN_CONSTANTS.skillBandK, summary.skillLevel)) {
    throw invalid("skillLevel", `unknown level "${String(summary.skillLevel)}"`);
  }
}

const MAX_BAND_NAME = 64;

/** Why a calibration can't be kept, or null: the API refuses the same (server/routes/calibrations.ts). */
export function calibrationProblem(c: NewCalibration): string | null {
  if (typeof c.a100 !== "number" || !Number.isFinite(c.a100) || c.a100 <= 0) return "a100: a positive number";
  if (typeof c.midline !== "number" || !Number.isFinite(c.midline)) return "midline: a number";
  if (c.source !== "bluetooth" && c.source !== "simulated") return 'source: "bluetooth" or "simulated"';
  if (c.bandName !== null && (typeof c.bandName !== "string" || c.bandName.length > MAX_BAND_NAME)) return `bandName: null or text up to ${MAX_BAND_NAME}`;
  return null;
}
