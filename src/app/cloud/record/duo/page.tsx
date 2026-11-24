"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Mark } from "@/components/Icon";
import { calibrate, type Calibration } from "@/lib/analysis/calibration";
import type { PacedResult } from "@/lib/analysis/paced";
import { analyzePacedRecording } from "@/lib/analysis/session";
import { bluetoothSupport } from "@/lib/device/bluetooth";
import { BAND_COMMANDS, SAMPLE_RATE_HZ } from "@/lib/device/config";
import { BluetoothBand } from "@/lib/device/bluetooth";
import { SimulatedBand } from "@/lib/device/simulated";
import type { SignalSource, SimPersona, SourceKind, SourceStatus } from "@/lib/device/types";
import { formatDuration } from "@/lib/domain/format";
import { formatScore, scoreWord } from "@/lib/domain/scores";
import { BreathLine } from "../live/BreathLine";
import { TONES, useTones } from "../live/useTones";
import { PERSONAS, stateWords } from "../../device/words";

type Phase = "setup" | "calibrate" | "ready" | "countdown" | "live" | "results";

interface Person {
  name: string;
  kind: SourceKind;
  persona: SimPersona;
}

/** One person's band and recording, kept outside React state and read every frame. */
interface Lane {
  source: SignalSource | null;
  status: SourceStatus;
  lastN: number;
  cal: number[];
  scale: Calibration | null;
  startN: number | null;
  pct: number[];
  unsub: (() => void)[];
}

const LENGTHS = [60, 120, 300];
const CAL_GIVE_UP_S = 90;

const emptyLane = (): Lane => ({ source: null, status: { state: "idle" }, lastN: -1, cal: [], scale: null, startN: null, pct: [], unsub: [] });

/**
 * Two people, one pacer: the app's multi-user mode ("User 1 / User 2") on the
 * web. Each person wears a band (or a simulated one), both calibrate together,
 * then breathe with the same pacer while their breaths run in two lanes on one
 * timeline. At the end each gets a method-C score. Nothing is saved: this is
 * for practising together, coaching side by side, or a demo.
 */
export default function DuoPage() {
  const router = useRouter();
  const [people, setPeople] = useState<[Person, Person]>([
    { name: "User 1", kind: "simulated", persona: "steady" },
    { name: "User 2", kind: "simulated", persona: "rushed" },
  ]);
  const [pacer, setPacer] = useState<2 | 5>(5);
  const [lengthSec, setLengthSec] = useState(120);
  const [phase, setPhase] = useState<Phase>("setup");
  const [statuses, setStatuses] = useState<[SourceStatus, SourceStatus]>([{ state: "idle" }, { state: "idle" }]);
  const [calDone, setCalDone] = useState<[boolean, boolean]>([false, false]);
  const [calError, setCalError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<[PacedResult | null, PacedResult | null]>([null, null]);
  const [sound, setSound] = useState(true);
  const tones = useTones(sound);
  const lanes = useRef<[Lane, Lane]>([emptyLane(), emptyLane()]);
  const phaseRef = useRef<Phase>("setup");
  const calStarted = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(
    () => () => {
      for (const lane of lanes.current) {
        lane.unsub.forEach((u) => u());
        void lane.source?.disconnect();
      }
    },
    [],
  );

  const support = typeof window === "undefined" ? "unsupported" : bluetoothSupport();
  const bothConnected = statuses[0].state === "connected" && statuses[1].state === "connected";

  const setPerson = (i: 0 | 1, patch: Partial<Person>) =>
    setPeople((p) => (i === 0 ? [{ ...p[0], ...patch }, p[1]] : [p[0], { ...p[1], ...patch }]));

  const connect = async (i: 0 | 1) => {
    const lane = lanes.current[i];
    lane.unsub.forEach((u) => u());
    await lane.source?.disconnect();
    const person = people[i];
    const source: SignalSource = person.kind === "bluetooth" ? new BluetoothBand() : new SimulatedBand(Date.now() % 100_000 + i * 7919);
    if (source instanceof SimulatedBand) source.setPersona(person.persona);
    lanes.current[i] = { ...emptyLane(), source };
    const next = lanes.current[i];
    next.unsub = [
      source.onStatus((s) => {
        next.status = s;
        setStatuses((all) => (i === 0 ? [s, all[1]] : [all[0], s]));
      }),
      source.subscribe((s) => {
        next.lastN = s.n;
        const p = phaseRef.current;
        if (p === "calibrate") next.cal.push(s.value);
        if (p === "live" && next.scale && next.startN !== null && s.n >= next.startN) {
          next.pct.push(((s.value - next.scale.midline) / next.scale.a100) * 100);
        }
      }),
    ];
    await source.connect();
  };

  const startCalibration = () => {
    for (const lane of lanes.current) {
      lane.cal = [];
      lane.scale = null;
      void lane.source?.send(BAND_COMMANDS.calibrate).catch(() => undefined);
    }
    calStarted.current = performance.now();
    setCalDone([false, false]);
    setCalError(null);
    setPhase("calibrate");
  };

  useEffect(() => {
    if (phase !== "calibrate") return;
    const timer = setInterval(() => {
      const done = lanes.current.map((lane) => {
        if (lane.scale) return true;
        if (lane.cal.length < 30 * SAMPLE_RATE_HZ) return false;
        const result = calibrate(lane.cal, SAMPLE_RATE_HZ);
        if (result && result.a100 > 0) lane.scale = result;
        return Boolean(lane.scale);
      }) as [boolean, boolean];
      setCalDone(done);
      if (done[0] && done[1]) setPhase("ready");
      else if ((performance.now() - calStarted.current) / 1000 > CAL_GIVE_UP_S) {
        setCalError("One of the bands didn't show three deep breaths. Check both straps and try again.");
        setPhase("setup");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const begin = () => {
    tones.unlock();
    setPhase("countdown");
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    const go = setTimeout(() => {
      lanes.current.forEach((lane) => {
        lane.startN = lane.lastN + 1;
        lane.pct = [];
        if (lane.source instanceof SimulatedBand) lane.source.follow({ inhaleS: pacer, exhaleS: pacer, startN: lane.startN });
      });
      setPhase("live");
    }, 3000);
    return () => clearTimeout(go);
  }, [phase, pacer]);

  const finish = useCallback(() => {
    const scored = lanes.current.map((lane) => {
      if (lane.source instanceof SimulatedBand) lane.source.follow(null);
      if (lane.pct.length < 20 * SAMPLE_RATE_HZ) return null;
      try {
        return analyzePacedRecording(lane.pct, SAMPLE_RATE_HZ, { halfCycleS: pacer, skillLevel: "intermediate" });
      } catch {
        return null;
      }
    }) as [PacedResult | null, PacedResult | null];
    setResults(scored);
    setPhase("results");
  }, [pacer]);

  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0;
    let lastTurn = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = Math.max(lanes.current[0].pct.length, lanes.current[1].pct.length) / SAMPLE_RATE_HZ;
      const turn = Math.floor(t / pacer);
      if (turn !== lastTurn) {
        lastTurn = turn;
        tones.play(turn % 2 === 1 ? TONES.high : TONES.low);
      }
    };
    raf = requestAnimationFrame(loop);
    const clock = setInterval(() => {
      const s = Math.max(lanes.current[0].pct.length, lanes.current[1].pct.length) / SAMPLE_RATE_HZ;
      setElapsed(s);
      if (s >= lengthSec) finish();
    }, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(clock);
    };
  }, [phase, pacer, lengthSec, finish, tones]);

  const read0 = useCallback(() => lanes.current[0].pct, []);
  const read1 = useCallback(() => lanes.current[1].pct, []);
  const noMarkers = useCallback(() => [] as number[], []);

  const leave = () => {
    if (phase === "live" && !window.confirm("Stop the session and leave?")) return;
    router.push("/cloud/");
  };

  return (
    <div className="instrument theme-dark duo" data-phase={phase}>
      <header className="inst-bar">
        <button type="button" className="inst-icon" onClick={leave} title="Leave">
          <Icon name="close" size={22} />
          <span className="sr-only">Leave</span>
        </button>
        <div className="inst-title">
          <Mark size={22} label="" />
          <span>
            Two-person session
            <small>
              Paced {pacer}-{pacer} · {formatDuration(lengthSec)}
            </small>
          </span>
        </div>
        <div className="inst-tools">
          <button
            type="button"
            className="inst-icon"
            aria-pressed={sound}
            onClick={() => {
              tones.unlock();
              setSound((s) => !s);
            }}
            title={sound ? "Mute tones" : "Turn tones on"}
          >
            <Icon name={sound ? "volume" : "volumeOff"} size={22} />
            <span className="sr-only">{sound ? "Mute tones" : "Turn tones on"}</span>
          </button>
          {phase === "live" && (
            <span className="inst-clock mono">
              {formatDuration(Math.floor(elapsed))}
              <small> / {formatDuration(lengthSec)}</small>
            </span>
          )}
        </div>
      </header>

      <main className="inst-stage">
        {phase === "setup" ? (
          <section className="duo-setup">
            <h1>Breathe together</h1>
            <p>Two bands, one pacer. Each person gets their own score, side by side. Nothing is saved.</p>
            {calError && (
              <p className="duo-error" role="alert">
                {calError}
              </p>
            )}
            <div className="duo-people">
              {([0, 1] as const).map((i) => (
                <div key={i} className="duo-person" data-user={i + 1}>
                  <label className="field">
                    Name
                    <input value={people[i].name} maxLength={24} onChange={(e) => setPerson(i, { name: e.target.value })} />
                  </label>
                  <div className="seg" role="group" aria-label={`${people[i].name}'s band`}>
                    {(["simulated", "bluetooth"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={people[i].kind === k}
                        disabled={k === "bluetooth" && support !== "supported"}
                        onClick={() => setPerson(i, { kind: k })}
                      >
                        <Icon name={k === "simulated" ? "signal" : "bluetooth"} size={16} />
                        {k === "simulated" ? "Simulated" : "Breathband"}
                      </button>
                    ))}
                  </div>
                  {people[i].kind === "simulated" && (
                    <label className="field">
                      Breathes
                      <select value={people[i].persona} onChange={(e) => setPerson(i, { persona: e.target.value as SimPersona })}>
                        {PERSONAS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label} · {p.detail}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="duo-conn">
                    <span className="device-state" data-state={statuses[i].state}>
                      <i aria-hidden="true" />
                      {stateWords(statuses[i].state)}
                    </span>
                    <button type="button" className="button" data-variant="ghost" data-size="small" onClick={() => void connect(i)}>
                      {statuses[i].state === "connected" ? "Reconnect" : "Connect"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="duo-options">
              <div className="seg" role="group" aria-label="Pacer">
                {([5, 2] as const).map((p) => (
                  <button key={p} type="button" aria-pressed={pacer === p} onClick={() => setPacer(p)}>
                    Pacer {p}-{p}
                  </button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Length">
                {LENGTHS.map((l) => (
                  <button key={l} type="button" aria-pressed={lengthSec === l} onClick={() => setLengthSec(l)}>
                    {l / 60} min
                  </button>
                ))}
              </div>
            </div>
            <div className="inst-actions">
              <button type="button" className="button" data-size="large" disabled={!bothConnected} onClick={startCalibration}>
                Calibrate both
              </button>
            </div>
          </section>
        ) : phase === "calibrate" ? (
          <section className="inst-step">
            <h1>Five deep breaths, both of you</h1>
            <p>Breathe in slowly until you&rsquo;re full, then all the way out. Each band calibrates on its own.</p>
            <ul className="duo-cal">
              {([0, 1] as const).map((i) => (
                <li key={i} data-done={calDone[i] || undefined}>
                  <b>{people[i].name}</b>
                  <span>{calDone[i] ? "Calibrated" : "Calibrating…"}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : phase === "ready" ? (
          <section className="inst-step">
            <h1>Both calibrated</h1>
            <p>Follow the pacer line together: in as it rises, out as it falls.</p>
            <div className="inst-actions">
              <button type="button" className="button" data-size="large" onClick={begin} autoFocus>
                <span className="rec-dot" aria-hidden="true" />
                Begin
              </button>
            </div>
          </section>
        ) : phase === "countdown" ? (
          <section className="inst-step inst-count">
            <p className="count-n display">Ready</p>
            <p>Breathe in as the pacer starts.</p>
          </section>
        ) : phase === "live" ? (
          <section className="duo-live">
            {([0, 1] as const).map((i) => (
              <div key={i} className="duo-lane" data-user={i + 1}>
                <span className="duo-tag">
                  <b>{people[i].name}</b>
                  {statuses[i].state !== "connected" && <small>{stateWords(statuses[i].state)}</small>}
                </span>
                <BreathLine read={i === 0 ? read0 : read1} halfCycleS={pacer} markers={noMarkers} windowS={24} label={`${people[i].name}'s breath against the pacer`} />
              </div>
            ))}
          </section>
        ) : (
          <section className="duo-results">
            <h1>Side by side</h1>
            <div className="duo-cards">
              {([0, 1] as const).map((i) => {
                const r = results[i];
                return (
                  <div key={i} className="duo-card" data-user={i + 1}>
                    <h2>{people[i].name}</h2>
                    {r ? (
                      <>
                        <p className="res-total display">
                          {formatScore(r.scores.total)}
                          <small>/10</small>
                        </p>
                        <p className="res-word">
                          <i className="dot" data-band={scoreWord(r.scores.total).band} aria-hidden="true" />
                          {scoreWord(r.scores.total).word}
                        </p>
                        <dl className="duo-break">
                          <div>
                            <dt>Timing in / out</dt>
                            <dd>
                              {formatScore(r.scores.timing.inhale)} / {formatScore(r.scores.timing.exhale)}
                            </dd>
                          </div>
                          <div>
                            <dt>Depth in / out</dt>
                            <dd>
                              {formatScore(r.scores.depth.inhale)} / {formatScore(r.scores.depth.exhale)}
                            </dd>
                          </div>
                          <div>
                            <dt>On target</dt>
                            <dd>{Math.round((r.onTargetPct.timing + r.onTargetPct.depth) / 2)}%</dd>
                          </div>
                          <div>
                            <dt>Missed turns</dt>
                            <dd>
                              {r.counts.missed + r.counts.double} of {r.counts.pacer}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <p className="muted">Too little signal to score.</p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="inst-actions">
              <button type="button" className="button" data-size="large" onClick={() => setPhase("ready")}>
                Go again
              </button>
              <button type="button" className="button" data-variant="ghost" onClick={leave}>
                Done
              </button>
            </div>
          </section>
        )}
      </main>

      {phase === "live" && (
        <footer className="inst-foot">
          <button type="button" className="button inst-stop" data-size="large" onClick={finish}>
            <Icon name="stop" size={18} />
            Stop
          </button>
        </footer>
      )}
    </div>
  );
}
