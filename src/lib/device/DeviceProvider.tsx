"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CalibrationScale } from "../analysis/calibration";
import { BluetoothBand } from "./bluetooth";
import { SAMPLE_RATE_HZ, STALL_MS } from "./config";
import { SimulatedBand } from "./simulated";
import type { Sample, SignalSource, SimPacer, SimPersona, SourceKind, SourceStatus } from "./types";

const SOURCE_KEY = "breathband:source";
const PERSONA_KEY = "breathband:sim-persona";
/** How much signal the provider keeps for previews: the last 30 seconds. */
const RECENT_SAMPLES = 30 * SAMPLE_RATE_HZ;

export interface DeviceCalibration extends CalibrationScale {
  /** When it was taken, so a screen can say "calibrated 4 minutes ago". */
  readonly at: number;
  readonly sourceKind: SourceKind;
}

export interface Device {
  /** Which source connects next (and is connected, when one is). */
  kind: SourceKind;
  setKind: (kind: SourceKind) => void;
  status: SourceStatus;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (command: string) => Promise<void>;
  /** Every sample as it arrives; returns an unsubscribe function. */
  subscribe: (listener: (sample: Sample) => void) => () => void;
  /** The last 30 s of raw readings, oldest first. */
  recent: () => readonly number[];
  /** The newest raw reading, or null before the first. */
  latest: () => number | null;
  /** True while connected but no sample has arrived for a while. */
  stalled: boolean;
  calibration: DeviceCalibration | null;
  setCalibration: (c: CalibrationScale | null) => void;
  /** The simulated user's behaviour; ignored by a real band. */
  persona: SimPersona;
  setPersona: (p: SimPersona) => void;
  /** Tells the simulated user to follow a pacer (or stop following). No-op for a real band. */
  follow: (pacer: SimPacer | null) => void;
}

const DeviceContext = createContext<Device | null>(null);

function stored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return allowed.find((a) => a === v) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be refused (private windows); the choice still holds for this visit.
  }
}

/**
 * The breathing sensor for everything under /cloud: one connection that stays
 * open while the person moves between pages, with the choice between the real
 * band and the simulator remembered in this browser.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  // The shell renders nothing that depends on these until auth has loaded on
  // the client, so reading storage in the initialisers can't mismatch the server HTML.
  const [kind, setKindState] = useState<SourceKind>(() => stored(SOURCE_KEY, ["simulated", "bluetooth"], "simulated"));
  const [persona, setPersonaState] = useState<SimPersona>(() =>
    stored(PERSONA_KEY, ["steady", "early", "shallow", "deep", "rushed", "distracted"], "steady"),
  );
  const [status, setStatus] = useState<SourceStatus>({ state: "idle" });
  const [calibration, setCalibrationState] = useState<DeviceCalibration | null>(null);
  const [silent, setSilent] = useState(false);
  const source = useRef<SignalSource | null>(null);
  const buffer = useRef<number[]>([]);
  const lastAt = useRef(0);
  const unsub = useRef<(() => void)[]>([]);
  const listeners = useRef(new Set<(s: Sample) => void>());

  useEffect(
    () => () => {
      for (const u of unsub.current) u();
      void source.current?.disconnect();
    },
    [],
  );

  const connected = status.state === "connected";
  const stalled = connected && silent;
  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => setSilent(performance.now() - lastAt.current > STALL_MS), 500);
    return () => clearInterval(timer);
  }, [connected]);

  const detach = useCallback(async () => {
    for (const u of unsub.current) u();
    unsub.current = [];
    const old = source.current;
    source.current = null;
    if (old) await old.disconnect();
  }, []);

  const connect = useCallback(async () => {
    await detach();
    const next: SignalSource = kind === "bluetooth" ? new BluetoothBand() : new SimulatedBand(Date.now() % 100_000);
    if (next instanceof SimulatedBand) next.setPersona(persona);
    source.current = next;
    buffer.current = [];
    lastAt.current = performance.now();
    unsub.current = [
      next.onStatus(setStatus),
      next.subscribe((sample) => {
        lastAt.current = performance.now();
        const b = buffer.current;
        b.push(sample.value);
        if (b.length > RECENT_SAMPLES) b.splice(0, b.length - RECENT_SAMPLES);
        for (const l of listeners.current) l(sample);
      }),
    ];
    setCalibrationState(null);
    await next.connect();
  }, [detach, kind, persona]);

  const disconnect = useCallback(async () => {
    await detach();
    setStatus({ state: "idle" });
  }, [detach]);

  const value = useMemo<Device>(
    () => ({
      kind,
      setKind: (k) => {
        remember(SOURCE_KEY, k);
        setKindState(k);
      },
      status,
      connected,
      connect,
      disconnect,
      send: async (command) => {
        if (!source.current) throw new Error("No band is connected.");
        await source.current.send(command);
      },
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
      recent: () => buffer.current,
      latest: () => buffer.current[buffer.current.length - 1] ?? null,
      stalled,
      calibration,
      setCalibration: (c) =>
        setCalibrationState(c ? { a100: c.a100, midline: c.midline, at: Date.now(), sourceKind: source.current?.kind ?? kind } : null),
      persona,
      setPersona: (p) => {
        remember(PERSONA_KEY, p);
        setPersonaState(p);
        if (source.current instanceof SimulatedBand) source.current.setPersona(p);
      },
      follow: (pacer) => {
        if (source.current instanceof SimulatedBand) source.current.follow(pacer);
      },
    }),
    [kind, status, connected, connect, disconnect, stalled, calibration, persona],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice(): Device {
  const device = useContext(DeviceContext);
  if (!device) throw new Error("useDevice must be used inside <DeviceProvider>");
  return device;
}
