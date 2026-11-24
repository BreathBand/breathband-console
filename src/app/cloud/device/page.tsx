"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";
import { LiveTrace } from "@/components/LiveTrace";
import { useDevice } from "@/lib/device/DeviceProvider";
import { bluetoothSupport } from "@/lib/device/bluetooth";
import { NUS, SAMPLE_RATE_HZ } from "@/lib/device/config";
import type { SourceKind } from "@/lib/device/types";
import { TensionGauge } from "./TensionGauge";
import { PERSONAS, stateWords } from "./words";

const noop = () => () => {};

/** Your band: choose the real band or the simulator, connect, check the signal and the strap. */
export default function DevicePage() {
  const device = useDevice();
  const support = useSyncExternalStore(noop, bluetoothSupport, () => "unsupported" as const);
  const { status, connected, kind } = device;
  const busy = status.state === "requesting" || status.state === "connecting" || status.state === "reconnecting";

  const choose = (k: SourceKind) => {
    if (k === kind) return;
    if (connected || busy) void device.disconnect();
    device.setKind(k);
  };

  return (
    <div className="container page device-page">
      <header className="page-head">
        <div>
          <h1>Your band</h1>
          <p className="page-lede">
            Breathband reads the rise and fall of your belly. Connect your band over Bluetooth, or use the simulated band
            to try every part of BreathCloud without one.
          </p>
        </div>
      </header>

      <section className="source-pick" aria-label="Signal source">
        <button
          type="button"
          className="source"
          aria-pressed={kind === "bluetooth"}
          onClick={() => choose("bluetooth")}
        >
          <span className="source-icon">
            <Icon name="bluetooth" size={22} />
          </span>
          <span className="source-text">
            <b>Breathband over Bluetooth</b>
            <span>
              {support === "supported"
                ? "Turn the band on and keep it close. Chrome or Edge will ask which band to use."
                : support === "insecure"
                  ? "Bluetooth needs a secure page. Open BreathCloud over HTTPS."
                  : "This browser can't use Bluetooth. Use Chrome or Edge on a computer or an Android phone."}
            </span>
          </span>
          <span className="source-check" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        </button>
        <button
          type="button"
          className="source"
          aria-pressed={kind === "simulated"}
          onClick={() => choose("simulated")}
        >
          <span className="source-icon">
            <Icon name="signal" size={22} />
          </span>
          <span className="source-text">
            <b>Simulated band</b>
            <span>A simulated athlete breathing, streamed exactly like the band. Good for demos and trying things out.</span>
          </span>
          <span className="source-check" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
        </button>
      </section>

      <section className="pane device-live" aria-labelledby="live-h" data-state={status.state}>
        <div className="device-live-head">
          <div>
            <h2 id="live-h">
              {connected ? (kind === "simulated" ? "Simulated band" : (status.deviceName ?? "Breathband")) : "Not connected"}
            </h2>
            <p className="device-state" role="status">
              <i aria-hidden="true" />
              {device.stalled ? "Connected, but no signal is arriving" : stateWords(status.state)}
              {status.message ? ` · ${status.message}` : ""}
            </p>
          </div>
          <div className="device-actions">
            {connected || status.state === "reconnecting" ? (
              <button type="button" className="button" data-variant="ghost" onClick={() => void device.disconnect()}>
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="button"
                disabled={busy || (kind === "bluetooth" && support !== "supported")}
                aria-busy={busy || undefined}
                onClick={() => void device.connect()}
              >
                <Icon name={kind === "bluetooth" ? "bluetooth" : "signal"} size={18} />
                {busy ? "Connecting…" : kind === "bluetooth" ? "Connect your band" : "Start the simulated band"}
              </button>
            )}
          </div>
        </div>

        {connected ? (
          <>
            <div className="device-trace theme-dark">
              <LiveTrace read={device.recent} window={20 * SAMPLE_RATE_HZ} height={180} label="Live signal from the band" />
              <span className="device-trace-key">
                <span data-k="in">Rising, breathing in</span>
                <span data-k="out">Falling, breathing out</span>
                <span>Last 20 s</span>
              </span>
            </div>
            <dl className="device-facts">
              <div>
                <dt>Reading</dt>
                <dd className="mono">
                  <Reading />
                </dd>
              </div>
              <div>
                <dt>Sampling</dt>
                <dd className="mono">{SAMPLE_RATE_HZ} Hz</dd>
              </div>
              <div>
                <dt>Battery</dt>
                <dd className="mono">{typeof status.battery === "number" ? `${status.battery}%` : "Not reported"}</dd>
              </div>
              <div>
                <dt>Calibration</dt>
                <dd>{device.calibration ? "Done for this connection" : "Runs at the start of each session"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="device-empty">
            <BandFigure />
            <ol className="steps">
              <li>
                <b>Put the band on.</b> Wrap it around your belly, just below the ribs.
              </li>
              <li>
                <b>Connect.</b> {kind === "bluetooth" ? "Choose your Breathband when the browser asks." : "The simulator starts streaming at once."}
              </li>
              <li>
                <b>Tighten the strap</b> until the gauge sits in the green.
              </li>
            </ol>
          </div>
        )}
      </section>

      {connected && <TensionGauge />}

      {connected && kind === "simulated" && (
        <section className="pane pane-pad persona" aria-labelledby="persona-h">
          <h2 id="persona-h">How the simulated athlete breathes</h2>
          <p className="muted">Pick a pattern to see how BreathCloud scores good and faulty breathing. It applies from the next breath.</p>
          <div className="persona-grid" role="radiogroup" aria-labelledby="persona-h">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={device.persona === p.id}
                className="persona-opt"
                onClick={() => device.setPersona(p.id)}
              >
                <b>{p.label}</b>
                <span>{p.detail}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {connected && (
        <div className="device-next">
          <p>Your band is ready.</p>
          <Link href="/cloud/record/" className="button" data-size="large">
            <span className="rec-dot" aria-hidden="true" />
            Start a session
          </Link>
        </div>
      )}

      <details className="pane pane-pad device-notes">
        <summary>About the connection</summary>
        <p>
          BreathCloud talks to the band the same way the Breathband app does: it looks for a device named BreathBand, reads
          one number per Bluetooth notification and samples the latest number {SAMPLE_RATE_HZ} times a second. It sends short
          text commands to start calibration.
        </p>
        <p>
          The band&rsquo;s data service is assumed to be the Nordic UART Service (<code>{NUS.service}</code>). Your browser
          only shares the band with this page while it is open, and nothing leaves your computer until you save a session.
        </p>
      </details>
    </div>
  );
}

function Reading() {
  const device = useDevice();
  const value = useSyncExternalStore(
    (notify) => device.subscribe(notify),
    () => device.latest(),
    () => null,
  );
  return <>{value === null ? "–" : Math.round(value)}</>;
}

/** The band as a simple object: the strap and its sensor pod. */
function BandFigure() {
  return (
    <svg className="band-figure" viewBox="0 0 220 120" aria-hidden="true">
      <rect x="10" y="44" width="200" height="32" rx="16" className="band-strap" />
      <rect x="80" y="34" width="60" height="52" rx="14" className="band-pod" />
      <circle cx="110" cy="60" r="9" className="band-led" />
    </svg>
  );
}
