import type { Waveform } from "@/lib/domain/types";

const WIDTH = 900;
const HEIGHT = 220;

/**
 * Bare SVG plot of user vs pacer so the data path can be checked end to end.
 * Replaced by a real chart (zoom, scrub, markers) in docs/PLAN.md Phase 3.
 */
export function WaveformPreview({ waveform }: { waveform: Waveform }) {
  const series = [waveform.user, ...(waveform.pacer ? [waveform.pacer] : [])];
  const all = series.flat();
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const n = waveform.user.length;

  // One point per horizontal pixel is plenty for a preview.
  const step = Math.max(1, Math.floor(n / WIDTH));
  const toPath = (values: number[]) => {
    let d = "";
    for (let i = 0; i < values.length; i += step) {
      const x = (i / (n - 1)) * WIDTH;
      const y = HEIGHT - ((values[i] - min) / span) * HEIGHT;
      d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Breathing signal compared with the pacer"
      style={{ display: "block" }}
    >
      {waveform.pacer && (
        <path
          d={toPath(waveform.pacer)}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeDasharray="8 4"
        />
      )}
      <path d={toPath(waveform.user)} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {waveform.markers.map((m) => {
        const x = (m / (n - 1)) * WIDTH;
        return <line key={m} x1={x} x2={x} y1={0} y2={HEIGHT} stroke="var(--text-muted)" />;
      })}
    </svg>
  );
}
