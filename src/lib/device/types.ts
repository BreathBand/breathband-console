export type SourceKind = "simulated" | "bluetooth";

export type ConnectionState = "idle" | "requesting" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

/** One reading from the band, in raw sensor units, on the console's 20 Hz clock. */
export interface Sample {
  /** Index on the 20 Hz clock since the source connected. */
  readonly n: number;
  readonly value: number;
}

export interface SourceStatus {
  readonly state: ConnectionState;
  /** Shown to the person when state is "error" or "disconnected" after a failure. */
  readonly message?: string;
  /** 0–100, when the band reports it. */
  readonly battery?: number | null;
  /** The band's name as it advertised, or "Simulated band". */
  readonly deviceName?: string;
}

/**
 * A breathing signal: the real band over Web Bluetooth or the simulator. Both
 * deliver raw readings on the same 20 Hz clock, take the same text commands,
 * and report the same connection states, so every screen works with either.
 */
export interface SignalSource {
  readonly kind: SourceKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Sends a text command ("calibration", "start"). */
  send(command: string): Promise<void>;
  /** Called for every sample; returns an unsubscribe function. */
  subscribe(listener: (sample: Sample) => void): () => void;
  /** Called on every status change; returns an unsubscribe function. */
  onStatus(listener: (status: SourceStatus) => void): () => void;
  status(): SourceStatus;
}

/** What the simulated user does, so the demo can show good and faulty breathing. */
export type SimPersona = "steady" | "early" | "shallow" | "deep" | "rushed" | "distracted";

/** The pacer the simulated user follows during a paced session, on the source's clock. */
export interface SimPacer {
  readonly inhaleS: number;
  readonly exhaleS: number;
  /** Sample index where the pacer's first inhale starts. */
  readonly startN: number;
}
