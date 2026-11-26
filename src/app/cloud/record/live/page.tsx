"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, Mark } from "@/components/Icon";
import { CALIBRATION_WINDOW_S, calibrationProgress } from "@/lib/analysis/calibrationProgress";
import { analyzeOpenRecording } from "@/lib/analysis/session";
import { useAuth, useBackend } from "@/lib/backend/BackendProvider";
import { useDevice } from "@/lib/device/DeviceProvider";
import { BAND_COMMANDS, SAMPLE_RATE_HZ, STRAP_TENSION } from "@/lib/device/config";
import { firstSessionName } from "@/lib/domain/first-session";
import { formatDuration } from "@/lib/domain/format";
import { asksMood } from "@/lib/domain/mood";
import type { MoodScore } from "@/lib/domain/types";
import { parseSetup } from "@/lib/prefs";
import { buildSession, MIN_RECORDING_S, type BuiltSession } from "@/lib/recording";
import { useLoad } from "@/lib/useLoad";
import { streakDays } from "../../AthleteHome";
import { sessionHref } from "../../links";
import { fitOf } from "../../device/TensionGauge";
import { stateWords } from "../../device/words";
import { CalibrationRing } from "./CalibrationRing";
import { MoodFaces } from "./MoodFaces";
import { BreathLine } from "./BreathLine";
import { PacerCircle, type PacerFrame } from "./PacerCircle";
import { Results } from "./Results";
import { TONES, useTones } from "./useTones";

type Phase = "strap" | "calibrate" | "ready" | "countdown" | "live" | "review";

const MAX_MARKERS = 2;

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <Instrument />
    </Suspense>
  );
}

/**
 * The recording instrument, full screen and always dark: strap check, the
 * calibration circle, a countdown, then the session itself (pacer circle or
 * line for paced, the breath line with markers for open), and the score with
 * a note to save. Everything is timed by the band's 20 Hz sample clock, so the
 * pacer and the recording can't drift apart.
 */
function Instrument() {
  const params = useSearchParams();
  const setup = useMemo(() => parseSetup(new URLSearchParams(params.toString())), [params]);
  // Onboarding's first suggested session (T-0115): named in the bar, and leaving it means "later", so it goes Home.
  const firstSession = useMemo(() => firstSessionName(new URLSearchParams(params.toString())), [params]);
  const router = useRouter();
  const auth = useAuth();
  const backend = useBackend();
  const device = useDevice();
  const [phase, setPhase] = useState<Phase>("strap");
  const [sound, setSound] = useState(setup.sound);
  const tones = useTones(sound);
  const paced = setup.mode === "paced";
  const half = paced ? setup.pacer : null;

  const phaseRef = useRef<Phase>("strap");
  const lastN = useRef(-1);
  const lastAt = useRef(0);
  const calRaw = useRef<number[]>([]);
  const calStarted = useRef(0);
  const startN = useRef<number | null>(null);
  const raw = useRef<number[]>([]);
  const pct = useRef<number[]>([]);
  const markers = useRef<number[]>([]);
  const startedAt = useRef<Date>(new Date());
  const scale = useRef<{ a100: number; midline: number } | null>(null);

  const [calBreaths, setCalBreaths] = useState(0);
  const [calLeft, setCalLeft] = useState(CALIBRATION_WINDOW_S);
  const [calError, setCalError] = useState<string | null>(null);
  const [goodFor, setGoodFor] = useState(0);
  const [reuseAge, setReuseAge] = useState<number | null>(null);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [markerCount, setMarkerCount] = useState(0);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [built, setBuilt] = useState<BuiltSession | null>(null);
  const [tooShort, setTooShort] = useState(false);
  const [moodBefore, setMoodBefore] = useState<MoodScore | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // One subscription feeds every phase: calibration samples, then the recording.
  useEffect(
    () =>
      device.subscribe((s) => {
        lastN.current = s.n;
        lastAt.current = performance.now();
        const p = phaseRef.current;
        if (p === "calibrate") calRaw.current.push(s.value);
        if (p === "live" && startN.current !== null && s.n >= startN.current && scale.current) {
          raw.current.push(s.value);
          pct.current.push(((s.value - scale.current.midline) / scale.current.a100) * 100);
        }
      }),
    [device],
  );

  // Strap: move on once the fit has been good for two seconds.
  useEffect(() => {
    if (phase !== "strap" || !device.connected) return;
    const timer = setInterval(() => {
      setReuseAge(device.calibration ? (Date.now() - device.calibration.at) / 60_000 : null);
      const tail = device.recent().slice(-2 * SAMPLE_RATE_HZ);
      if (tail.length < SAMPLE_RATE_HZ) return;
      const level = tail.reduce((a, b) => a + b, 0) / tail.length;
      setGoodFor((g) => (fitOf(level) === "good" ? g + 0.25 : 0));
    }, 250);
    return () => clearInterval(timer);
  }, [phase, device]);

  const beginCalibration = useCallback(() => {
    calRaw.current = [];
    calStarted.current = performance.now();
    setCalBreaths(0);
    setCalLeft(CALIBRATION_WINDOW_S);
    setCalError(null);
    setPhase("calibrate");
    void device.send(BAND_COMMANDS.calibrate).catch(() => undefined);
  }, [device]);

  useEffect(() => {
    // A calibration from this connection is kept until the band comes off (Harry: calibrate
    // each time the band goes on, not between sessions), so only a fresh band calibrates itself.
    if (phase === "strap" && goodFor >= 2 && !device.calibration) {
      const t = setTimeout(beginCalibration, 0);
      return () => clearTimeout(t);
    }
  }, [phase, goodFor, beginCalibration, device.calibration]);

  // Calibration: full breaths for 20 seconds, then the scale from the deepest three.
  useEffect(() => {
    if (phase !== "calibrate") return;
    const timer = setInterval(() => {
      const seconds = (performance.now() - calStarted.current) / 1000;
      const { breaths, remainingS, result, failed } = calibrationProgress(calRaw.current, SAMPLE_RATE_HZ, seconds);
      setCalBreaths(breaths);
      setCalLeft(Math.ceil(remainingS));
      if (result) {
        device.setCalibration(result);
        scale.current = { a100: result.a100, midline: result.midline };
        setPhase("ready");
        return;
      }
      if (failed) {
        setCalError("We couldn't see three full breaths in the 20 seconds. Check the strap is snug, then try again, breathing slowly all the way in and out.");
        setPhase("strap");
        setGoodFor(0);
      }
    }, 700);
    return () => clearInterval(timer);
  }, [phase, device]);

  const calibrationFill = useCallback(() => {
    const s = calRaw.current;
    if (s.length < 3) return { fill: 0, rising: true };
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of s) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const last = s.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, s.length);
    const before = s.slice(-12, -6);
    const prev = before.length ? before.reduce((a, b) => a + b, 0) / before.length : last;
    return { fill: hi - lo > 1e-6 ? (last - lo) / (hi - lo) : 0, rising: last >= prev };
  }, []);

  const reuse = reuseAge !== null ? device.calibration : null;
  const useLastCalibration = () => {
    if (!reuse) return;
    scale.current = { a100: reuse.a100, midline: reuse.midline };
    setPhase("ready");
  };

  const begin = () => {
    tones.unlock();
    setCount(3);
    setPhase("countdown");
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    const ticks = [setTimeout(() => setCount(2), 1000), setTimeout(() => setCount(1), 2000)];
    const go = setTimeout(() => {
      startN.current = lastN.current + 1;
      raw.current = [];
      pct.current = [];
      markers.current = [];
      startedAt.current = new Date();
      device.follow(half ? { inhaleS: half, exhaleS: half, startN: startN.current } : null);
      setPhase("live");
    }, 3000);
    return () => {
      ticks.forEach(clearTimeout);
      clearTimeout(go);
    };
  }, [phase, device, half]);

  const finish = useCallback(() => {
    device.follow(null);
    const seconds = raw.current.length / SAMPLE_RATE_HZ;
    if (seconds < MIN_RECORDING_S || !scale.current) {
      setTooShort(true);
      setBuilt(null);
      setPhase("review");
      return;
    }
    setTooShort(false);
    setBuilt(
      buildSession({
        mode: setup.mode,
        halfCycleS: half as 2 | 5 | null,
        startedAt: startedAt.current,
        raw: raw.current,
        markers: markers.current,
        calibration: scale.current,
        skillLevel: setup.skill,
        note: "",
        recorder: device.kind === "simulated" ? "web+simulator" : "web+band",
      }),
    );
    setPhase("review");
  }, [device, half, setup]);

  // While live: the clock, auto-stop, the open-session rate, and the pacer tones.
  useEffect(() => {
    if (phase !== "live") return;
    let lastTurn = -1;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!half) return;
      const t = pct.current.length / SAMPLE_RATE_HZ;
      const turn = Math.floor(t / half);
      if (turn !== lastTurn) {
        lastTurn = turn;
        tones.play(turn % 2 === 1 ? TONES.high : TONES.low);
      }
    };
    raf = requestAnimationFrame(loop);
    const clock = setInterval(() => {
      const seconds = pct.current.length / SAMPLE_RATE_HZ;
      setElapsed(seconds);
      if (setup.lengthSec > 0 && seconds >= setup.lengthSec) finish();
    }, 200);
    const rate = setInterval(() => {
      if (half) return;
      const recent = pct.current.slice(-60 * SAMPLE_RATE_HZ);
      if (recent.length < 20 * SAMPLE_RATE_HZ) return;
      try {
        setLiveRate(analyzeOpenRecording(recent, SAMPLE_RATE_HZ).whole.metrics?.rateBpm ?? null);
      } catch {
        setLiveRate(null);
      }
    }, 3000);
    const leave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", leave);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(clock);
      clearInterval(rate);
      window.removeEventListener("beforeunload", leave);
    };
  }, [phase, half, setup.lengthSec, finish, tones]);

  const frame = useCallback((): PacerFrame => {
    const n = pct.current.length;
    const since = Math.min(1 / SAMPLE_RATE_HZ, (performance.now() - lastAt.current) / 1000);
    return { t: n / SAMPLE_RATE_HZ + (n ? since : 0), userPct: n ? pct.current[n - 1] : null };
  }, []);
  const readPct = useCallback(() => pct.current, []);
  const readMarkers = useCallback(() => markers.current, []);

  const mark = () => {
    if (markers.current.length >= MAX_MARKERS) return;
    markers.current = [...markers.current, pct.current.length];
    setMarkerCount(markers.current.length);
  };

  const uid = auth.status === "signed-in" ? auth.user.uid : null;
  // The results speak in the person's goal's tone; Calm's line counts the days in a row, this session included.
  const goal = auth.status === "signed-in" ? (auth.profile?.preferences?.goal ?? null) : null;
  const history = useLoad(uid && goal === "calm" ? `results-history:${uid}` : null, () => backend.data.listSessions(uid!, { limit: 60 }));
  const streak = useMemo(() => {
    if (!built || !uid) return 0;
    const before = history.status === "ready" ? history.data : [];
    const now = new Date(built.session.startedAt);
    return streakDays([{ ...built.session, id: "new", athleteId: uid, waveformPath: "" }, ...before], now);
  }, [built, uid, history]);
  // Focus's mood check-in (J6): asked before Begin and on the results, when the person has it on.
  const askMood = auth.status === "signed-in" && asksMood(auth.profile?.preferences);
  const save = async (note: string, moodAfter: MoodScore | null) => {
    if (!built || !uid) return;
    const saved = await backend.data.saveSession(uid, { ...built.session, note }, built.waveform);
    if (askMood && (moodBefore !== null || moodAfter !== null)) {
      // The session is already safe: a check-in that can't be stored (http, until I-08) never holds it up.
      await backend.data.saveMoodCheckins(uid, saved.id, { before: moodBefore, after: moodAfter }).catch(() => undefined);
    }
    router.replace(`${sessionHref(uid, saved.id)}&new=1`);
  };

  const exit = () => {
    if (phase === "live" && !window.confirm("Stop recording and leave? This session won't be saved.")) return;
    device.follow(null);
    router.push(firstSession ? "/cloud/" : "/cloud/record/");
  };

  const kind = paced ? `Paced ${setup.pacer}-${setup.pacer}` : "Open session";
  const title = firstSession ?? kind;
  const remaining = setup.lengthSec > 0 ? Math.max(0, setup.lengthSec - elapsed) : null;
  const signalLost = phase === "live" && (!device.connected || device.stalled);
  const needsBand = !device.connected && phase !== "review" && phase !== "live";

  return (
    <div className="instrument theme-dark" data-phase={phase}>
      <header className="inst-bar">
        <button type="button" className="inst-icon" onClick={exit} title="Leave">
          <Icon name="close" size={22} />
          <span className="sr-only">Leave the session</span>
        </button>
        <div className="inst-title">
          <Mark size={22} label="" />
          <span>
            {title}
            <small>
              {firstSession ? `Your first session · ${kind} · ` : ""}
              {setup.lengthSec ? formatDuration(setup.lengthSec) : "Until you stop"}
            </small>
          </span>
        </div>
        <div className="inst-tools">
          {paced && (
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
          )}
          {phase === "live" && (
            <span className="inst-clock mono" aria-label="Time">
              {formatDuration(Math.floor(elapsed))}
              {remaining !== null && <small> / {formatDuration(setup.lengthSec)}</small>}
            </span>
          )}
        </div>
      </header>

      <main className="inst-stage">
        {needsBand ? (
          <section className="inst-step">
            <h1>Connect your band</h1>
            <p>
              {device.status.state === "idle" || device.status.state === "disconnected"
                ? "The session starts with a quick strap check and calibration."
                : `${stateWords(device.status.state)}${device.status.message ? `. ${device.status.message}` : ""}`}
            </p>
            <div className="inst-actions">
              <button type="button" className="button" data-size="large" onClick={() => void device.connect()}>
                <Icon name={device.kind === "simulated" ? "signal" : "bluetooth"} size={20} />
                {device.kind === "simulated" ? "Start the simulated band" : "Connect your band"}
              </button>
              <Link href="/cloud/device/" className="link">
                Band settings
              </Link>
            </div>
          </section>
        ) : phase === "strap" ? (
          <section className="inst-step">
            <h1>Check the strap</h1>
            <p>
              {calError ??
                (reuse
                  ? "You calibrated when you put the band on. If it has stayed on since, keep that calibration; if you took it off, calibrate again."
                  : "Wrap the band around your belly, just below the ribs, and tighten it until the marker sits in the green.")}
            </p>
            {firstSession && !calError && (
              <p className="inst-small">
                Your first session: fit the strap, calibrate for 20 seconds, then {firstSession} for {Math.round(setup.lengthSec / 60)} minutes.
              </p>
            )}
            <StrapMeter read={device.recent} />
            <div className="inst-actions">
              {reuse ? (
                <>
                  <button type="button" className="button" data-size="large" onClick={useLastCalibration}>
                    Keep my calibration from {Math.max(1, Math.round(reuseAge ?? 1))} min ago
                  </button>
                  <button type="button" className="button" data-variant="ghost" onClick={beginCalibration}>
                    I took the band off, calibrate again
                  </button>
                </>
              ) : (
                <button type="button" className="button" data-size="large" onClick={beginCalibration}>
                  It&rsquo;s snug, calibrate
                </button>
              )}
            </div>
          </section>
        ) : phase === "calibrate" ? (
          <section className="inst-step inst-calibrate">
            <CalibrationRing read={calibrationFill} />
            <div>
              <h1>Full breaths for 20 seconds</h1>
              <p>
                Imagine your belly as a balloon. Breathe in slowly until the circle reaches the outer ring, then push every bit of
                air out until it shrinks to the inner one, and keep going until the time is up. Your fullest breaths tell
                Breathband how far you can breathe, so every score is measured against you.
              </p>
              <div
                className="cal-time"
                role="progressbar"
                aria-label="Calibration time"
                aria-valuemin={0}
                aria-valuemax={CALIBRATION_WINDOW_S}
                aria-valuenow={CALIBRATION_WINDOW_S - calLeft}
              >
                <i style={{ width: `${((CALIBRATION_WINDOW_S - calLeft) / CALIBRATION_WINDOW_S) * 100}%` }} />
              </div>
              <p className="inst-small" role="status">
                {calLeft > 0 ? `${calLeft} s left` : "Done"} · {calBreaths === 0 ? "waiting for your first full breath" : `${calBreaths} full ${calBreaths === 1 ? "breath" : "breaths"}`}
              </p>
            </div>
          </section>
        ) : phase === "ready" ? (
          <section className="inst-step">
            <h1>Calibrated</h1>
            <p>
              {paced
                ? `Follow the ${setup.view === "circle" ? "circle" : "line"}: breathe in as it ${setup.view === "circle" ? "grows" : "rises"}, out as it ${setup.view === "circle" ? "shrinks" : "falls"}. ${sound ? "A low note marks the bottom of each breath, a high note the top." : ""}`
                : "Breathe however feels natural. Tap Mark a moment when something changes, up to twice."}
            </p>
            {askMood && <MoodFaces question="Before you begin, how do you feel?" value={moodBefore} onChange={setMoodBefore} />}
            <div className="inst-actions">
              <button type="button" className="button" data-size="large" onClick={begin} autoFocus>
                <span className="rec-dot" aria-hidden="true" />
                Begin
              </button>
            </div>
          </section>
        ) : phase === "countdown" ? (
          <section className="inst-step inst-count" aria-live="assertive">
            <p className="count-n display">{count}</p>
            <p>Get comfortable{paced ? ". Breathe in as the pacer starts." : "."}</p>
          </section>
        ) : phase === "live" ? (
          <section className={`inst-live${paced && setup.view === "circle" ? " with-circle" : ""}`}>
            {paced && setup.view === "circle" ? (
              <>
                <PacerCircle halfCycleS={half!} frame={frame} />
                <div className="inst-strip">
                  <BreathLine read={readPct} halfCycleS={half} markers={readMarkers} windowS={20} label="Your breath against the pacer" />
                </div>
                <LineLegend paced compact />
              </>
            ) : (
              <div className="inst-line-wrap">
              <div className="inst-line">
                <BreathLine
                  read={readPct}
                  halfCycleS={half}
                  markers={readMarkers}
                  annotate
                  label={paced ? "Your breath against the pacer, with timing and depth for each turn" : "Your breath, with the depth and length of each breath"}
                />
                {!paced && (
                  <div className="inst-readout">
                    <span>
                      <b className="display">{liveRate === null ? "–" : Math.round(liveRate)}</b> br/min
                    </span>
                    <small>Last minute</small>
                  </div>
                )}
              </div>
              <LineLegend paced={paced} />
              </div>
            )}
            {signalLost && (
              <div className="inst-lost" role="alert">
                <b>Signal lost.</b> Recording pauses until the band is back. {device.status.message ?? ""}
              </div>
            )}
          </section>
        ) : (
          <Results
            built={built}
            tooShort={tooShort}
            title={title}
            goal={goal}
            streakDays={streak}
            askMood={askMood}
            moodBefore={moodBefore}
            onSave={save}
            onDiscard={() => router.push("/cloud/record/")}
            onRestart={() => {
              setBuilt(null);
              setTooShort(false);
              // A new attempt asks the mood afresh.
              setMoodBefore(null);
              setPhase("ready");
            }}
          />
        )}
      </main>

      {phase === "live" && (
        <footer className="inst-foot">
          {!paced && (
            <button type="button" className="button" data-variant="ghost" data-size="large" onClick={mark} disabled={markerCount >= MAX_MARKERS}>
              <Icon name="marker" size={20} />
              Mark a moment <small>({MAX_MARKERS - markerCount} left)</small>
            </button>
          )}
          <button type="button" className="button inst-stop" data-size="large" onClick={finish}>
            <Icon name="stop" size={18} />
            {setup.lengthSec ? "Stop early" : "Stop"}
          </button>
        </footer>
      )}
    </div>
  );
}

/** A compact strap gauge for the dark instrument, reading the resting level of the last two seconds. */
function StrapMeter({ read }: { read: () => readonly number[] }) {
  const marker = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const tail = read().slice(-2 * SAMPLE_RATE_HZ);
      if (!tail.length) return;
      const level = tail.reduce((a, b) => a + b, 0) / tail.length;
      const fit = fitOf(level);
      if (marker.current) marker.current.style.left = `${Math.max(0, Math.min(100, (level / STRAP_TENSION.full) * 100))}%`;
      if (label.current) {
        label.current.textContent = fit === "good" ? "Good fit" : fit === "slack" ? "Tighten" : "Loosen a notch";
        label.current.parentElement!.dataset.fit = fit;
      }
    }, 200);
    return () => clearInterval(timer);
  }, [read]);
  return (
    <div className="strap-meter" data-fit="slack">
      <div className="gauge-track">
        <span
          className="gauge-good"
          style={{
            left: `${(STRAP_TENSION.min / STRAP_TENSION.full) * 100}%`,
            width: `${((STRAP_TENSION.max - STRAP_TENSION.min) / STRAP_TENSION.full) * 100}%`,
          }}
        />
        <span className="gauge-marker" ref={marker} />
      </div>
      <span className="strap-word" ref={label} role="status">
        Tighten
      </span>
    </div>
  );
}

/** What the live chart shows, in words: the colours, the pacer, the target band and the tags. */
function LineLegend({ paced, compact = false }: { paced: boolean; compact?: boolean }) {
  return (
    <ul className="line-legend" data-compact={compact || undefined} aria-label="How to read the chart">
      <li>
        <i data-k="in" aria-hidden="true" />
        Breathing in
      </li>
      <li>
        <i data-k="out" aria-hidden="true" />
        Breathing out
      </li>
      {paced && (
        <li>
          <i data-k="pacer" aria-hidden="true" />
          The pacer to follow
        </li>
      )}
      <li>
        <i data-k="band" aria-hidden="true" />
        Target depth, ±3% of your max
      </li>
      {!compact && (
        <li>
          <i data-k="tag" aria-hidden="true" />
          {paced ? "Each turn: timing and depth against the pacer" : "Each breath: how deep and how long"}
          <span className="line-legend-amber"> (amber when well off)</span>
        </li>
      )}
    </ul>
  );
}
