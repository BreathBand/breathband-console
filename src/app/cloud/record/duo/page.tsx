"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, Mark } from "@/components/Icon";
import type { Calibration } from "@/lib/analysis/calibration";
import { calibrationProgress } from "@/lib/analysis/calibrationProgress";
import type { PacedResult } from "@/lib/analysis/paced";
import { analyzePacedRecording } from "@/lib/analysis/session";
import { bluetoothSupport } from "@/lib/device/bluetooth";
import { BAND_COMMANDS, SAMPLE_RATE_HZ } from "@/lib/device/config";
import { BluetoothBand } from "@/lib/device/bluetooth";
import { SimulatedBand } from "@/lib/device/simulated";
import type { SignalSource, SimPersona, SourceKind, SourceStatus } from "@/lib/device/types";
import { formatDuration } from "@/lib/domain/format";
import { formatScore, scoreWord } from "@/lib/domain/scores";
import { useWakeLock } from "@/lib/useWakeLock";
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
  lastN: number;
  cal: number[];
  scale: Calibration | null;
  startN: number | null;
  pct: number[];
  unsub: (() => void)[];
}

const LENGTHS = [60, 120, 300];

/** How many people one screen holds (2 to 6), and how the simulated ones breathe by default. */
const PEOPLE = { min: 2, max: 6 } as const;
const DEFAULT_PERSONAS: SimPersona[] = ["steady", "rushed", "early", "shallow", "deep", "distracted"];

const newPerson = (i: number): Person => ({ name: `User ${i + 1}`, kind: "simulated", persona: DEFAULT_PERSONAS[i % DEFAULT_PERSONAS.length] });

const emptyLane = (): Lane => ({ source: null, lastN: -1, cal: [], scale: null, startN: null, pct: [], unsub: [] });

/**
 * Two to six people, one pacer: the app's multi-user mode ("User 1 / User 2")
 * on the web. Each person wears a band (or a simulated one), everyone
 * calibrates together, then breathes with the same pacer while their breaths
 * run in their own lanes on one timeline. At the end each gets a method-C score. Nothing is saved: this is
 * for practising together, coaching side by side, or a demo.
 */
export default function DuoPage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>(() => [newPerson(0), newPerson(1)]);
  const [pacer, setPacer] = useState<2 | 5>(5);
  const [lengthSec, setLengthSec] = useState(120);
  const [phase, setPhase] = useState<Phase>("setup");
  useWakeLock(phase === "calibrate" || phase === "countdown" || phase === "live");
  const [statuses, setStatuses] = useState<SourceStatus[]>([{ state: "idle" }, { state: "idle" }]);
  const [calDone, setCalDone] = useState<boolean[]>([]);
  const [calError, setCalError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<(PacedResult | null)[]>([]);
  const [sound, setSound] = useState(true);
  const tones = useTones(sound);
  const lanes = useRef<Lane[]>([emptyLane(), emptyLane()]);
  const phaseRef = useRef<Phase>("setup");
  const setLane = useCallback((i: number, lane: Lane) => {
    lanes.current = lanes.current.map((l, j) => (j === i ? lane : l));
  }, []);
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
  const allConnected = statuses.every((s) => s.state === "connected");

  const setPerson = (i: number, patch: Partial<Person>) => setPeople((p) => p.map((person, j) => (j === i ? { ...person, ...patch } : person)));

  const addPerson = () => {
    if (people.length >= PEOPLE.max) return;
    lanes.current = [...lanes.current, emptyLane()];
    setPeople((p) => [...p, newPerson(p.length)]);
    setStatuses((all) => [...all, { state: "idle" }]);
  };

  const removePerson = (i: number) => {
    if (people.length <= PEOPLE.min) return;
    const lane = lanes.current[i];
    lane.unsub.forEach((u) => u());
    void lane.source?.disconnect();
    lanes.current = lanes.current.filter((_, j) => j !== i);
    setPeople((p) => p.filter((_, j) => j !== i));
    setStatuses((all) => all.filter((_, j) => j !== i));
  };

  const connect = async (i: number) => {
    const lane = lanes.current[i];
    lane.unsub.forEach((u) => u());
    await lane.source?.disconnect();
    const person = people[i];
    const source: SignalSource = person.kind === "bluetooth" ? new BluetoothBand() : new SimulatedBand(Date.now() % 100_000 + i * 7919);
    if (source instanceof SimulatedBand) source.setPersona(person.persona);
    // The callbacks look their lane up by source each time, so a lane can be replaced (recalibrated)
    // or move (someone before it removed) without resubscribing.
    const indexOf = () => lanes.current.findIndex((l) => l.source === source);
    const unsub = [
      source.onStatus((s) => {
        const at = indexOf();
        if (at >= 0) setStatuses((all) => all.map((old, j) => (j === at ? s : old)));
      }),
      source.subscribe((s) => {
        const lane = lanes.current[indexOf()];
        if (!lane) return;
        lane.lastN = s.n;
        const p = phaseRef.current;
        if (p === "calibrate") lane.cal.push(s.value);
        if (p === "live" && lane.scale && lane.startN !== null && s.n >= lane.startN) {
          lane.pct.push(((s.value - lane.scale.midline) / lane.scale.a100) * 100);
        }
      }),
    ];
    setLane(i, { ...emptyLane(), source, unsub });
    await source.connect();
  };

  const startCalibration = () => {
    lanes.current.forEach((lane, i) => {
      setLane(i, { ...lane, cal: [], scale: null });
      void lane.source?.send(BAND_COMMANDS.calibrate).catch(() => undefined);
    });
    calStarted.current = performance.now();
    setCalDone(lanes.current.map(() => false));
    setCalError(null);
    setPhase("calibrate");
  };

  useEffect(() => {
    if (phase !== "calibrate") return;
    const timer = setInterval(() => {
      let failed = false;
      const done = lanes.current.map((lane, i) => {
        if (lane.scale) return true;
        const progress = calibrationProgress(lane.cal, SAMPLE_RATE_HZ, (performance.now() - calStarted.current) / 1000);
        failed ||= progress.failed;
        if (!progress.result) return false;
        setLane(i, { ...lane, scale: progress.result });
        return true;
      });
      setCalDone(done);
      if (done.every(Boolean)) setPhase("ready");
      else if (failed) {
        setCalError("One of the bands didn't show three full breaths in the 20 seconds. Check everyone's strap and try again.");
        setPhase("setup");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, setLane]);

  const begin = () => {
    tones.unlock();
    setPhase("countdown");
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    const go = setTimeout(() => {
      lanes.current.forEach((lane, i) => {
        const startN = lane.lastN + 1;
        setLane(i, { ...lane, startN, pct: [] });
        if (lane.source instanceof SimulatedBand) lane.source.follow({ inhaleS: pacer, exhaleS: pacer, startN });
      });
      setPhase("live");
    }, 3000);
    return () => clearTimeout(go);
  }, [phase, pacer, setLane]);

  const finish = useCallback(() => {
    const scored = lanes.current.map((lane) => {
      if (lane.source instanceof SimulatedBand) lane.source.follow(null);
      if (lane.pct.length < 20 * SAMPLE_RATE_HZ) return null;
      try {
        return analyzePacedRecording(lane.pct, SAMPLE_RATE_HZ, { halfCycleS: pacer, skillLevel: "intermediate" });
      } catch {
        return null;
      }
    });
    setResults(scored);
    setPhase("results");
  }, [pacer]);

  useEffect(() => {
    if (phase !== "live") return;
    let raf = 0;
    let lastTurn = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = longest(lanes.current) / SAMPLE_RATE_HZ;
      const turn = Math.floor(t / pacer);
      if (turn !== lastTurn) {
        lastTurn = turn;
        tones.play(turn % 2 === 1 ? TONES.high : TONES.low);
      }
    };
    raf = requestAnimationFrame(loop);
    const clock = setInterval(() => {
      const s = longest(lanes.current) / SAMPLE_RATE_HZ;
      setElapsed(s);
      if (s >= lengthSec) finish();
    }, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(clock);
    };
  }, [phase, pacer, lengthSec, finish, tones]);

  // One stable reader per seat, so BreathLine's frame loop isn't restarted on every render.
  const readers = useMemo(() => Array.from({ length: PEOPLE.max }, (_, i) => () => lanes.current[i]?.pct ?? []), []);
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
            Multi-person session
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
            <p>
              Up to {PEOPLE.max} bands, one pacer. Each person gets their own score, side by side. Nothing is saved.
            </p>
            {calError && (
              <p className="duo-error" role="alert">
                {calError}
              </p>
            )}
            <div className="duo-people">
              {people.map((person, i) => (
                <div key={i} className="duo-person" data-user={i + 1}>
                  <div className="duo-person-head">
                    <span className="duo-num" aria-hidden="true">{i + 1}</span>
                    {people.length > PEOPLE.min && (
                      <button type="button" className="inst-icon" onClick={() => removePerson(i)} title={`Remove ${person.name}`}>
                        <Icon name="close" size={18} />
                        <span className="sr-only">Remove {person.name}</span>
                      </button>
                    )}
                  </div>
                  <label className="field">
                    Name
                    <input value={person.name} maxLength={24} onChange={(e) => setPerson(i, { name: e.target.value })} />
                  </label>
                  <div className="seg" role="group" aria-label={`${person.name}'s band`}>
                    {(["simulated", "bluetooth"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={person.kind === k}
                        disabled={k === "bluetooth" && support !== "supported"}
                        onClick={() => setPerson(i, { kind: k })}
                      >
                        <Icon name={k === "simulated" ? "signal" : "bluetooth"} size={16} />
                        {k === "simulated" ? "Simulated" : "Breathband"}
                      </button>
                    ))}
                  </div>
                  {person.kind === "simulated" && (
                    <label className="field">
                      Breathes
                      <select value={person.persona} onChange={(e) => setPerson(i, { persona: e.target.value as SimPersona })}>
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
            {people.length < PEOPLE.max && (
              <button type="button" className="button" data-variant="ghost" onClick={addPerson}>
                <Icon name="plus" size={16} />
                Add a person
              </button>
            )}
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
              {allConnected ? (
                <button type="button" className="button" data-size="large" onClick={startCalibration}>
                  Calibrate everyone
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  data-size="large"
                  onClick={() => {
                    statuses.forEach((s, i) => {
                      if (s.state !== "connected") void connect(i);
                    });
                  }}
                >
                  Connect all bands
                </button>
              )}
            </div>
          </section>
        ) : phase === "calibrate" ? (
          <section className="inst-step">
            <h1>Full breaths for 20 seconds, everyone</h1>
            <p>Breathe in slowly until you&rsquo;re full, then all the way out, and keep going until every band is calibrated.</p>
            <ul className="duo-cal">
              {people.map((person, i) => (
                <li key={i} data-done={calDone[i] || undefined}>
                  <b>{person.name}</b>
                  <span>{calDone[i] ? "Calibrated" : "Calibrating…"}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : phase === "ready" ? (
          <section className="inst-step">
            <h1>Everyone calibrated</h1>
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
          <section className="duo-live" data-count={people.length}>
            {people.map((person, i) => (
              <div key={i} className="duo-lane" data-user={i + 1}>
                <span className="duo-tag">
                  <span className="duo-num" aria-hidden="true">{i + 1}</span>
                  <b>{person.name}</b>
                  {statuses[i].state !== "connected" && <small>{stateWords(statuses[i].state)}</small>}
                </span>
                <BreathLine read={readers[i]} halfCycleS={pacer} markers={noMarkers} windowS={24} annotate={people.length <= 3} label={`${person.name}'s breath against the pacer, with timing and depth for each turn`} />
              </div>
            ))}
          </section>
        ) : (
          <section className="duo-results">
            <h1>Side by side</h1>
            <div className="duo-cards" data-count={people.length}>
              {people.map((person, i) => {
                const r = results[i];
                return (
                  <div key={i} className="duo-card" data-user={i + 1}>
                    <h2>
                      <span className="duo-num" aria-hidden="true">{i + 1}</span>
                      {person.name}
                    </h2>
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

/** Samples so far in the longest lane: the session clock. */
function longest(lanes: readonly Lane[]): number {
  return Math.max(0, ...lanes.map((l) => l.pct.length));
}
