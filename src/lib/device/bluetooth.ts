import { BAND_NAME, NUS, OPTIONAL_SERVICES, RECONNECT } from "./config";
import { parseNotification, SampleClock } from "./stream";
import type { Sample, SignalSource, SourceStatus } from "./types";

// The slice of the Web Bluetooth API the console uses. TypeScript's DOM types
// don't include Web Bluetooth, and a types package would be a new dependency.
interface BleCharacteristic extends EventTarget {
  readonly uuid: string;
  readonly properties: { readonly notify: boolean; readonly write: boolean; readonly writeWithoutResponse: boolean };
  readonly value?: DataView;
  startNotifications(): Promise<BleCharacteristic>;
  stopNotifications(): Promise<BleCharacteristic>;
  readValue(): Promise<DataView>;
  writeValue(data: BufferSource): Promise<void>;
}
interface BleService {
  getCharacteristic(uuid: string): Promise<BleCharacteristic>;
  getCharacteristics(): Promise<BleCharacteristic[]>;
}
interface BleServer {
  readonly connected: boolean;
  connect(): Promise<BleServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<BleService>;
}
interface BleDevice extends EventTarget {
  readonly name?: string;
  readonly gatt?: BleServer;
}
interface Bluetooth {
  getAvailability?(): Promise<boolean>;
  requestDevice(options: { filters: { namePrefix: string }[]; optionalServices: readonly string[] }): Promise<BleDevice>;
}

function bluetooth(): Bluetooth | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth ?? null;
}

export type BluetoothSupport = "supported" | "insecure" | "unsupported";

/** Web Bluetooth needs Chrome, Edge or Opera on desktop or Android, over HTTPS (or localhost). */
export function bluetoothSupport(): BluetoothSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  return bluetooth() ? "supported" : "unsupported";
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/** Words for a failed Web Bluetooth call that a person can act on. */
export function describeBluetoothError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotFoundError") return "No band was chosen. Turn the band on, keep it close, and try again.";
  if (name === "SecurityError") return "The browser blocked Bluetooth here. Use Chrome or Edge over HTTPS.";
  if (name === "NetworkError") return "The band didn't answer. Make sure it isn't connected to the phone app, then try again.";
  if (name === "NotSupportedError") return "This band doesn't offer the data service the console expects.";
  return error instanceof Error ? error.message : "Bluetooth failed for an unknown reason.";
}

/**
 * The real band over Web Bluetooth. It asks the browser for a device named
 * "BreathBand", opens the UART service (see config.ts for what is assumed),
 * reads one number per notification, and samples the latest number at 20 Hz
 * like the app. If the band drops, it tries to reconnect a few times before
 * reporting the disconnect.
 */
export class BluetoothBand implements SignalSource {
  readonly kind = "bluetooth" as const;
  private listeners = new Set<(s: Sample) => void>();
  private statusListeners = new Set<(s: SourceStatus) => void>();
  private current: SourceStatus = { state: "idle", battery: null };
  private device: BleDevice | null = null;
  private tx: BleCharacteristic | null = null;
  private rx: BleCharacteristic | null = null;
  private wanted = false;
  private readonly clock = new SampleClock((s) => {
    for (const l of this.listeners) l(s);
  });

  status(): SourceStatus {
    return this.current;
  }

  onStatus(listener: (s: SourceStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  subscribe(listener: (s: Sample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<void> {
    const ble = bluetooth();
    if (!ble) {
      this.setStatus({ state: "error", message: "This browser can't use Bluetooth. Use Chrome or Edge on a computer or Android." });
      return;
    }
    this.wanted = true;
    try {
      this.setStatus({ state: "requesting", message: undefined });
      this.device = await ble.requestDevice({ filters: [{ namePrefix: BAND_NAME }], optionalServices: OPTIONAL_SERVICES });
      this.device.addEventListener("gattserverdisconnected", this.onDrop);
      this.setStatus({ state: "connecting", deviceName: this.device.name ?? BAND_NAME });
      await this.open();
    } catch (error) {
      this.wanted = false;
      this.setStatus({ state: "error", message: describeBluetoothError(error) });
    }
  }

  async disconnect(): Promise<void> {
    this.wanted = false;
    this.clock.stop();
    this.device?.removeEventListener("gattserverdisconnected", this.onDrop);
    this.device?.gatt?.disconnect();
    this.tx = null;
    this.rx = null;
    this.setStatus({ state: "disconnected", message: undefined, battery: null });
  }

  async send(command: string): Promise<void> {
    if (!this.rx) throw new Error("The band isn't connected.");
    await this.rx.writeValue(ENCODER.encode(`${command}\n`));
  }

  private async open(): Promise<void> {
    const server = await this.device!.gatt!.connect();
    const service = await server.getPrimaryService(NUS.service);
    const { tx, rx } = await findCharacteristics(service);
    this.tx = tx;
    this.rx = rx;
    tx.addEventListener("characteristicvaluechanged", this.onValue);
    await tx.startNotifications();
    this.clock.start();
    this.setStatus({ state: "connected", message: undefined, battery: await readBattery(server) });
  }

  private onValue = (event: Event): void => {
    const view = (event.target as BleCharacteristic).value;
    if (!view) return;
    const values = parseNotification(DECODER.decode(view));
    const last = values[values.length - 1];
    if (last !== undefined) this.clock.hold(last);
  };

  private onDrop = (): void => {
    this.clock.stop();
    if (!this.wanted) return;
    void this.reconnect();
  };

  private async reconnect(): Promise<void> {
    for (let attempt = 0; attempt < RECONNECT.attempts && this.wanted; attempt++) {
      this.setStatus({ state: "reconnecting", message: `Reconnecting (try ${attempt + 1} of ${RECONNECT.attempts})…` });
      await new Promise((r) => setTimeout(r, RECONNECT.firstDelayMs * 2 ** attempt));
      try {
        await this.open();
        return;
      } catch {
        // Try again after a longer pause.
      }
    }
    this.wanted = false;
    this.setStatus({ state: "disconnected", message: "The band disconnected. Check it's on and in range, then connect again." });
  }

  private setStatus(patch: Partial<SourceStatus>): void {
    this.current = { ...this.current, ...patch };
    for (const l of this.statusListeners) l(this.current);
  }
}

/**
 * The UART characteristics, by their NUS UUIDs; failing that, the first
 * notify and write characteristics in the service, which is what the app does.
 */
async function findCharacteristics(service: BleService): Promise<{ tx: BleCharacteristic; rx: BleCharacteristic }> {
  try {
    return { tx: await service.getCharacteristic(NUS.tx), rx: await service.getCharacteristic(NUS.rx) };
  } catch {
    const all = await service.getCharacteristics();
    const tx = all.find((c) => c.properties.notify);
    const rx = all.find((c) => c.properties.write || c.properties.writeWithoutResponse);
    if (!tx || !rx) throw new DOMException("No notify and write characteristics found", "NotSupportedError");
    return { tx, rx };
  }
}

async function readBattery(server: BleServer): Promise<number | null> {
  try {
    const service = await server.getPrimaryService("battery_service");
    const level = await (await service.getCharacteristic("battery_level")).readValue();
    return level.getUint8(0);
  } catch {
    return null;
  }
}
